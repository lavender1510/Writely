import { registerPlugin } from "@capacitor/core";
import { isAndroid } from "./secure-platform";
import { bookId, blockId, parseBookBlock } from "../core/book-block-format.mjs";
import type { BookBlockStorage } from "../core/book-types";
interface Bridge {
  listBookProjects(): Promise<{ items: { id: string; modifiedAt: number }[] }>;
  removeBookProject(o: { projectId: string }): Promise<void>;
  readBookBlock(o: {
    projectId: string;
    blockId: string;
  }): Promise<{ text: string | null }>;
  writeBookBlock(o: {
    projectId: string;
    blockId: string;
    text: string;
  }): Promise<void>;
  commitBookManifest(o: {
    projectId: string;
    text: string;
    expected: string | null;
    required?: string[];
  }): Promise<void>;
  collectBookBlocks(o: {
    projectId: string;
    expected: string;
    keep: string[];
    cutoff: number;
  }): Promise<{ removed: number }>;
  listBookBlocks(o: {
    projectId: string;
  }): Promise<{ items: { id: string; modifiedAt: number }[] }>;
  removeBookBlock(o: { projectId: string; blockId: string }): Promise<void>;
}
const native = registerPlugin<Bridge>("WritelyFiles");
let database: Promise<IDBDatabase> | undefined;
function db() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open("writely.book-blocks.v1", 2);
    request.onupgradeneeded = () => {
      const d = request.result;
      if (!d.objectStoreNames.contains("blocks"))
        d.createObjectStore("blocks", { keyPath: ["projectId", "id"] });
      if (!d.objectStoreNames.contains("metadata"))
        d.createObjectStore("metadata", {
          keyPath: ["projectId", "id"],
        }).createIndex("project", "projectId");
      if (!d.objectStoreNames.contains("projects")) {
        const projects = d.createObjectStore("projects", { keyPath: "id" }),
          meta = request.transaction!.objectStore("metadata"),
          times = new Map<string, number>(),
          cursor = meta.openCursor();
        cursor.onsuccess = () => {
          const c = cursor.result;
          if (c) {
            times.set(
              c.value.projectId,
              Math.max(times.get(c.value.projectId) || 0, c.value.modifiedAt),
            );
            c.continue();
          } else
            for (const [id, modifiedAt] of times)
              projects.put({ id, modifiedAt });
        };
      }
    };
    request.onsuccess = () => {
      const result = request.result;
      if (blocked) {
        result.close();
        return;
      }
      result.onversionchange = () => {
        result.close();
        database = undefined;
      };
      resolve(result);
    };
    request.onerror = () => {
      database = undefined;
      reject(
        new Error("Der lokale Buchspeicher konnte nicht geöffnet werden."),
      );
    };
    request.onblocked = () => {
      blocked = true;
      database = undefined;
      reject(
        new Error(
          "Eine andere Writely-Ansicht blockiert den Buchspeicher. Schließe sie und lade erneut.",
        ),
      );
    };
  }));
}
async function transaction<T>(
  write: boolean,
  job: (
    blocks: IDBObjectStore,
    meta: IDBObjectStore,
    set: (value: T) => void,
    abort: (message: string) => void,
    projects: IDBObjectStore,
  ) => void,
): Promise<T> {
  const database = await db();
  return new Promise<T>((resolve, reject) => {
    const tx = database.transaction(
      ["blocks", "metadata", "projects"],
      write ? "readwrite" : "readonly",
    );
    let result: T,
      error =
        "Der Buchspeicher konnte nicht aktualisiert werden. Prüfe den freien Speicherplatz.";
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(new Error(error));
    tx.onerror = () => {};
    job(
      tx.objectStore("blocks"),
      tx.objectStore("metadata"),
      (value) => {
        result = value;
      },
      (message) => {
        error = message;
        tx.abort();
      },
      tx.objectStore("projects"),
    );
  });
}
function ensurePlatform() {
  if (
    !isAndroid &&
    window.writely &&
    [
      "bookRead",
      "bookWriteNew",
      "bookCommit",
      "bookList",
      "bookRemove",
      "bookCollect",
      "bookProjects",
      "bookRemoveProject",
    ].some((k) => typeof (window.writely as any)[k] !== "function")
  )
    throw new Error(
      "Aktualisiere die vollständige Desktop-App, bevor du Buchprojekte öffnest. Die Speicheradapter passen nicht zusammen.",
    );
}
function address(p: string, id: string) {
  ensurePlatform();
  if (!bookId(p) || !blockId(id))
    throw new Error("Die Buchblock-Adresse ist ungültig.");
}
export const bookStorage: BookBlockStorage = {
  async read(p, id) {
    address(p, id);
    let text: string | null;
    if (isAndroid)
      text = (await native.readBookBlock({ projectId: p, blockId: id })).text;
    else if (window.writely?.bookRead)
      text = await window.writely.bookRead(p, id);
    else
      text = await transaction<string | null>(false, (blocks, _meta, set) => {
        const q = blocks.get([p, id]);
        q.onsuccess = () => set(q.result?.text ?? null);
      });
    if (text !== null) parseBookBlock(text, p, id);
    return text;
  },
  async writeNew(p, id, text) {
    ensurePlatform();
    parseBookBlock(text, p, id);
    if (id === "manifest")
      throw new Error("Ein Manifest benötigt einen geprüften Versionswechsel.");
    if (isAndroid)
      return native.writeBookBlock({ projectId: p, blockId: id, text });
    if (window.writely?.bookWriteNew)
      return window.writely.bookWriteNew(p, id, text);
    await transaction<void>(true, (blocks, meta, set, _abort, projects) => {
      const q = blocks.add({ projectId: p, id, text });
      q.onsuccess = () => {
        meta.add({ projectId: p, id, modifiedAt: Date.now() });
        projects.put({ id: p, modifiedAt: Date.now() });
        set();
      };
    });
  },
  async compareAndSwap(p, text, expected, required = []) {
    ensurePlatform();
    parseBookBlock(text, p, "manifest");
    if (
      !Array.isArray(required) ||
      required.length > 30001 ||
      required.some((id) => !bookId(id))
    )
      throw new Error("Die Buchblock-Liste ist ungültig.");
    if (isAndroid)
      return native.commitBookManifest({
        projectId: p,
        text,
        expected,
        required,
      });
    if (window.writely?.bookCommit)
      return window.writely.bookCommit(p, text, expected, required);
    await transaction<void>(true, (blocks, meta, set, abort, projects) => {
      const q = blocks.get([p, "manifest"]);
      q.onsuccess = () => {
        if ((q.result?.text ?? null) !== expected) {
          abort(
            "Das Buch wurde zwischenzeitlich geändert. Öffne es erneut, bevor du speicherst.",
          );
          return;
        }
        const commit = () => {
          blocks.put({ projectId: p, id: "manifest", text });
          meta.put({ projectId: p, id: "manifest", modifiedAt: Date.now() });
          projects.put({ id: p, modifiedAt: Date.now() });
          set();
        };
        if (!required.length) {
          commit();
          return;
        }
        const keys = blocks.getAllKeys(
          IDBKeyRange.bound([p, ""], [p, "\uffff"]),
        );
        keys.onsuccess = () => {
          const existing = new Set(
            keys.result.map((key) => (key as string[])[1]),
          );
          if (required.some((id) => !existing.has(id))) {
            abort(
              "Ein benötigter Buchblock fehlt. Der vorherige Stand bleibt erhalten.",
            );
            return;
          }
          commit();
        };
      };
    });
  },
  async collect(p, expected, keep, cutoff) {
    address(p, "manifest");
    if (
      !Array.isArray(keep) ||
      keep.length > 30001 ||
      keep.some((id) => !bookId(id)) ||
      !Number.isFinite(cutoff)
    )
      throw new Error("Die Buchbereinigung ist ungültig.");
    if (isAndroid)
      return (
        await native.collectBookBlocks({ projectId: p, expected, keep, cutoff })
      ).removed;
    if (window.writely?.bookCollect)
      return window.writely.bookCollect(p, expected, keep, cutoff);
    return transaction<number>(true, (blocks, meta, set) => {
      const q = blocks.get([p, "manifest"]);
      q.onsuccess = () => {
        if (q.result?.text !== expected) {
          set(0);
          return;
        }
        const used = new Set(["manifest", ...keep]),
          cursor = meta.index("project").openCursor(p);
        let removed = 0;
        cursor.onsuccess = () => {
          const c = cursor.result;
          if (!c) {
            set(removed);
            return;
          }
          const v = c.value;
          if (!used.has(v.id) && v.modifiedAt < cutoff && removed < 200) {
            blocks.delete([p, v.id]);
            c.delete();
            removed++;
          }
          c.continue();
        };
      };
    });
  },
  async list(p) {
    address(p, "manifest");
    if (isAndroid) return (await native.listBookBlocks({ projectId: p })).items;
    if (window.writely?.bookList) return window.writely.bookList(p);
    return transaction(false, (_blocks, meta, set) => {
      const q = meta.index("project").getAll(p);
      q.onsuccess = () =>
        set(q.result.map(({ id, modifiedAt }) => ({ id, modifiedAt })));
    });
  },
  async projects() {
    ensurePlatform();
    if (isAndroid) return (await native.listBookProjects()).items;
    if (window.writely?.bookProjects) return window.writely.bookProjects();
    return transaction(false, (_blocks, _meta, set, _abort, projects) => {
      const q = projects.getAll();
      q.onsuccess = () => set(q.result);
    });
  },
  async removeProject(p) {
    address(p, "manifest");
    if (isAndroid) return native.removeBookProject({ projectId: p });
    if (window.writely?.bookRemoveProject)
      return window.writely.bookRemoveProject(p);
    await transaction<void>(true, (blocks, meta, set, _abort, projects) => {
      const q = meta.index("project").getAllKeys(p);
      q.onsuccess = () => {
        for (const key of q.result) {
          blocks.delete(key);
          meta.delete(key);
        }
        projects.delete(p);
        set();
      };
    });
  },
  async remove(p, id) {
    address(p, id);
    if (isAndroid) return native.removeBookBlock({ projectId: p, blockId: id });
    if (window.writely?.bookRemove) return window.writely.bookRemove(p, id);
    await transaction<void>(true, (blocks, meta, set) => {
      blocks.delete([p, id]);
      meta.delete([p, id]);
      set();
    });
  },
};
