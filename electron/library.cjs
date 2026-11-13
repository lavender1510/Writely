const {validateFolders,validateFolderTrash,activeFolder,saveFolder,trashFolderTree,restoreFolderTree,moveDocuments}=require('../core/folders.mjs');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { atomicWrite, readDocument, validateDocument } = require('./storage.cjs');
const empty = () => ({ version: 3, folders: [], documents: [], templates: [], styleSets: [] });
const validId = (id) =>
  typeof id === 'string' &&
  id.length > 0 &&
  id.length <= 128 &&
  !['__proto__', 'constructor', 'prototype'].includes(id);
const storageId = (id) => typeof id === 'string' && /^[a-zA-Z0-9-]{1,128}$/.test(id);
const textOf = (node) =>
  node.type === 'note'
    ? node.attrs.text
    : node.type === 'text'
      ? node.text || ''
      : (node.content || [])
          .map(textOf)
          .join(['paragraph', 'heading'].includes(node.type) ? '' : ' ');
function validateIndex(index) {
  if (index?.version !== undefined && ![1, 2, 3].includes(index.version))
    throw new Error('Diese Bibliotheksversion wird noch nicht unterstützt.');
  if (!index || typeof index !== 'object')
    throw new Error('Die Datei enthält keinen gültigen Bibliotheksindex.');
  for (const key of ['folders', 'documents', 'templates', 'styleSets']) {
    if (!Array.isArray(index[key]) || index[key].length > 10000)
      throw new Error('Die Datei enthält ungültige Bibliothekseinträge.');
    const ids = new Set();
    for (const item of index[key]) {
      if (!item || !validId(item.id) || ids.has(item.id))
        throw new Error('Die Datei enthält ungültige oder doppelte IDs.');
      ids.add(item.id);
    }
  }
  validateFolders(index.folders);validateFolderTrash(index);
  const folders = new Map(index.folders.map((f) => [f.id, f]));
  for (const f of index.folders) {
    if (typeof f.name !== 'string' || !f.name.trim() || f.name.length > 120)
      throw new Error('Die Datei enthält einen ungültigen Ordnernamen.');
    const seen = new Set([f.id]);
    let parent = f.parentId;
    while (parent) {
      if (seen.has(parent) || !folders.has(parent))
        throw new Error(
          'Ein Ordner kann nicht in sich selbst oder in einen fehlenden Ordner verschoben werden.',
        );
      seen.add(parent);
      parent = folders.get(parent).parentId;
    }
  }
  for (const d of index.documents) {
    if(!d.deletedAt)activeFolder(index.folders,d.folderId);
    if (
      !storageId(d.storageId) ||
      typeof d.title !== 'string' ||
      d.title.length > 500 ||
      !Number.isFinite(Date.parse(d.updatedAt)) ||
      (d.folderId && !folders.has(d.folderId)) ||
      (d.deletedAt && !Number.isFinite(Date.parse(d.deletedAt)))
    )
      throw new Error('Die Datei enthält ungültige Dokumentmetadaten.');
  }
  for (const t of [...index.templates, ...index.styleSets]) {
    if (typeof t.name !== 'string' || t.name.length > 120)
      throw new Error('Die Datei enthält eine ungültige Vorlage.');
    validateDocument(t.document);
  }
  return index;
}
class Library {
  constructor(root,{maxBackupBytes=256*1024*1024,maxCachedCharacters=16000000}={}) {
    this.root = root;
    this.maxBackupBytes=maxBackupBytes;this.maxCachedCharacters=maxCachedCharacters;
    this.queue = Promise.resolve();
    this.textCache = new Map();
  }
  run(fn) {
    const p = this.queue.then(fn);
    this.queue = p.catch(() => {});
    return p;
  }
  file(id) {
    if (!storageId(id)) throw new Error('Die Datei-ID ist ungültig.');
    return path.join(this.root, 'documents', id + '.writely');
  }
  async index() {
    try {
      const value = JSON.parse(await fs.readFile(path.join(this.root, 'index.json'), 'utf8'));
      return validateIndex({ ...empty(), ...value });
    } catch (e) {
      if (e.code === 'ENOENT') return empty();
      throw new Error(
        'Die lokale Bibliothek konnte nicht gelesen werden. Bestehende Dateien bleiben unverändert. ' +
          e.message,
      );
    }
  }
  async cleanup(index) {
    for (const name of await fs.readdir(this.root).catch((e) => {
      if (e.code === 'ENOENT') return [];
      throw e;
    }))
      if (/^index\.json\.\d+\.[a-f0-9]{12}\.tmp$/.test(name))
        await fs.rm(path.join(this.root, name), { force: true });
    const used = new Set(index.documents.map((d) => d.storageId + '.writely'));
    const files = await fs.readdir(path.join(this.root, 'documents')).catch((e) => {
      if (e.code === 'ENOENT') return [];
      throw e;
    });
    for (const name of files)
      if (
        (/^[a-zA-Z0-9-]{1,128}\.writely$/.test(name) && !used.has(name)) ||
        /^[a-zA-Z0-9-]{1,128}\.writely\.\d+\.[a-f0-9]{12}\.tmp$/.test(name)
      )
        await fs.rm(path.join(this.root, 'documents', name), { force: true });
    for (const key of this.textCache.keys())
      if (!used.has(key + '.writely')) this.textCache.delete(key);
  }
  async write(index) {
    index.version=3;validateIndex(index);
    await atomicWrite(path.join(this.root, 'index.json'), JSON.stringify(index));
    await this.cleanup(index).catch(() => {});
  }
  async initialize() {
    return this.run(async () => this.cleanup(await this.index()));
  }
  async list() {
    await this.queue;
    return this.index();
  }
  cacheText(id,text){
    if(text.length>this.maxCachedCharacters)return;
    while(this.textCache.size&&(this.textCache.size>=100||[...this.textCache.values()].reduce((n,t)=>n+t.length,0)+text.length>this.maxCachedCharacters))this.textCache.delete(this.textCache.keys().next().value);
    this.textCache.set(id,text);
  }
  record(document, old, id, filePath) {
    const text = textOf(document.content);
    this.cacheText(id,text);
    return {
      ...old,
      id: document.id,
      storageId: id,
      title: document.title,
      updatedAt: document.updatedAt,
      createdAt: old?.createdAt || document.createdAt,
      lastOpenedAt: new Date().toISOString(),
      folderId: old?.folderId || null,
      pinned: old?.pinned || false,
      path: filePath || old?.path,
      words: (text.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || []).length,
      size: Buffer.byteLength(JSON.stringify(document)),
      preview:
        document.content.content
          ?.filter((n) => n.type === 'heading' || n.type === 'paragraph')
          .slice(0, 4)
          .map((n) => ({
            type: n.type,
            content: [{ type: 'text', text: textOf(n).slice(0, 500) }],
          })) || [],
    };
  }
  async put(document, filePath, folderId) {
    const serialized = JSON.stringify(validateDocument(document));
    return this.run(async () => {
      const doc = JSON.parse(serialized),
        index = await this.index(),
        old = index.documents.find((d) => d.id === doc.id),
        id = randomUUID();
      if(old?.deletedAt)throw new Error('Das Dokument liegt im Papierkorb.');
      const target=folderId===undefined?(old?.folderId??null):folderId;activeFolder(index.folders,target);
      // Revision first, commit the reference second; the previous file is never overwritten.
      await atomicWrite(this.file(id), serialized);
      const record = this.record(doc, old, id, filePath);
      record.folderId=target;
      index.documents = index.documents.filter((d) => d.id !== doc.id);
      index.documents.push(record);
      try {
        await this.write(index);
      } catch (e) {
        await fs.rm(this.file(id), { force: true }).catch(() => {});
        throw e;
      }
      return record;
    });
  }
  async get(id) {
    if (!validId(id)) throw new Error('Das Dokument wurde nicht gefunden.');
    // Keep the indexed revision alive until the reader has finished parsing it.
    return this.run(async()=>{
      const d = (await this.index()).documents.find((d) => d.id === id && !d.deletedAt);
      if (!d) throw new Error('Das Dokument wurde nicht gefunden oder liegt im Papierkorb.');
      return { document: await readDocument(this.file(d.storageId)), path: d.path };
    });
  }
  async search(query) {
    if (typeof query !== 'string' || query.length > 256)
      throw new Error('Die Suchanfrage ist ungültig.');
    const needle = query.trim().toLocaleLowerCase('de');
    if (!needle) return [];
    return this.run(async () => {
      const index = await this.index(),
        results = [];
      let count = 0;
      for (const d of index.documents) {
        if (d.deletedAt) continue;
        let text = this.textCache.get(d.storageId);
        if (text === undefined) {
          text = textOf((await readDocument(this.file(d.storageId))).content);
          this.cacheText(d.storageId,text);
        }
        const at = text.toLocaleLowerCase('de').indexOf(needle);
        if (at >= 0 || d.title.toLocaleLowerCase('de').includes(needle))
          results.push({
            id: d.id,
            title: d.title,
            snippet: text.slice(Math.max(0, at - 65), Math.max(0, at - 65) + 220),
            folderId: d.folderId,
          });
        if (results.length >= 100) break;
        if (++count % 10 === 0) await new Promise(setImmediate);
      }
      return results;
    });
  }
  async mutate(action, data) {
    if (!data || typeof data !== 'object' || Array.isArray(data))
      throw new Error('Die Bibliotheksaktion ist ungültig.');
    return this.run(async () => {
      const index = await this.index();
      if (action === 'folder-save') {
        index.folders=saveFolder(index.folders,data,randomUUID());
      } else if (action === 'folder-trash') {
        trashFolderTree(index,data.id,randomUUID());
      } else if (action === 'folder-restore') {
        restoreFolderTree(index,data.id);
      } else if (action === 'documents-move') {
        moveDocuments(index,data.ids,data.folderId);
      } else if (action === 'folder-delete') {
        if (!index.folders.some((f) => f.id === data.id))
          throw new Error('Der Zielordner existiert nicht.');
        const ids = new Set([data.id]);
        let size = -1;
        while (size !== ids.size) {
          size = ids.size;
          for (const f of index.folders) if (ids.has(f.parentId)) ids.add(f.id);
        }
        index.folders = index.folders.filter((f) => !ids.has(f.id));
        for (const d of index.documents) if (ids.has(d.folderId)) {d.folderId = null;delete d.folderTrashBatch;}
      } else if (
        ['document-update', 'document-remove', 'document-restore', 'document-purge'].includes(
          action,
        )
      ) {
        const d = index.documents.find((d) => d.id === data.id);
        if (!d) throw new Error('Das Dokument wurde nicht gefunden.');
        if (action === 'document-remove') d.deletedAt = new Date().toISOString();
        if (action === 'document-restore') {
          activeFolder(index.folders,d.folderId);delete d.deletedAt;delete d.folderTrashBatch;
          if (!index.folders.some((f) => f.id === d.folderId)) d.folderId = null;
        }
        if (action === 'document-purge') {
          if (!d.deletedAt || data.confirmed !== true)
            throw new Error(
              'Die Datei wird nur nach Bestätigung aus dem Papierkorb endgültig entfernt.',
            );
          index.documents = index.documents.filter((item) => item.id !== d.id);
        }
        if (action === 'document-update') {
          if (d.deletedAt) throw new Error('Das Dokument liegt im Papierkorb.');
          if (data.folderId !== undefined) {
            if (data.folderId && !index.folders.some((f) => f.id === data.folderId))
              throw new Error('Der Zielordner existiert nicht.');
            activeFolder(index.folders,data.folderId);d.folderId = data.folderId;
          }
          if (typeof data.pinned === 'boolean') d.pinned = data.pinned;
          if (Number.isFinite(data.order)) d.order = data.order;
        }
      } else if (action === 'template-save' || action === 'styles-save') {
        const doc = validateDocument(data.document);
        index[action === 'template-save' ? 'templates' : 'styleSets'].push({
          id: randomUUID(),
          name: String(data.name || doc.title).slice(0, 120),
          document: doc,
        });
      } else throw new Error('Diese Bibliotheksaktion ist nicht verfügbar.');
      await this.write(index);
      return index;
    });
  }
  async backup() {
    return this.run(async () => {
      const index = await this.index(),
        documents = [];
      let bytes=Buffer.byteLength(JSON.stringify(index))+1024;
      for(const record of index.documents){const document=await readDocument(this.file(record.storageId));bytes+=Buffer.byteLength(JSON.stringify(document))+256;if(bytes>this.maxBackupBytes)throw new Error('Die Datei für das Bibliotheksbackup überschreitet das Größenlimit (256 MB).');documents.push({storageId:record.storageId,document});}
      const payload = { index, documents };
      return Buffer.from(
        JSON.stringify({
          format: 'WritelyLibraryBackup',
          version: 1,
          createdAt: new Date().toISOString(),
          sha256: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
          payload,
        }),
      );
    });
  }
  async restoreBackup(buffer) {
    // Fully validate before the first write; original paths are never restored as write capabilities.
    if (!Buffer.isBuffer(buffer) || buffer.length > this.maxBackupBytes)
      throw new Error('Die Datei ist kein unterstütztes Backup (maximal 256 MB).');
    let value;
    try {
      value = JSON.parse(buffer.toString('utf8'));
    } catch {
      throw new Error('Die Datei enthält kein lesbares Bibliotheksbackup.');
    }
    if (
      value?.format !== 'WritelyLibraryBackup' ||
      value.version !== 1 ||
      !value.payload ||
      createHash('sha256').update(JSON.stringify(value.payload)).digest('hex') !== value.sha256
    )
      throw new Error('Die Datei ist beschädigt oder kein unterstütztes Bibliotheksbackup.');
    const source = validateIndex(value.payload.index);
    if (
      !Array.isArray(value.payload.documents) ||
      value.payload.documents.length !== source.documents.length
    )
      throw new Error('Die Datei enthält unvollständige Dokumentdaten.');
    const docs = new Map();
    for (const entry of value.payload.documents) {
      if (docs.has(entry.storageId)) throw new Error('Die Datei enthält doppelte Dokumentdaten.');
      docs.set(entry.storageId, validateDocument(entry.document));
    }
    for (const d of source.documents)
      if (docs.get(d.storageId)?.id !== d.id)
        throw new Error('Die Datei enthält unpassende Dokumentdaten.');
    return this.run(async () => {
      const index = await this.index(),
        staged = [],
        folderMap = new Map(source.folders.map((f) => [f.id, randomUUID()])),
        batches=new Map(source.folders.filter(f=>f.trashBatch).map(f=>[f.trashBatch,randomUUID()]));
      try {
        for (const f of source.folders)
          index.folders.push({
            ...f,
            id: folderMap.get(f.id),
            parentId: folderMap.get(f.parentId) || null,
            trashBatch:f.trashBatch?batches.get(f.trashBatch):undefined,
          });
        for (const d of source.documents) {
          const document = structuredClone(docs.get(d.storageId));
          document.id = randomUUID();
          const id = randomUUID();
          staged.push(id);
          await atomicWrite(this.file(id), JSON.stringify(document));
          const record = this.record(
            document,
            { ...d, folderId: folderMap.get(d.folderId) || null, path: undefined,folderTrashBatch:d.folderTrashBatch?batches.get(d.folderTrashBatch):undefined },
            id,
          );
          delete record.path;
          index.documents.push(record);
        }
        for (const key of ['templates', 'styleSets'])
          for (const t of source[key])
            index[key].push({ ...t, id: randomUUID(), document: structuredClone(t.document) });
        await this.write(index);
        return { documents: source.documents.length, folders: source.folders.length };
      } catch (e) {
        for (const id of staged) await fs.rm(this.file(id), { force: true }).catch(() => {});
        throw e;
      }
    });
  }
}
module.exports = { Library, validateIndex };
