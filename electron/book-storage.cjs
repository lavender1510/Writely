const fs = require("node:fs/promises");
const path = require("node:path");
const { atomicWrite } = require("./storage.cjs");
const {
  bookId,
  blockId,
  parseBookBlock,
  MAX_BOOK_BLOCK,
} = require("../core/book-block-format.mjs");
class BookStorage {
  constructor(root) {
    this.root = root;
    this.queues = new Map();
  }
  file(project, id) {
    if (!bookId(project) || !blockId(id))
      throw new Error("Die Buchblock-Adresse ist ungültig.");
    return path.join(this.root, project, id + ".sealed");
  }
  run(project, job) {
    const previous = this.queues.get(project) || Promise.resolve(),
      next = previous.then(job),
      tail = next.catch(() => {});
    this.queues.set(project, tail);
    void tail.then(() => {
      if (this.queues.get(project) === tail) this.queues.delete(project);
    });
    return next;
  }
  async readFile(project, id) {
    const file = this.file(project, id);
    try {
      const stat = await fs.lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BOOK_BLOCK)
        throw new Error("Der Buchblock ist ungültig oder zu groß.");
      const text = await fs.readFile(file, "utf8");
      parseBookBlock(text, project, id);
      return text;
    } catch (e) {
      if (e.code === "ENOENT") return null;
      throw e;
    }
  }
  read(project, id) {
    this.file(project, id);
    return this.run(project, () => this.readFile(project, id));
  }
  async prepare(project) {
    const directory = path.join(this.root, project);
    await fs.mkdir(directory, { recursive: true });
    if ((await fs.lstat(directory)).isSymbolicLink())
      throw new Error(
        "Ein Buchordner darf keine symbolische Verknüpfung sein.",
      );
  }
  writeNew(project, id, text) {
    parseBookBlock(text, project, id);
    if (id === "manifest")
      throw new Error("Ein Manifest benötigt einen geprüften Versionswechsel.");
    return this.run(project, async () => {
      await this.prepare(project);
      const file = this.file(project, id);
      const exists = await fs.lstat(file).then(
        () => true,
        (e) => {
          if (e.code === "ENOENT") return false;
          throw e;
        },
      );
      if (exists) throw new Error("Dieser Buchblock ist bereits vorhanden.");
      await atomicWrite(file, text);
    });
  }
  compareAndSwap(project, text, expected, required = []) {
    parseBookBlock(text, project, "manifest");
    if (
      !Array.isArray(required) ||
      required.length > 30001 ||
      required.some((id) => !bookId(id))
    )
      throw new Error("Die Buchblock-Liste ist ungültig.");
    if (
      expected !== null &&
      (typeof expected !== "string" || expected.length > MAX_BOOK_BLOCK)
    )
      throw new Error("Die Buchversion ist ungültig.");
    return this.run(project, async () => {
      const current = await this.readFile(project, "manifest");
      if (current !== expected)
        throw new Error(
          "Das Buch wurde zwischenzeitlich geändert. Öffne es erneut, bevor du speicherst.",
        );
      const entries = required.length
        ? await fs
            .readdir(path.join(this.root, project), { withFileTypes: true })
            .catch((e) => {
              if (e.code === "ENOENT") return [];
              throw e;
            })
        : [];
      const existing = new Set(
        entries.filter((e) => e.isFile()).map((e) => e.name),
      );
      for (const id of required)
        if (!existing.has(id + ".sealed"))
          throw new Error(
            "Ein benötigter Buchblock fehlt. Der vorherige Stand bleibt erhalten.",
          );
      await this.prepare(project);
      await atomicWrite(this.file(project, "manifest"), text);
    });
  }
  collect(project, expected, keep, cutoff) {
    this.file(project, "manifest");
    if (
      !Array.isArray(keep) ||
      keep.length > 30001 ||
      keep.some((id) => !bookId(id)) ||
      !Number.isFinite(cutoff)
    )
      throw new Error("Die Buchbereinigung ist ungültig.");
    return this.run(project, async () => {
      if ((await this.readFile(project, "manifest")) !== expected) return 0;
      const ids = new Set(["manifest", ...keep]),
        names = await fs.readdir(path.join(this.root, project));
      let count = 0;
      for (const name of names) {
        const id = name.replace(/\.sealed$/, "");
        if (name !== id + ".sealed" || !bookId(id) || ids.has(id)) continue;
        const file = this.file(project, id),
          stat = await fs.lstat(file);
        if (stat.isFile() && stat.mtimeMs < cutoff && count < 200) {
          await fs.rm(file);
          count++;
        }
      }
      return count;
    });
  }
  list(project) {
    this.file(project, "manifest");
    return this.run(project, async () => {
      const names = await fs
          .readdir(path.join(this.root, project))
          .catch((e) => {
            if (e.code === "ENOENT") return [];
            throw e;
          }),
        items = [];
      for (const name of names) {
        const id = name.replace(/\.sealed$/, "");
        if (name !== id + ".sealed" || !blockId(id)) continue;
        const stat = await fs.lstat(this.file(project, id));
        if (!stat.isFile() || stat.isSymbolicLink())
          throw new Error("Ein Buchblock ist ungültig.");
        items.push({ id, modifiedAt: stat.mtimeMs });
      }
      return items;
    });
  }
  async projects() {
    const names = await fs.readdir(this.root).catch((e) => {
      if (e.code === "ENOENT") return [];
      throw e;
    });
    const result = [];
    for (const id of names)
      if (bookId(id)) {
        const stat = await fs.lstat(path.join(this.root, id));
        if (stat.isDirectory() && !stat.isSymbolicLink())
          result.push({ id, modifiedAt: stat.mtimeMs });
      }
    return result;
  }
  removeProject(project) {
    this.file(project, "manifest");
    return this.run(project, async () => {
      const directory = path.join(this.root, project),
        stat = await fs.lstat(directory).catch((e) => {
          if (e.code === "ENOENT") return null;
          throw e;
        });
      if (!stat) return;
      if (!stat.isDirectory() || stat.isSymbolicLink())
        throw new Error("Der Buchordner ist ungültig.");
      const names = await fs.readdir(directory);
      for (const name of names) {
        const id = name.replace(/\.sealed(?:\.\d+\.[a-f0-9]+\.tmp)?$/, "");
        if (!blockId(id))
          throw new Error(
            "Der Buchordner enthält unbekannte Dateien und bleibt erhalten.",
          );
      }
      await fs.rm(directory, { recursive: true, force: true });
    });
  }
  remove(project, id) {
    const file = this.file(project, id);
    return this.run(project, () => fs.rm(file, { force: true }));
  }
}
module.exports = { BookStorage };
