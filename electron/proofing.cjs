const { Worker } = require('node:worker_threads');
const fs = require('node:fs/promises');
const path = require('node:path');
const { atomicWrite } = require('./storage.cjs');
const languages = ['de-DE', 'en-US'];
const validWord = (w) =>
  typeof w === 'string' && w.length <= 80 && /^[\p{L}\p{M}]+(?:[’'\-][\p{L}\p{M}]+)*$/u.test(w);
class Proofing {
  constructor(file, root = path.resolve(__dirname, '../dictionaries')) {
    this.file = file;
    this.root = root;
    this.worker = null;
    this.sequence = 0;
    this.pending = new Map();
    this.queue = Promise.resolve();
  }
  language(language) {
    if (!languages.includes(language))
      throw new Error('Die Wörterbuchsprache wird nicht unterstützt.');
    return language;
  }
  async personal() {
    await this.queue;
    try {
      const data = JSON.parse(await fs.readFile(this.file, 'utf8'));
      if (
        data.version !== 1 ||
        !data.words ||
        languages.some(
          (l) =>
            !Array.isArray(data.words[l]) ||
            data.words[l].length > 10000 ||
            data.words[l].some((w) => !validWord(w)),
        )
      )
        throw new Error();
      return data;
    } catch (e) {
      if (e.code === 'ENOENT') return { version: 1, words: { 'de-DE': [], 'en-US': [] } };
      throw new Error('Das Benutzerwörterbuch ist beschädigt. Die Datei bleibt unverändert.');
    }
  }
  async words(language) {
    this.language(language);
    return (await this.personal()).words[language];
  }
  async change(language, word, remove = false) {
    this.language(language);
    if (!validWord(word))
      throw new Error('Das Wörterbuchwort ist ungültig (höchstens 80 Buchstaben).');
    const data = await this.personal();
    const task = this.queue.then(async () => {
      // Re-read under the writer lock to retain concurrent additions.
      let current;
      try {
        current = JSON.parse(await fs.readFile(this.file, 'utf8'));
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
        current = data;
      }
      const values = new Set(current.words[language]);
      if (remove) values.delete(word);
      else values.add(word);
      if (values.size > 10000)
        throw new Error('Das Benutzerwörterbuch enthält bereits 10.000 Wörter.');
      current.words[language] = [...values].sort((a, b) => a.localeCompare(b, language));
      await atomicWrite(this.file, JSON.stringify(current));
      return current.words[language];
    });
    this.queue = task.catch(() => {});
    return task;
  }
  async request(action, language, input) {
    this.language(language);
    if (action === 'check') {
      if (!Array.isArray(input) || input.length > 2000 || input.some((w) => !validWord(w)))
        throw new Error('Die Rechtschreibanfrage ist ungültig.');
    } else if (action !== 'suggest' || !validWord(input) || input.length > 60)
      throw new Error('Die Rechtschreibanfrage ist ungültig.');
    const custom = await this.words(language);
    if (!this.worker) {
      const worker = new Worker(path.join(__dirname, 'spell-worker.cjs').replace(/\.asar([\\/])/ ,'.asar.unpacked$1'), {
        workerData: { root: this.root },
      });
      this.worker = worker;
      worker.on('message', ({ id, result, error }) => {
        const task = this.pending.get(id);
        if (!task) return;
        clearTimeout(task.timer);
        this.pending.delete(id);
        error ? task.reject(new Error(error)) : task.resolve(result);
      });
      const fail = () => {
        if (this.worker === worker) this.worker = null;
        for (const [id, task] of this.pending) {
          if (task.worker !== worker) continue;
          this.pending.delete(id);
          clearTimeout(task.timer);
          task.reject(
            new Error(
              'Die lokale Rechtschreibprüfung wurde abgebrochen. Bitte versuche es erneut.',
            ),
          );
        }
      };
      worker.on('error', fail);
      worker.on('exit', fail);
    }
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Die Wörterbuchprüfung dauert zu lange und wurde beendet.'));
        const worker = this.worker;
        this.worker = null;
        worker?.terminate();
      }, 8000);
      this.pending.set(id, { resolve, reject, timer, worker: this.worker });
      this.worker.postMessage({
        id,
        action,
        language,
        ...(action === 'check' ? { words: input } : { word: input }),
        custom,
      });
    });
  }
  check(language, words) {
    return this.request('check', language, words);
  }
  suggest(language, word) {
    return this.request('suggest', language, word);
  }
  async close() {
    await this.queue;
    const worker = this.worker;
    this.worker = null;
    await worker?.terminate();
  }
}
module.exports = { Proofing, validWord };
