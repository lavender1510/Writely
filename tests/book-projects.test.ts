import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BookRepository } from "../core/book-repository";
import { newBook, validateBook } from "../core/book-model";
import { newBookKey, sealBookBlock, openBookBlock } from "../core/book-crypto";
import type { BookBlockStorage } from "../core/book-types";
class MemoryBlocks implements BookBlockStorage {
  values = new Map<string, { text: string; modifiedAt: number }>();
  reads: string[] = [];
  failCommit = false;
  async read(p: string, id: string) {
    this.reads.push(id);
    return this.values.get(p + "/" + id)?.text ?? null;
  }
  async writeNew(p: string, id: string, text: string) {
    const key = p + "/" + id;
    if (this.values.has(key)) throw new Error("bereits vorhanden");
    this.values.set(key, { text, modifiedAt: Date.now() });
  }
  async compareAndSwap(p: string, text: string, expected: string | null) {
    if (this.failCommit) throw new Error("ENOSPC");
    if ((this.values.get(p + "/manifest")?.text ?? null) !== expected)
      throw new Error("zwischenzeitlich geändert");
    this.values.set(p + "/manifest", { text, modifiedAt: Date.now() });
  }
  async list(p: string) {
    return [...this.values]
      .filter(([id]) => id.startsWith(p + "/"))
      .map(([id, v]) => ({ id: id.split("/")[1], modifiedAt: v.modifiedAt }));
  }
  async remove(p: string, id: string) {
    this.values.delete(p + "/" + id);
  }
}
test("book blocks authenticate project, identity, payload and nonce with independent random nonces", async () => {
  const key = newBookKey(),
    p = crypto.randomUUID(),
    id = crypto.randomUUID();
  const a = await sealBookBlock(key, p, id, { text: "Größe 🪶 privat" }),
    b = await sealBookBlock(key, p, id, { text: "Größe 🪶 privat" });
  assert.notEqual(JSON.parse(a).nonce, JSON.parse(b).nonce);
  assert.deepEqual(await openBookBlock(key, p, id, a), {
    text: "Größe 🪶 privat",
  });
  assert.ok(!a.includes("privat"));
  await assert.rejects(
    openBookBlock(newBookKey(), p, id, a),
    /authentifiziert/,
  );
  await assert.rejects(
    openBookBlock(key, crypto.randomUUID(), id, a),
    /anderen Projekt/,
  );
  const altered = JSON.parse(a);
  altered.ciphertext =
    (altered.ciphertext[0] === "A" ? "B" : "A") + altered.ciphertext.slice(1);
  await assert.rejects(
    openBookBlock(key, p, id, JSON.stringify(altered)),
    /authentifiziert/,
  );
  key.fill(0);
});
test("chapter saves touch only their immutable block and manifest, retain rich content and roll back failed commits", async () => {
  const storage = new MemoryBlocks(),
    r = await BookRepository.create(storage, "Geheimes Buch"),
    chapter = await r.createNode("chapter", "Kapitel 1"),
    second = await r.createNode("scene", "Szene 2", chapter);
  const originalSecond = r.data().nodes.find((n) => n.id === second)!.document!
    .blockId;
  const d = await r.readDocument(chapter);
  d.content.content = [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Grüße Straße 🪶", marks: [{ type: "bold" }] },
      ],
    },
  ];
  d.title = "Neuer Kapitelname";
  await r.putDocument(d);
  assert.deepEqual((await r.readDocument(chapter)).content, d.content);
  assert.equal(
    r.data().nodes.find((n) => n.id === second)!.document!.blockId,
    originalSecond,
  );
  const before = JSON.stringify(r.data()),
    keys = [...storage.values.keys()];
  storage.failCommit = true;
  await assert.rejects(r.putDocument({ ...d, title: "Verloren?" }), /ENOSPC/);
  assert.equal(JSON.stringify(r.data()), before);
  assert.deepEqual([...storage.values.keys()], keys);
  storage.failCommit = false;
  assert.ok(
    [...storage.values.values()].every(
      (v) => !v.text.includes("Geheimes Buch") && !v.text.includes("Grüße"),
    ),
  );
  await r.close();
  await assert.rejects(r.readDocument(chapter), /gesperrt/);
  assert.throws(() => r.data(), /gesperrt/);
});
test("opening a 100-chapter project reads only its manifest and then the selected chapter", async () => {
  const storage = new MemoryBlocks(),
    r = await BookRepository.create(storage, "100 Kapitel");
  let last = "";
  for (let i = 0; i < 100; i++)
    last = await r.createNode("chapter", "Kapitel " + i);
  const ref = r.reference();
  await r.close();
  storage.reads = [];
  const opened = await BookRepository.open(storage, ref);
  assert.deepEqual(storage.reads, ["manifest"]);
  await opened.readDocument(last);
  assert.equal(storage.reads.length, 2);
  await opened.close();
});
test("concurrent sessions detect manifest conflicts instead of overwriting and remove only staged blocks", async () => {
  const storage = new MemoryBlocks(),
    a = await BookRepository.create(storage, "Parallel"),
    id = await a.createNode("chapter", "Kapitel"),
    b = await BookRepository.open(storage, a.reference());
  const da = await a.readDocument(id),
    db = await b.readDocument(id);
  da.title = "Von A";
  await a.putDocument(da);
  const keys = [...storage.values.keys()];
  db.title = "Von B";
  await assert.rejects(b.putDocument(db), /zwischenzeitlich/);
  assert.deepEqual([...storage.values.keys()], keys);
  assert.equal((await a.readDocument(id)).title, "Von A");
  await a.close();
  await b.close();
});
test("hierarchy, duplicate, older trash and history restoration preserve relationships and current snapshots", async () => {
  const storage = new MemoryBlocks(),
    r = await BookRepository.create(storage, "Roman"),
    part = await r.createNode("part", "Teil 1"),
    chapter = await r.createNode("chapter", "Kapitel", part),
    scene = await r.createNode("scene", "Szene", chapter);
  await assert.rejects(r.moveNode(part, scene, 0), /ungültige/);
  const d = await r.readDocument(scene);
  d.title = "Erster Titel";
  d.content.content = [
    { type: "paragraph", content: [{ type: "text", text: "Erster Text" }] },
  ];
  await r.putDocument(d);
  d.title = "Aktueller Titel";
  await r.putDocument(d);
  await r.restoreVersion(scene, 0);
  assert.equal((await r.previewVersion(scene, 0)).title, "Aktueller Titel");
  const copy = await r.duplicateNode(chapter);
  assert.notEqual(copy, chapter);
  assert.equal(r.data().nodes.filter((n) => n.parentId === copy).length, 1);
  await r.trashNode(scene);
  await r.trashNode(part);
  await r.restoreNode(part);
  assert.ok(r.data().nodes.find((n) => n.id === scene)!.deletedAt);
  assert.equal(
    r.data().nodes.find((n) => n.id === chapter)!.deletedAt,
    undefined,
  );
  await r.close();
});
test("book archives authenticate all blocks before writing and import without ID/key collisions or source changes", async () => {
  const storage = new MemoryBlocks(),
    a = await BookRepository.create(storage, "Privates Buch"),
    id = await a.createNode("chapter", "Grüße"),
    d = await a.readDocument(id);
  d.content.content = [
    { type: "paragraph", content: [{ type: "text", text: "Privater Inhalt" }] },
  ];
  await a.putDocument(d);
  const archive = await a.snapshot(),
    before = JSON.stringify(a.data()),
    bad = structuredClone(archive);
  bad.blocks.find((b) => b.id !== "manifest")!.text = "{}";
  const size = storage.values.size;
  await assert.rejects(BookRepository.importArchive(storage, bad));
  assert.equal(storage.values.size, size);
  const b = await BookRepository.importArchive(storage, archive);
  assert.notEqual(a.data().id, b.data().id);
  assert.notEqual(a.reference().key, b.reference().key);
  assert.deepEqual((await b.readDocument(id)).content, d.content);
  assert.equal(JSON.stringify(a.data()), before);
  await a.close();
  await b.close();
});
test("native book storage rejects traversal/plaintext and serializes competing manifest commits", async (t) => {
  const { BookStorage } = createRequire(import.meta.url)(
    "../electron/book-storage.cjs",
  );
  const root = await mkdtemp(join(tmpdir(), "writely-book-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const storage = new BookStorage(root),
    p = crypto.randomUUID(),
    k = newBookKey();
  assert.throws(() => storage.read("../bad", "manifest"), /Adresse/);
  assert.throws(
    () => storage.writeNew(p, crypto.randomUUID(), "private text"),
    /kein gültiges JSON/,
  );
  const first = await sealBookBlock(k, p, "manifest", newBook()),
    nextA = await sealBookBlock(k, p, "manifest", { test: "A" }),
    nextB = await sealBookBlock(k, p, "manifest", { test: "B" });
  await storage.compareAndSwap(p, first, null);
  const results = await Promise.allSettled([
    storage.compareAndSwap(p, nextA, first),
    storage.compareAndSwap(p, nextB, first),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(await storage.read(p, "manifest"), nextA);
  k.fill(0);
});
test("unknown future book schema, orphan parents and malformed custom statuses fail before editing", () => {
  const p = newBook();
  assert.throws(() => validateBook({ ...p, schemaVersion: 99 }), /ungültige/);
  p.statuses[0].color = "javascript:bad";
  assert.throws(() => validateBook(p), /ungültige/);
});
test("vault book edits avoid rewriting root payload, survive lock/rekey and export only ciphertext bundles", async () => {
  const { Vault } = await import("../core/vault");
  let root: string | null = null,
    writes = 0;
  const storage = {
      read: async () => root,
      write: async (s: string) => {
        root = s;
        writes++;
      },
    },
    blocks = new MemoryBlocks(),
    v = new Vault(storage, blocks),
    password = "Ein sicheres Buchkennwort 2026";
  await v.create(password);
  const id = await v.createBook("Privater Roman", {
      author: "Geheime Autorin",
    }),
    repo = await v.openBook(id),
    chapter = await repo.createNode("chapter", "Geheimes Kapitel"),
    d = await repo.readDocument(chapter),
    before = root,
    count = writes;
  d.content.content = [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Privater Manuskripttext" }],
    },
  ];
  await repo.putDocument(d);
  assert.equal(root, before);
  assert.equal(writes, count);
  const backup = await v.backup();
  assert.equal(JSON.parse(backup).format, "WritelyVaultBundle");
  for (const text of [
    "Privater Roman",
    "Geheime Autorin",
    "Geheimes Kapitel",
    "Privater Manuskripttext",
    repo.reference().key,
  ])
    assert.ok(!backup.includes(text), text);
  await v.rekey(password, password + " neu");
  await v.lock();
  assert.throws(() => repo.data(), /gesperrt/);
  await assert.rejects(v.unlock(password));
  await v.unlock(password + " neu");
  const again = await v.openBook(id);
  assert.deepEqual((await again.readDocument(chapter)).content, d.content);
  await v.lock();
});
test("vault book backup imports remap projects, preserve source and reject corruption without partial commit", async () => {
  const { Vault } = await import("../core/vault");
  let root: string | null = null;
  const blocks = new MemoryBlocks(),
    v = new Vault(
      {
        read: async () => root,
        write: async (s) => {
          root = s;
        },
      },
      blocks,
    ),
    password = "Ein sicheres Buchkennwort 2026";
  await v.create(password);
  const id = await v.createBook("Roman"),
    repo = await v.openBook(id),
    chapter = await repo.createNode("chapter", "Kapitel");
  const d = await repo.readDocument(chapter);
  d.content.content = [
    { type: "paragraph", content: [{ type: "text", text: "Größe Straße 🎉" }] },
  ];
  await repo.putDocument(d);
  const backup = await v.backup();
  await v.importBackup(backup, password);
  assert.equal(v.data().books!.length, 2);
  const imported = v.data().books!.find((r) => r.id !== id)!;
  assert.notEqual(imported.key, repo.reference().key);
  assert.deepEqual(
    (await (await v.openBook(imported.id)).readDocument(chapter)).content,
    d.content,
  );
  const bad = JSON.parse(backup);
  bad.blocks.find((b: any) => b.id !== "manifest").text = "{}";
  const previous = root,
    size = blocks.values.size;
  await assert.rejects(v.importBackup(JSON.stringify(bad), password));
  assert.equal(root, previous);
  assert.equal(blocks.values.size, size);
  await v.lock();
});
test("root commit failures remove staged new book files and never register an incomplete project", async () => {
  const { Vault } = await import("../core/vault");
  let root: string | null = null,
    fail = false;
  const blocks = new MemoryBlocks(),
    v = new Vault(
      {
        read: async () => root,
        write: async (s) => {
          if (fail) throw new Error("ENOSPC");
          root = s;
        },
      },
      blocks,
    );
  await v.create("Ein sicheres Buchkennwort 2026");
  const previous = root;
  fail = true;
  await assert.rejects(v.createBook("Nicht gespeichert"), /ENOSPC/);
  assert.equal(root, previous);
  assert.equal(v.data().books, undefined);
  assert.equal(blocks.values.size, 0);
  await v.lock();
});
test("covers are encrypted separate blocks and survive validated backup import", async () => {
  const storage = new MemoryBlocks(),
    repo = await BookRepository.create(storage, "Coverbuch"),
    src =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZ0AAAAASUVORK5CYII=";
  await repo.updateMetadata({ subtitle: "Grüße" }, { src, alt: "Mein Cover" });
  assert.equal(await repo.readCover(), src);
  const archive = await repo.snapshot(),
    copy = await BookRepository.importArchive(storage, archive);
  assert.equal(await copy.readCover(), src);
  await assert.rejects(
    repo.updateMetadata(
      {},
      { src: "data:image/svg+xml;base64,PHN2Zz4=", alt: "Unsicher" },
    ),
    /ungültige/,
  );
  assert.equal(await repo.readCover(), src);
  await repo.close();
  await copy.close();
});
test("native root CAS prevents a stale workspace from erasing newly registered book references", async (t) => {
  const require = createRequire(import.meta.url),
    { SealedStorage } = require("../electron/sealed-storage.cjs"),
    { BookStorage } = require("../electron/book-storage.cjs"),
    { Vault } = await import("../core/vault");
  const root = await mkdtemp(join(tmpdir(), "writely-book-cas-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const storage = new SealedStorage(join(root, "sealed")),
    blocks = new BookStorage(join(root, "books")),
    a = new Vault(storage, blocks),
    b = new Vault(storage, blocks),
    password = "Ein sicheres Buchkennwort 2026";
  await a.create(password);
  await b.unlock(password);
  const id = await a.createBook("Nicht überschreiben");
  const committed = await storage.read();
  await assert.rejects(b.folder("Veralteter Schreibstand"), /zwischenzeitlich/);
  assert.equal(await storage.read(), committed);
  await b.lock();
  await b.unlock(password);
  assert.equal(b.data().books![0].id, id);
  await a.lock();
  await b.lock();
});
test("fenced native garbage collection retains current/history and commit refuses a missing staged block", async (t) => {
  const { utimes } = await import("node:fs/promises"),
    { unbase64 } = await import("../core/crypto"),
    { BookStorage } = createRequire(import.meta.url)(
      "../electron/book-storage.cjs",
    );
  const root = await mkdtemp(join(tmpdir(), "writely-book-gc-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const storage = new BookStorage(root),
    repo = await BookRepository.create(storage, "Bereinigung"),
    id = await repo.createNode("chapter", "Kapitel"),
    ref = repo.reference(),
    p = ref.id,
    key = unbase64(ref.key);
  const d = await repo.readDocument(id);
  await repo.putDocument({ ...d, title: "Erster Stand" });
  await repo.captureVersion(id, "Behalten");
  await repo.putDocument({ ...d, title: "Zweiter Stand" });
  const orphan = crypto.randomUUID();
  await storage.writeNew(
    p,
    orphan,
    await sealBookBlock(key, p, orphan, { temporary: true }),
  );
  await utimes(storage.file(p, orphan), new Date(0), new Date(0));
  const committed = await storage.read(p, "manifest");
  assert.equal(await storage.collect(p, "stale", [], Date.now()), 0);
  assert.ok(await storage.read(p, orphan));
  await repo.collectOrphans();
  assert.equal(await storage.read(p, orphan), null);
  assert.equal((await repo.previewVersion(id, 0)).title, "Erster Stand");
  assert.equal((await repo.readDocument(id)).title, "Zweiter Stand");
  const next = await sealBookBlock(key, p, "manifest", {
    ...repo.data(),
    revision: repo.data().revision + 1,
  });
  await assert.rejects(
    storage.compareAndSwap(p, next, committed, [orphan]),
    /benötigter Buchblock fehlt/,
  );
  assert.equal(await storage.read(p, "manifest"), committed);
  key.fill(0);
  await repo.close();
});
test("unknown book extension fields are rejected before a writer can garbage-collect unknown references", () => {
  const p: any = newBook();
  p.futureAssets = [crypto.randomUUID()];
  assert.throws(() => validateBook(p), /ungültige/);
});
test("an untitled chapter still autosaves its body instead of losing text on a title validation error", async () => {
  const storage = new MemoryBlocks(),
    repo = await BookRepository.create(storage, "Roman"),
    id = await repo.createNode("chapter", "Kapitel"),
    d = await repo.readDocument(id);
  d.title = "";
  d.content.content = [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Dieser Text bleibt auch ohne Titel erhalten." },
      ],
    },
  ];
  await repo.putDocument(d);
  assert.deepEqual((await repo.readDocument(id)).content, d.content);
  assert.equal((await repo.readDocument(id)).title, "");
  await repo.close();
});
test('moving visible chapters counts only active siblings and preserves independently trashed entries',async()=>{const {bookManuscriptNodes}=await import('../core/book-model'),storage=new MemoryBlocks(),repo=await BookRepository.create(storage,'Reihenfolge'),a=await repo.createNode('chapter','A'),hidden=await repo.createNode('chapter','Gelöscht'),b=await repo.createNode('chapter','B');await repo.trashNode(hidden);await repo.moveNode(a,null,1);assert.deepEqual(bookManuscriptNodes(repo.data()).map(n=>n.title),['B','A']);await repo.restoreNode(hidden);assert.deepEqual(bookManuscriptNodes(repo.data()).map(n=>n.title),['Gelöscht','B','A']);assert.ok(repo.data().nodes.find(n=>n.id===b));await repo.close();});
