import { performance } from "node:perf_hooks";
import {
  mkdtemp,
  mkdir,
  rm,
  readFile,
  writeFile,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { Vault } from "../core/vault";
import { createDocument } from "../core/document";
const require = createRequire(import.meta.url),
  { SealedStorage } = require("../electron/sealed-storage.cjs"),
  { BookStorage } = require("../electron/book-storage.cjs");
const root = await mkdtemp(join(tmpdir(), "writely-books-bench-"));
const timed = async <T,>(fn: () => Promise<T>) => {
  const start = performance.now();
  await fn();
  return +(performance.now() - start).toFixed(2);
};
try {
  const sealed = new SealedStorage(join(root, "sealed")),
    storage = new BookStorage(join(root, "books"));
  let readCount = 0;
  const read = storage.read.bind(storage);
  storage.read = (...args: any[]) => {
    readCount++;
    return read(...args);
  };
  const v = new Vault(sealed, storage),
    password = "Synthetisches Buchbenchmark Kennwort";
  await v.create(password);
  const book = await v.createBook("100 Kapitel"),
    repo = await v.openBook(book),
    rootBefore = await sealed.read();
  let selected = "";
  const result: any = {
    source:
      "Synthetisches echtes Buchprojekt, 100 Kapitel / 100.000 Wörter; keine UI- oder Android-Gerätemessung",
    platform: process.platform,
    node: process.version,
    timesMs: {},
  };
  result.timesMs.create100Chapters = await timed(async () => {
    for (let i = 0; i < 100; i++) {
      const id = await repo.createNode("chapter", "Kapitel " + (i + 1)),
        d = createDocument("blank");
      selected = id;
      d.id = id;
      d.title = "Kapitel " + (i + 1);
      d.content = {
        type: "doc",
        content: Array.from({ length: 10 }, () => ({
          type: "paragraph",
          content: [
            { type: "text", text: Array(100).fill("Schreiben").join(" ") },
          ],
        })),
      };
      await repo.putDocument(d);
    }
  });
  if (rootBefore !== (await sealed.read()))
    throw new Error("Kapiteländerungen haben den Root-Tresor verändert.");
  const d = await repo.readDocument(selected);
  result.timesMs.saveOneChapterAt100Chapters = await timed(() =>
    repo.putDocument({ ...d, title: "Überarbeitetes Kapitel" }),
  );
  result.rootBytes = (
    await stat(join(root, "sealed", "workspace.sealed"))
  ).size;
  result.manifestBytes = (await stat(storage.file(book, "manifest"))).size;
  result.chapterCount = repo
    .data()
    .nodes.filter((n) => n.kind === "chapter").length;
  result.words = repo
    .data()
    .nodes.reduce((s, n) => s + (n.document?.words || 0), 0);
  await v.closeBook(book);
  readCount = 0;
  let opened: typeof repo | undefined;
  result.timesMs.openProject = await timed(async () => {
    opened = await v.openBook(book);
  });
  result.blocksReadToOpenProject = readCount;
  result.timesMs.readSelectedChapter = await timed(() =>
    opened!.readDocument(selected),
  );
  result.blocksReadAfterSelectingChapter = readCount;
  result.timesMs.fullEncryptedBackup = await timed(() => v.backup());
  result.processMaxRssKiB = process.resourceUsage().maxRSS;
  result.notes = [
    "Root-Tresor bleibt bei Kapiteländerungen bytegleich.",
    "Öffnen liest nur das Projektmanifest, Auswahl einen Kapitelblock.",
    "Keine Garantie für UI-Latenz, Druckseiten, beliebige Medienmengen oder Android-RAM.",
  ];
  await mkdir("work/books-project", { recursive: true });
  await writeFile(
    "work/books-project/benchmark.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
  await v.lock();
} finally {
  await rm(root, { recursive: true, force: true });
}
