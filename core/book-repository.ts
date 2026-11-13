import { base64, unbase64 } from "./crypto";
import { newBookKey, sealBookBlock, openBookBlock } from "./book-crypto";
import {
  newBook,
  validateBook,
  validateBookReference,
  validateBookCover,
  bookDescendants,
  bookBlockIds,
} from "./book-model";
import { createDocument, documentStats } from "./document";
import { validateDocument } from "./validation.mjs";
import { migrateDocument } from "./document-schema.mjs";
import { bookId } from "./book-block-format.mjs";
import type { DocumentFile } from "./types";
import type {
  BookProject,
  BookReference,
  BookNode,
  BookNodeKind,
  BookBlockStorage,
  BookArchive,
  BookMetadata,
} from "./book-types";
/** Each save writes one immutable document and a small authenticated manifest.
 * The manifest CAS is the commit point. No chapter content is cached in this repository. */
export class BookRepository {
  private queue: Promise<unknown> = Promise.resolve();
  private closing = false;
  private closed = false;
  private lastCleanup = 0;
  private warningValue = "";
  private constructor(
    private storage: BookBlockStorage,
    private referenceValue: BookReference,
    private secret: Uint8Array,
    private project: BookProject | null,
    private expected: string,
  ) {}
  static async create(storage: BookBlockStorage, title: string) {
    const p = validateBook(newBook(title)),
      secret = newBookKey();
    const reference = {
      id: p.id,
      title: p.title,
      key: base64(secret),
      createdAt: p.createdAt,
    };
    try {
      const text = await sealBookBlock(secret, p.id, "manifest", p);
      await storage.compareAndSwap(p.id, text, null);
      return new BookRepository(storage, reference, secret, p, text);
    } catch (e) {
      secret.fill(0);
      throw e;
    }
  }
  static async open(storage: BookBlockStorage, reference: BookReference) {
    validateBookReference(reference);
    const secret = unbase64(reference.key);
    try {
      const text = await storage.read(reference.id, "manifest");
      if (!text)
        throw new Error(
          "Das Projektmanifest fehlt. Das Buch wird nicht durch ein leeres Projekt ersetzt.",
        );
      const p = validateBook(
        await openBookBlock(secret, reference.id, "manifest", text),
      );
      if (p.id !== reference.id)
        throw new Error("Die Projektzuordnung ist ungültig.");
      return new BookRepository(
        storage,
        structuredClone(reference),
        secret,
        p,
        text,
      );
    } catch (e) {
      secret.fill(0);
      throw e;
    }
  }
  reference() {
    this.state();
    return {
      ...this.referenceValue,
      title: this.project!.title,
      color: this.project!.color,
    };
  }
  data() {
    return structuredClone(this.state());
  }
  warning() {
    return this.warningValue;
  }
  private state() {
    if (this.closed || !this.project)
      throw new Error("Das Buchprojekt ist gesperrt.");
    return this.project;
  }
  private exclusive<T>(job: () => Promise<T>): Promise<T> {
    if (this.closing || this.closed)
      return Promise.reject(new Error("Das Buchprojekt ist gesperrt."));
    const next = this.queue.then(job);
    this.queue = next.catch(() => {});
    return next;
  }
  private change<T>(
    action: (
      p: BookProject,
      write: (d: DocumentFile) => Promise<string>,
      writeData: (data: unknown) => Promise<string>,
    ) => Promise<T> | T,
  ) {
    return this.exclusive(async () => {
      const p = structuredClone(this.state()),
        staged: string[] = [];
      const writeData = async (d: unknown) => {
        const id = crypto.randomUUID(),
          text = await sealBookBlock(this.secret, p.id, id, d);
        await this.storage.writeNew(p.id, id, text);
        staged.push(id);
        return id;
      };
      const write = (d: DocumentFile) => {
        validateDocument(d);
        return writeData(d);
      };
      try {
        const result = await action(p, write, writeData);
        p.revision++;
        p.updatedAt = new Date().toISOString();
        validateBook(p);
        const text = await sealBookBlock(this.secret, p.id, "manifest", p);
        await this.storage.compareAndSwap(
          p.id,
          text,
          this.expected,
          bookBlockIds(p),
        );
        this.project = p;
        this.expected = text;
        if (this.storage.collect && Date.now() - this.lastCleanup > 3000) {
          this.lastCleanup = Date.now();
          try {
            await this.storage.collect(
              p.id,
              text,
              bookBlockIds(p),
              Date.now() - 2000,
            );
            this.warningValue = "";
          } catch {
            this.warningValue =
              "Der Text wurde gespeichert, ältere unbenutzte Buchblöcke konnten aber noch nicht bereinigt werden.";
          }
        }
        return result;
      } catch (e) {
        for (const id of staged)
          await this.storage.remove(p.id, id).catch(() => {});
        throw e;
      }
    });
  }
  private node(p: BookProject, id: string, active = true) {
    const n = p.nodes.find((n) => n.id === id);
    if (!n || (active && n.deletedAt))
      throw new Error("Der Eintrag fehlt oder liegt im Projektpapierkorb.");
    return n;
  }
  private async load(node: BookNode, id: string) {
    const p = this.state(),
      text = await this.storage.read(p.id, id);
    if (!text)
      throw new Error(
        "Ein Kapitelblock fehlt. Der gespeicherte Stand wird nicht überschrieben.",
      );
    const d = validateDocument(
      await openBookBlock(this.secret, p.id, id, text),
    ) as DocumentFile;
    if (
      id === node.document?.blockId &&
      documentStats(d.content).words !== node.document.words
    )
      throw new Error(
        "Die Kapitelstatistik stimmt nicht mit dem gespeicherten Text überein.",
      );
    if (d.id !== node.id)
      throw new Error("Der Kapitelblock gehört zu einem anderen Eintrag.");
    return structuredClone(d);
  }
  readDocument(id: string) {
    return this.exclusive(async () => {
      const n = this.node(this.state(), id);
      if (!n.document)
        throw new Error("Dieser Gliederungseintrag enthält kein Dokument.");
      const d = await this.load(n, n.document.blockId);
      return { ...d, title: n.title, updatedAt: n.document.updatedAt };
    });
  }
  createNode(
    kind: BookNodeKind,
    title: string,
    parentId: string | null = null,
    initial: Partial<
      Pick<BookNode, "synopsis" | "notes" | "color" | "statusId">
    > = {},
  ) {
    const id = crypto.randomUUID();
    return this.change(async (p, write) => {
      if (parentId) this.node(p, parentId);
      const now = new Date().toISOString(),
        n: BookNode = {
          id,
          parentId,
          kind,
          title,
          order:
            Math.max(
              -1,
              ...p.nodes
                .filter((n) => n.parentId === parentId)
                .map((n) => n.order),
            ) + 1,
          synopsis: initial.synopsis ?? "",
          notes: initial.notes ?? "",
          color: initial.color ?? p.color,
          statusId: initial.statusId ?? p.statuses[0].id,
        };
      if (kind === "chapter" || kind === "scene") {
        const d = createDocument("blank");
        d.id = id;
        d.title = title;
        d.proofing = {
          language: p.language.startsWith("en") ? "en-US" : "de-DE",
          enabled: /^(de|en)(-|$)/.test(p.language),
        };
        n.document = {
          blockId: await write(d),
          words: 0,
          updatedAt: now,
          history: [],
        };
      }
      p.nodes.push(n);
      return id;
    });
  }
  putDocument(document: DocumentFile) {
    const d = structuredClone(
      validateDocument(migrateDocument(document)),
    ) as DocumentFile;
    return this.change(async (p, write) => {
      const n = this.node(p, d.id),
        slot = n.document;
      if (!slot) throw new Error("Dieser Eintrag ist kein Manuskripttext.");
      const now = new Date().toISOString(),
        history = [...slot.history];
      if (
        !history.length ||
        Date.now() - Date.parse(history[0].capturedAt) >= 60000
      )
        history.unshift({
          blockId: slot.blockId,
          capturedAt: now,
          title: n.title,
        });
      n.document = {
        blockId: await write(d),
        words: documentStats(d.content).words,
        updatedAt: now,
        history: history.slice(0, 5),
      };
      n.title = d.title;
      p.lastNodeId = n.id;
    });
  }
  updateNode(
    id: string,
    patch: Partial<
      Pick<BookNode, "title" | "synopsis" | "notes" | "color" | "statusId">
    >,
    parentId?: string | null,
  ) {
    return this.change((p) => {
      const n = this.node(p, id);
      if (parentId !== undefined && parentId !== n.parentId) {
        if (parentId) this.node(p, parentId);
        n.parentId = parentId;
        n.order =
          Math.max(
            -1,
            ...p.nodes
              .filter((x) => x.id !== id && x.parentId === parentId)
              .map((n) => n.order),
          ) + 1;
      }
      for (const k of [
        "title",
        "synopsis",
        "notes",
        "color",
        "statusId",
      ] as const)
        if (patch[k] !== undefined) n[k] = patch[k]!;
    });
  }
  updateMetadata(
    patch: Partial<BookMetadata>,
    cover?: { src: string; alt: string } | null,
  ) {
    return this.change(async (p, _write, writeData) => {
      for (const k of [
        "title",
        "subtitle",
        "author",
        "pseudonym",
        "genre",
        "language",
        "description",
        "notes",
        "series",
        "goalWords",
        "color",
      ] as const)
        if (patch[k] !== undefined) (p as any)[k] = patch[k];
      if (cover === null) delete p.cover;
      else if (cover) {
        const mime = /^data:([^;]+);base64,/.exec(cover.src)?.[1] || "",
          payload = validateBookCover({
            format: "WritelyBookCover",
            schemaVersion: 1,
            mime,
            src: cover.src,
            alt: cover.alt,
          });
        p.cover = { blockId: await writeData(payload), mime, alt: cover.alt };
      }
    });
  }
  readCover() {
    return this.exclusive(async () => {
      const p = this.state();
      if (!p.cover) return null;
      const text = await this.storage.read(p.id, p.cover.blockId);
      if (!text) throw new Error("Das Buchcover fehlt.");
      return validateBookCover(
        await openBookBlock(this.secret, p.id, p.cover.blockId, text),
      ).src;
    });
  }
  saveStatus(id: string | null, label: string, color: string) {
    return this.change((p) => {
      if (id) {
        const s = p.statuses.find((s) => s.id === id);
        if (!s) throw new Error("Der Status fehlt.");
        s.label = label;
        s.color = color;
      } else p.statuses.push({ id: crypto.randomUUID(), label, color });
    });
  }
  moveNode(id: string, parentId: string | null, index: number) {
    return this.change((p) => {
      const n = this.node(p, id);
      if (parentId) this.node(p, parentId);
      if (!Number.isInteger(index) || index < 0 || index > p.nodes.length)
        throw new Error("Die Zielposition ist ungültig.");
      const oldParent = n.parentId;
      n.parentId = parentId;
      const siblings = p.nodes
        .filter((x) => x.id !== id && x.parentId === parentId)
        .sort((a, b) => a.order - b.order);
      const active=siblings.filter(x=>!x.deletedAt),target=active[index];
      const insertion=target?siblings.findIndex(x=>x.id===target.id):siblings.length;
      siblings.splice(insertion,0,n);
      siblings.forEach((x, i) => (x.order = i));
      if (oldParent !== parentId)
        p.nodes
          .filter((x) => x.parentId === oldParent)
          .sort((a, b) => a.order - b.order)
          .forEach((x, i) => (x.order = i));
    });
  }
  trashNode(id: string) {
    return this.change((p) => {
      this.node(p, id);
      const ids = bookDescendants(p, id),
        batch = crypto.randomUUID(),
        now = new Date().toISOString();
      for (const n of p.nodes)
        if (ids.has(n.id) && !n.deletedAt) {
          n.deletedAt = now;
          n.trashBatch = batch;
        }
      if (p.lastNodeId && ids.has(p.lastNodeId)) p.lastNodeId = null;
    });
  }
  restoreNode(id: string) {
    return this.change((p) => {
      const node = this.node(p, id, false);
      if (!node.deletedAt || !node.trashBatch)
        throw new Error("Der Eintrag liegt nicht im Projektpapierkorb.");
      const batch = node.trashBatch;
      for (const n of p.nodes)
        if (n.trashBatch === batch) {
          delete n.trashBatch;
          delete n.deletedAt;
        }
    });
  }
  duplicateNode(id: string) {
    return this.change(async (p, write) => {
      const source = this.node(p, id),
        ids = bookDescendants(p, id),
        nodes = p.nodes.filter((n) => ids.has(n.id) && !n.deletedAt),
        mapping = new Map(nodes.map((n) => [n.id, crypto.randomUUID()]));
      for (const old of nodes) {
        const n = structuredClone(old);
        n.id = mapping.get(old.id)!;
        n.parentId = old.id === id ? old.parentId : mapping.get(old.parentId!)!;
        if (old.id === id) {
          n.title = n.title.length + 8 <= 500 ? n.title + " – Kopie" : n.title;
          n.order =
            Math.max(
              -1,
              ...p.nodes
                .filter((x) => x.parentId === source.parentId)
                .map((n) => n.order),
            ) + 1;
        }
        if (old.document) {
          const d = await this.load(old, old.document.blockId);
          d.id = n.id;
          d.title = n.title;
          d.createdAt = d.updatedAt = new Date().toISOString();
          n.document = {
            blockId: await write(d),
            words: old.document.words,
            updatedAt: d.updatedAt,
            history: [],
          };
        }
        p.nodes.push(n);
      }
      return mapping.get(id)!;
    });
  }
  captureVersion(id: string, label: string) {
    return this.change((p) => {
      if (typeof label !== "string" || !label.trim() || label.length > 120)
        throw new Error("Der Sicherungsname muss 1 bis 120 Zeichen enthalten.");
      const n = this.node(p, id);
      if (!n.document) throw new Error("Dieser Eintrag enthält keinen Text.");
      n.document.history = [
        {
          blockId: n.document.blockId,
          capturedAt: new Date().toISOString(),
          title: n.title,
          label: label.trim(),
        },
        ...n.document.history,
      ].slice(0, 5);
    });
  }
  previewVersion(id: string, index: number) {
    return this.exclusive(async () => {
      const n = this.node(this.state(), id),
        h = n.document?.history[index];
      if (!h) throw new Error("Diese Kapitelversion fehlt.");
      const d = await this.load(n, h.blockId);
      return { ...d, title: h.title };
    });
  }
  restoreVersion(id: string, index: number) {
    return this.change(async (p) => {
      const n = this.node(p, id),
        slot = n.document,
        h = slot?.history[index];
      if (!slot || !h) throw new Error("Diese Kapitelversion fehlt.");
      const d = await this.load(n, h.blockId),
        now = new Date().toISOString(),
        previousTitle = n.title;
      n.title = h.title;
      n.document = {
        blockId: h.blockId,
        words: documentStats(d.content).words,
        updatedAt: now,
        history: [
          { blockId: slot.blockId, capturedAt: now, title: previousTitle },
          ...slot.history,
        ].slice(0, 5),
      };
    });
  }
  async snapshot(): Promise<BookArchive> {
    return this.exclusive(async () => {
      const p = this.state(),
        blocks = [{ id: "manifest", text: this.expected }],
        owners = new Map<string, BookNode>();
      for (const n of p.nodes)
        if (n.document) {
          owners.set(n.document.blockId, n);
          for (const h of n.document.history) owners.set(h.blockId, n);
        }
      if (p.cover) {
        const text = await this.storage.read(p.id, p.cover.blockId);
        if (!text) throw new Error("Das Buchcover fehlt.");
        validateBookCover(
          await openBookBlock(this.secret, p.id, p.cover.blockId, text),
        );
        blocks.push({ id: p.cover.blockId, text });
      }
      for (const [id, n] of owners) {
        await this.load(n, id);
        const text = await this.storage.read(p.id, id);
        if (!text) throw new Error("Ein Buchblock fehlt.");
        blocks.push({ id, text });
      }
      return { reference: this.reference(), blocks };
    });
  }
  /** Safe import: authenticate every source block before any destination write. New project/key prevent collisions. */
  static async importArchive(storage: BookBlockStorage, archive: BookArchive) {
    validateBookReference(archive.reference);
    if (!Array.isArray(archive.blocks) || archive.blocks.length > 30001)
      throw new Error("Das Bucharchiv ist zu groß.");
    const map = new Map<string, string>();
    for (const b of archive.blocks) {
      if (
        !b ||
        !(b.id === "manifest" || bookId(b.id)) ||
        map.has(b.id) ||
        typeof b.text !== "string"
      )
        throw new Error("Das Bucharchiv enthält ungültige Blöcke.");
      map.set(b.id, b.text);
    }
    const manifest = map.get("manifest");
    if (!manifest) throw new Error("Das Buchmanifest fehlt.");
    const oldKey = unbase64(archive.reference.key),
      secret = newBookKey(),
      staged: string[] = [],
      id = crypto.randomUUID();
    try {
      const source = validateBook(
          await openBookBlock(
            oldKey,
            archive.reference.id,
            "manifest",
            manifest,
          ),
        ),
        owners = new Map<string, string>();
      if (source.id !== archive.reference.id)
        throw new Error("Die Buchzuordnung ist ungültig.");
      for (const n of source.nodes)
        if (n.document)
          for (const block of [
            n.document.blockId,
            ...n.document.history.map((h) => h.blockId),
          ]) {
            if (owners.has(block) && owners.get(block) !== n.id)
              throw new Error("Kapitelblöcke sind falsch zugeordnet.");
            owners.set(block, n.id);
          }
      if (source.cover && owners.has(source.cover.blockId))
        throw new Error("Das Cover ist falsch zugeordnet.");
      if (map.size !== owners.size + 1 + (source.cover ? 1 : 0))
        throw new Error(
          "Das Bucharchiv ist unvollständig oder enthält fremde Blöcke.",
        );
      for (const [block, owner] of owners) {
        const text = map.get(block);
        if (!text) throw new Error("Ein Kapitelblock fehlt.");
        const d = validateDocument(
          await openBookBlock(oldKey, source.id, block, text),
        );
        if (d.id !== owner)
          throw new Error("Ein Kapitelblock gehört zu einem anderen Eintrag.");
      }
      if (source.cover) {
        const text = map.get(source.cover.blockId);
        if (!text) throw new Error("Das Buchcover fehlt.");
        validateBookCover(
          await openBookBlock(oldKey, source.id, source.cover.blockId, text),
        );
      }
      for (const [block] of [
        ...owners,
        ...(source.cover
          ? [[source.cover.blockId, "cover"] as [string, string]]
          : []),
      ]) {
        const d = await openBookBlock(
          oldKey,
          source.id,
          block,
          map.get(block)!,
        );
        const text = await sealBookBlock(secret, id, block, d);
        await storage.writeNew(id, block, text);
        staged.push(block);
      }
      const p = { ...source, id },
        text = await sealBookBlock(secret, id, "manifest", p);
      await storage.compareAndSwap(id, text, null, bookBlockIds(p));
      staged.push("manifest");
      return new BookRepository(
        storage,
        { id, title: p.title, key: base64(secret), createdAt: p.createdAt },
        secret,
        p,
        text,
      );
    } catch (e) {
      for (const block of staged)
        await storage.remove(id, block).catch(() => {});
      secret.fill(0);
      throw e;
    } finally {
      oldKey.fill(0);
    }
  }
  /** Called only for a newly staged project whose library registration failed. */
  async discard() {
    const p = this.state();
    await this.queue;
    try {
      if (this.storage.removeProject) await this.storage.removeProject(p.id);
      else {
        const files = await this.storage.list(p.id);
        for (const f of files) await this.storage.remove(p.id, f.id);
      }
    } finally {
      await this.close();
    }
  }
  async collectOrphans() {
    return this.exclusive(async () => {
      const p = this.state();
      if (this.storage.collect)
        return this.storage.collect(
          p.id,
          this.expected,
          bookBlockIds(p),
          Date.now() - 2000,
        );
      return 0;
    });
  }
  async idle() {
    await this.queue;
  }
  async close() {
    if (this.closed) return;
    this.closing = true;
    await this.queue;
    this.secret.fill(0);
    this.referenceValue = { ...this.referenceValue, key: "" };
    this.project = null;
    this.expected = "";
    this.closed = true;
  }
}
