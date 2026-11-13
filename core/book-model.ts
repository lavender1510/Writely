import type { BookProject, BookNode, BookReference } from "./book-types";
import { bookId } from "./book-block-format.mjs";
const timestamp = (x: unknown) =>
  typeof x === "string" && Number.isFinite(Date.parse(x));
const text = (x: unknown, max: number) =>
  typeof x === "string" && x.length <= max;
const color = (x: unknown) =>
  typeof x === "string" && /^#[a-f0-9]{6}$/i.test(x);
const known = (v: object, keys: string[]) =>
  Object.keys(v).every((k) => keys.includes(k));
const fail = () => {
  throw new Error(
    "Das Buchprojekt enthält ungültige oder nicht unterstützte Daten.",
  );
};
export function validateBookReference(v: unknown): BookReference {
  const r = v as BookReference;
  if (
    !r ||
    !known(r, ["id", "title", "key", "createdAt", "deletedAt", "color"]) ||
    !bookId(r.id) ||
    !text(r.title, 500) ||
    !r.title.trim() ||
    typeof r.key !== "string" ||
    !/^[A-Za-z0-9+/]{43}=$/.test(r.key) ||
    !timestamp(r.createdAt) ||
    (r.color !== undefined && !color(r.color)) ||
    (r.deletedAt !== undefined && !timestamp(r.deletedAt))
  )
    fail();
  return r;
}
export function newBook(title = "Mein Buch"): BookProject {
  const now = new Date().toISOString();
  return {
    format: "WritelyBookProject",
    schemaVersion: 1,
    id: crypto.randomUUID(),
    revision: 1,
    title,
    subtitle: "",
    author: "",
    pseudonym: "",
    genre: "",
    language: "de-DE",
    description: "",
    notes: "",
    series: "",
    goalWords: 80000,
    color: "#8a64bc",
    createdAt: now,
    updatedAt: now,
    lastNodeId: null,
    statuses: [
      ["idea", "Idee"],
      ["planned", "Geplant"],
      ["writing", "In Arbeit"],
      ["draft", "Erster Entwurf"],
      ["revision", "Überarbeitung"],
      ["done", "Fertig"],
    ].map(([id, label]) => ({ id, label, color: "#8a64bc" })),
    nodes: [],
  };
}
export function validateBook(value: unknown): BookProject {
  const p = value as BookProject;
  if (
    p &&
    !known(p, [
      "format",
      "schemaVersion",
      "id",
      "revision",
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
      "createdAt",
      "updatedAt",
      "lastNodeId",
      "statuses",
      "nodes",
      "cover",
    ])
  )
    fail();
  if (
    !p ||
    p.format !== "WritelyBookProject" ||
    p.schemaVersion !== 1 ||
    !bookId(p.id) ||
    !Number.isSafeInteger(p.revision) ||
    p.revision < 1 ||
    !text(p.title, 500) ||
    !p.title.trim() ||
    !text(p.subtitle, 500) ||
    !text(p.author, 200) ||
    !text(p.pseudonym, 200) ||
    !text(p.genre, 120) ||
    !text(p.language, 35) ||
    !/^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(p.language) ||
    !text(p.description, 20000) ||
    !text(p.notes, 100000) ||
    !text(p.series, 200) ||
    !color(p.color) ||
    !Number.isInteger(p.goalWords) ||
    p.goalWords < 0 ||
    p.goalWords > 100000000 ||
    !timestamp(p.createdAt) ||
    !timestamp(p.updatedAt) ||
    !Array.isArray(p.nodes) ||
    p.nodes.length > 5000 ||
    !Array.isArray(p.statuses) ||
    !p.statuses.length ||
    p.statuses.length > 50
  )
    fail();
  if (
    p.cover &&
    (!bookId(p.cover.blockId) ||
      !["image/png", "image/jpeg", "image/webp"].includes(p.cover.mime) ||
      !text(p.cover.alt, 500))
  )
    fail();
  const statuses = new Set<string>();
  for (const s of p.statuses) {
    if (
      !s ||
      !known(s, ["id", "label", "color"]) ||
      !text(s.id, 128) ||
      !s.id ||
      statuses.has(s.id) ||
      !text(s.label, 120) ||
      !s.label.trim() ||
      !color(s.color)
    )
      fail();
    statuses.add(s.id);
  }
  const nodes = new Map<string, BookNode>(),
    orders = new Set<string>();
  for (const n of p.nodes) {
    if (
      !n ||
      !known(n, [
        "id",
        "parentId",
        "kind",
        "order",
        "title",
        "synopsis",
        "notes",
        "color",
        "statusId",
        "deletedAt",
        "trashBatch",
        "document",
      ]) ||
      !bookId(n.id) ||
      nodes.has(n.id) ||
      !(n.parentId === null || bookId(n.parentId)) ||
      !["part", "folder", "chapter", "scene"].includes(n.kind) ||
      !Number.isSafeInteger(n.order) ||
      n.order < 0 ||
      !text(n.title, 500) ||
      !text(n.synopsis, 10000) ||
      !text(n.notes, 100000) ||
      !color(n.color) ||
      !statuses.has(n.statusId) ||
      (n.deletedAt !== undefined && !timestamp(n.deletedAt)) ||
      (n.trashBatch !== undefined && (!n.deletedAt || !bookId(n.trashBatch)))
    )
      fail();
    const order = `${n.parentId}/${n.order}`;
    if (orders.has(order)) fail();
    orders.add(order);
    nodes.set(n.id, n);
    if (["chapter", "scene"].includes(n.kind) !== !!n.document) fail();
    if (n.document) {
      const d = n.document;
      if (
        !known(d, ["blockId", "words", "updatedAt", "history"]) ||
        !bookId(d.blockId) ||
        !Number.isInteger(d.words) ||
        d.words < 0 ||
        d.words > 100000000 ||
        !timestamp(d.updatedAt) ||
        !Array.isArray(d.history) ||
        d.history.length > 5
      )
        fail();
      for (const h of d.history)
        if (
          !h ||
          !known(h, ["blockId", "capturedAt", "title", "label"]) ||
          !bookId(h.blockId) ||
          !timestamp(h.capturedAt) ||
          !text(h.title, 500) ||
          (h.label !== undefined && !text(h.label, 120))
        )
          fail();
    }
  }
  const depths = new Map<string, number>();
  for (const node of p.nodes) {
    let current: BookNode | undefined = node;
    const chain: BookNode[] = [],
      seen = new Set<string>();
    while (current && !depths.has(current.id)) {
      if (seen.has(current.id)) fail();
      seen.add(current.id);
      chain.push(current);
      if (chain.length > 50) fail();
      if (current.parentId === null) {
        current = undefined;
        break;
      }
      const parent = nodes.get(current.parentId);
      if (
        !parent ||
        parent.kind === "scene" ||
        (!node.deletedAt && parent.deletedAt)
      )
        fail();
      current = parent;
    }
    let depth = current ? depths.get(current.id)! : 0;
    for (const n of chain.reverse()) {
      if (++depth > 50) fail();
      depths.set(n.id, depth);
    }
  }
  if (
    p.lastNodeId !== null &&
    (!bookId(p.lastNodeId) || !nodes.has(p.lastNodeId))
  )
    fail();
  return p;
}
export function bookChildren(
  p: BookProject,
  parent: string | null,
  trash = false,
) {
  return p.nodes
    .filter(
      (n) => n.parentId === parent && (trash ? !!n.deletedAt : !n.deletedAt),
    )
    .sort((a, b) => a.order - b.order);
}
export function bookDescendants(p: BookProject, id: string) {
  const ids = new Set([id]);
  let size = -1;
  while (size !== ids.size) {
    size = ids.size;
    for (const n of p.nodes)
      if (n.parentId && ids.has(n.parentId)) ids.add(n.id);
  }
  return ids;
}
export function bookStats(p: BookProject) {
  const nodes = p.nodes.filter((n) => !n.deletedAt);
  return {
    words: nodes.reduce((total, n) => total + (n.document?.words || 0), 0),
    chapters: nodes.filter((n) => n.kind === "chapter").length,
    scenes: nodes.filter((n) => n.kind === "scene").length,
  };
}

export function validateBookCover(value: unknown): {
  format: "WritelyBookCover";
  schemaVersion: 1;
  mime: string;
  src: string;
  alt: string;
} {
  const c = value as any;
  if (
    !c ||
    !known(c, ["format", "schemaVersion", "mime", "src", "alt"]) ||
    c.format !== "WritelyBookCover" ||
    c.schemaVersion !== 1 ||
    !["image/png", "image/jpeg", "image/webp"].includes(c.mime) ||
    !text(c.alt, 500) ||
    typeof c.src !== "string" ||
    !c.src.startsWith("data:" + c.mime + ";base64,") ||
    c.src.length > 8 * 1024 * 1024
  )
    fail();
  const encoded = c.src.slice(c.src.indexOf(",") + 1);
  if (encoded.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) fail();
  const prefix = atob(encoded.slice(0, 32));
  if (
    (c.mime === "image/png" && !prefix.startsWith("\x89PNG\r\n\x1a\n")) ||
    (c.mime === "image/jpeg" && !prefix.startsWith("\xff\xd8\xff")) ||
    (c.mime === "image/webp" &&
      (!prefix.startsWith("RIFF") || prefix.slice(8, 12) !== "WEBP"))
  )
    fail();
  return c;
}

export function bookWordTotals(p: BookProject): Map<string, number> {
  const children = new Map<string, BookNode[]>();
  for (const n of p.nodes)
    if (!n.deletedAt && n.parentId) {
      const list = children.get(n.parentId) || [];
      list.push(n);
      children.set(n.parentId, list);
    }
  const totals = new Map<string, number>();
  const count = (n: BookNode): number => {
    if (totals.has(n.id)) return totals.get(n.id)!;
    const total =
      (n.document?.words || 0) +
      (children.get(n.id) || []).reduce((sum, child) => sum + count(child), 0);
    totals.set(n.id, total);
    return total;
  };
  for (const n of p.nodes) if (!n.deletedAt) count(n);
  return totals;
}

export function bookManuscriptNodes(p: BookProject): BookNode[] {
  const children = new Map<string | null, BookNode[]>();
  for (const n of p.nodes)
    if (!n.deletedAt) {
      const values = children.get(n.parentId) || [];
      values.push(n);
      children.set(n.parentId, values);
    }
  for (const list of children.values()) list.sort((a, b) => a.order - b.order);
  const result: BookNode[] = [];
  const visit = (parent: string | null) => {
    for (const n of children.get(parent) || []) {
      result.push(n);
      visit(n.id);
    }
  };
  visit(null);
  return result;
}

export function bookBlockIds(p: BookProject): string[] {
  const ids = new Set<string>();
  if (p.cover) ids.add(p.cover.blockId);
  for (const n of p.nodes)
    if (n.document) {
      ids.add(n.document.blockId);
      for (const h of n.document.history) ids.add(h.blockId);
    }
  return [...ids];
}

export function bookNodeTitle(n?: Pick<BookNode, "kind" | "title">): string {
  if (!n) return "Manuskript";
  return n.title.trim()
    ? n.title
    : {
        part: "Unbenannter Teil",
        folder: "Unbenannte Gruppe",
        chapter: "Unbenanntes Kapitel",
        scene: "Unbenannte Szene",
      }[n.kind];
}
