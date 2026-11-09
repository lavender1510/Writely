const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const { MAX_FILE_BYTES, validateDocument, invalid } = require('../core/validation.mjs');

async function atomicWrite(target, content) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  let handle;
  try {
    handle = await fs.open(temporary, 'wx', 0o600);
    await handle.writeFile(content);
    await handle.sync();
    await handle.close();
    handle = null;
    // Windows readers and antivirus software can hold the target briefly. Keep the
    // old file intact and retry the same atomic rename; never delete the target.
    const delays=[25,50,100,200,400];
    for(let attempt=0;;attempt++){
      try{await fs.rename(temporary,target);break;}
      catch(error){if(!['EPERM','EACCES','EBUSY'].includes(error.code)||attempt>=delays.length)throw error;await new Promise(resolve=>setTimeout(resolve,delays[attempt]));}
    }
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

async function readDocument(filePath) {
  const stat = await fs.stat(filePath);
  if (stat.size > MAX_FILE_BYTES) invalid('Die Datei ist größer als 64 MB.');
  let value;
  try {
    value = JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) invalid('Die Datei enthält kein lesbares JSON.');
    throw error;
  }
  validateDocument(value);
  return validateDocument(require('./document-schema.mjs').migrateDocument(value));
}

class LocalStore {
  constructor(
    directory,
    { historyLimit = 30, snapshotIntervalMs = 60_000, maxHistoryBytes = 128 * 1024 * 1024 } = {},
  ) {
    this.directory = directory;
    this.historyLimit = historyLimit;
    this.snapshotIntervalMs = snapshotIntervalMs;
    this.maxHistoryBytes = maxHistoryBytes;
    this.queue = Promise.resolve();
    this.lastSnapshot = new Map();
  }
  enqueue(task) {
    const pending = this.queue.then(task);
    this.queue = pending.catch(() => {});
    return pending;
  }
  async flush() {
    await this.queue;
  }
  async readRecoverySnapshot() {
    for (const name of ['recovery.writely', 'recovery.previous.writely']) {
      const filePath = path.join(this.directory, name);
      try {
        return { document: await readDocument(filePath), filePath };
      } catch (error) {
        if (error.code !== 'ENOENT' && !error.message.includes('ungültig')) throw error;
      }
    }
    return null;
  }
  async preserveRecovery(nextDocument, forceVersion = false) {
    const previous = await this.readRecoverySnapshot();
    if (!previous) return;
    // A switch or explicit restore must preserve the latest typing even within the timed snapshot interval.
    if (forceVersion || previous.document.id !== nextDocument?.id)
      await this.writeVersion(previous.document, JSON.stringify(previous.document));
    const backup = path.join(this.directory, 'recovery.previous.writely');
    if (previous.filePath !== backup) await fs.copyFile(previous.filePath, backup);
  }
  async autosave(document) {
    const snapshot = JSON.stringify(validateDocument(document));
    return this.enqueue(async () => {
      const recoveryPath = path.join(this.directory, 'recovery.writely');
      const doc = JSON.parse(snapshot);
      await this.preserveRecovery(doc);
      await atomicWrite(recoveryPath, snapshot);
      const previous = this.lastSnapshot.get(doc.id);
      if (!previous || Date.now() - previous > this.snapshotIntervalMs)
        await this.writeVersion(doc, snapshot);
    });
  }
  async save(document, filePath) {
    const snapshot = JSON.stringify(validateDocument(document), null, 2);
    return this.enqueue(async () => {
      await this.preserveRecovery(JSON.parse(snapshot));
      await atomicWrite(filePath, snapshot);
      await atomicWrite(path.join(this.directory, 'recovery.writely'), snapshot);
      await this.writeVersion(JSON.parse(snapshot), snapshot);
    });
  }
  async recover() {
    await this.queue;
    return (await this.readRecoverySnapshot())?.document || null;
  }
  async historyEntries() {
    const history = path.join(this.directory, 'versions');
    let files;
    try {
      files = await fs.readdir(history);
    } catch (e) {
      if (e.code === 'ENOENT') return [];
      throw e;
    }
    const entries = [];
    for (const filename of files
      .filter((n) => /^\d+-[a-f0-9]+\.writely$/.test(n))
      .sort()
      .reverse()) {
      try {
        const document = await readDocument(path.join(history, filename));
        entries.push({
          filename,
          document,
          size: (await fs.stat(path.join(history, filename))).size,
        });
      } catch (e) {
        if (e.code === 'ENOENT' || e.message.includes('ungültig')) continue;
        throw e;
      }
    }
    return entries;
  }
  async writeVersion(document, snapshot) {
    const history = path.join(this.directory, 'versions');
    await fs.mkdir(history, { recursive: true });
    const files = (await fs.readdir(history))
      .filter((n) => /^\d+-[a-f0-9]+\.writely$/.test(n))
      .sort()
      .reverse();
    const stamp = Math.max(Date.now(), Number(files[0]?.split('-')[0] || 0) + 1),
      id = `${stamp}-${crypto.randomBytes(6).toString('hex')}`;
    await atomicWrite(path.join(history, id + '.writely'), snapshot);
    this.lastSnapshot.set(document.id, Date.now());
    await this.pruneHistory();
  }
  async pruneHistory() {
    const usage = new Map();
    for (const entry of await this.historyEntries()) {
      const used = usage.get(entry.document.id) || { count: 0, bytes: 0 };
      if (
        used.count &&
        (used.count >= this.historyLimit || used.bytes + entry.size > this.maxHistoryBytes)
      )
        await fs.rm(path.join(this.directory, 'versions', entry.filename), { force: true });
      else {
        used.count++;
        used.bytes += entry.size;
        usage.set(entry.document.id, used);
      }
    }
  }
  async versions(documentId) {
    if (documentId !== undefined && (typeof documentId !== 'string' || documentId.length > 128))
      throw new Error('Diese Dokumentversion ist ungültig.');
    await this.queue;
    return (await this.historyEntries())
      .filter((e) => documentId === undefined || e.document.id === documentId)
      .map((e) => ({
        id: e.filename.slice(0, -8),
        documentId: e.document.id,
        title: e.document.title,
        updatedAt: e.document.updatedAt,
        capturedAt: new Date(Number(e.filename.split('-')[0])).toISOString(),
        size: e.size,
      }));
  }
  async previewVersion(id, documentId) {
    if (typeof id !== 'string' || id.length > 128 || !/^\d+-[a-f0-9]+$/.test(id))
      throw new Error('Diese Dokumentversion ist ungültig.');
    await this.queue;
    const target = await readDocument(path.join(this.directory, 'versions', id + '.writely'));
    if (documentId !== undefined && target.id !== documentId)
      throw new Error('Diese Dokumentversion gehört zu einem anderen Dokument.');
    return target;
  }
  async restoreVersion(id, documentId) {
    if (typeof id !== 'string' || id.length > 128 || !/^\d+-[a-f0-9]+$/.test(id))
      throw new Error('Diese Dokumentversion ist ungültig.');
    return this.enqueue(async () => {
      const target = await readDocument(path.join(this.directory, 'versions', id + '.writely'));
      if (documentId !== undefined && target.id !== documentId)
        throw new Error('Diese Dokumentversion gehört zu einem anderen Dokument.');
      await this.preserveRecovery(target, true);
      return target;
    });
  }
  settings() {
    return {
      historyLimit: this.historyLimit,
      intervalMinutes: this.snapshotIntervalMs / 60000,
      maxMegabytes: this.maxHistoryBytes / 1024 / 1024,
    };
  }
  async loadSettings() {
    try {
      const value = JSON.parse(
        await fs.readFile(path.join(this.directory, 'history-settings.json'), 'utf8'),
      );
      this.applySettings(value);
    } catch (e) {
      if (e.code !== 'ENOENT')
        throw new Error(
          'Die Datei mit den Sicherungseinstellungen ist ungültig. Bestehende Sicherungen bleiben erhalten.',
        );
    }
    return this.settings();
  }
  applySettings(value) {
    if (
      !value ||
      !Number.isInteger(value.historyLimit) ||
      value.historyLimit < 3 ||
      value.historyLimit > 500 ||
      !Number.isInteger(value.intervalMinutes) ||
      value.intervalMinutes < 1 ||
      value.intervalMinutes > 60 ||
      !Number.isInteger(value.maxMegabytes) ||
      value.maxMegabytes < 64 ||
      value.maxMegabytes > 1024
    )
      throw new Error('Die Datei enthält ungültige Sicherungseinstellungen.');
    this.historyLimit = value.historyLimit;
    this.snapshotIntervalMs = value.intervalMinutes * 60000;
    this.maxHistoryBytes = value.maxMegabytes * 1024 * 1024;
  }
  async configure(value) {
    // Validate on a separate object before committing preferences or pruning any data.
    const probe = new LocalStore(this.directory);
    probe.applySettings(value);
    return this.enqueue(async () => {
      await atomicWrite(
        path.join(this.directory, 'history-settings.json'),
        JSON.stringify(probe.settings()),
      );
      this.applySettings(value);
      await this.pruneHistory();
      return this.settings();
    });
  }
  async forgetDocument(documentId) {
    if (typeof documentId !== 'string' || !documentId || documentId.length > 128)
      throw new Error('Die Datei-ID ist ungültig.');
    return this.enqueue(async () => {
      for (const e of await this.historyEntries())
        if (e.document.id === documentId)
          await fs.rm(path.join(this.directory, 'versions', e.filename), { force: true });
      for (const name of ['recovery.writely', 'recovery.previous.writely']) {
        const file = path.join(this.directory, name);
        try {
          if ((await readDocument(file)).id === documentId) await fs.rm(file);
        } catch (e) {
          if (e.code !== 'ENOENT') throw e;
        }
      }
      this.lastSnapshot.delete(documentId);
    });
  }
}

module.exports = { MAX_FILE_BYTES, validateDocument, atomicWrite, readDocument, LocalStore };
