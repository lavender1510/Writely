const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_FILE_BYTES = 64 * 1024 * 1024;
const MAX_NODES = 250_000;
const MAX_DEPTH = 100;
const NODE_ATTRIBUTES = {
  doc: ['pageLayout'], layoutBreak:['kind','id','layout'], paragraph: ['styleId', 'textAlign'], heading: ['level', 'styleId', 'textAlign'],
  blockquote: ['styleId'], bulletList: [], orderedList: ['start', 'type'], listItem: [],
  hardBreak: [], horizontalRule: [], codeBlock: ['language'], table: [], tableRow: [],
  tableCell: ['colspan', 'rowspan', 'colwidth', 'align','background','cellBorder','paddingMm'], tableHeader: ['colspan', 'rowspan', 'colwidth', 'align','background','cellBorder','paddingMm'],
  image: ['src', 'alt', 'title', 'width', 'height','drawing','originalSrc','imageEdit','float'], text: [],
};
const MARK_ATTRIBUTES = {
  bold: [], italic: [], underline: [], strike: [], code: [], subscript: [], superscript: [],
  link: ['href', 'target', 'rel', 'class', 'title'], textStyle: ['color', 'fontFamily', 'fontSize'], highlight: ['color'],
};
const BLOCK_TYPES = new Set(['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'horizontalRule', 'codeBlock', 'table', 'image','layoutBreak']);
const INLINE_TYPES = new Set(['text', 'hardBreak']);
const SAFE_IMAGE = /^data:image\/(png|jpe?g|webp|gif);base64,[a-zA-Z0-9+/=\s]+$/;
const SAFE_COLOR = /^(#[a-f\d]{3}|#[a-f\d]{4}|#[a-f\d]{6}|#[a-f\d]{8}|[a-z]{1,30}|rgba?\([\d\s.,%]+\))$/i;
const SAFE_FONT = /^[\p{L}\p{N} _.,'"-]{1,200}$/u;

function invalid(message) { throw new Error(`Die Writely-Datei ist ungültig: ${message}`); }
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)); }

function safeLink(value) {
  if (typeof value !== 'string' || value.length > 8192 || /[\x00-\x20\\]/.test(value) || value.startsWith('//')) return false;
  if (value.startsWith('#')) return true;
  if (!value.includes(':')) return true; // Relative links contain no executable URL scheme.
  try { return ['http:', 'https:', 'mailto:'].includes(new URL(value).protocol); } catch { return false; }
}

function validateAttributes(attributes, allowed, element) {
  if (attributes === undefined) return;
  if (!plain(attributes)) invalid(`Die Attribute von „${element}“ sind ungültig.`);
  for (const key of Object.keys(attributes)) if (!allowed.includes(key)) invalid(`Das Attribut „${key}“ von „${element}“ wird noch nicht unterstützt.`);
}

function validateContentNode(node, parent) {
  if (!plain(node) || !Object.hasOwn(NODE_ATTRIBUTES, node.type)) invalid(`Das Dokumentelement „${String(node?.type || 'unbekannt')}“ wird noch nicht unterstützt.`);
  for (const key of Object.keys(node)) if (!['type', 'attrs', 'content', 'marks', 'text'].includes(key)) invalid(`Die Eigenschaft „${key}“ von „${node.type}“ wird noch nicht unterstützt.`);
  validateAttributes(node.attrs, NODE_ATTRIBUTES[node.type], node.type);
  const attrs = node.attrs || {};
  if(node.type==='layoutBreak'){if(!['page','section','column'].includes(attrs.kind)||typeof attrs.id!=='string'||attrs.id.length>128)invalid('Der Umbruch ist ungültig.');if(attrs.layout)require('./layout.mjs').validateLayout(attrs.layout);}
  if(node.type==='doc'&&attrs.pageLayout)require('./layout.mjs').validateLayout(attrs.pageLayout);
  if (attrs.styleId != null && (typeof attrs.styleId !== 'string' || !/^[a-zA-Z][\w-]{0,60}$/.test(attrs.styleId))) invalid('Die Formatvorlagenreferenz ist ungültig.');
  for (const key of ['textAlign', 'align']) if (attrs[key] != null && !['left', 'right', 'center', 'justify'].includes(attrs[key])) invalid('Die Absatzausrichtung ist ungültig.');
  if (node.type === 'heading' && attrs.level !== undefined && (!Number.isInteger(attrs.level) || attrs.level < 1 || attrs.level > 6)) invalid('Die Überschriftenebene ist ungültig.');
  if (attrs.language != null && (typeof attrs.language !== 'string' || attrs.language.length > 100)) invalid('Die Codesprache ist ungültig.');
  if (node.type === 'orderedList') {
    if (attrs.start !== undefined && (!Number.isInteger(attrs.start) || attrs.start < 1 || attrs.start > 2_147_483_647)) invalid('Der Anfangswert der Nummerierung ist ungültig.');
    if (attrs.type != null && !['1', 'a', 'A', 'i', 'I'].includes(attrs.type)) invalid('Dieser Nummerierungstyp wird noch nicht unterstützt.');
  }
  if (['tableCell', 'tableHeader'].includes(node.type)) {
    for (const key of ['colspan', 'rowspan']) if (attrs[key] !== undefined && (!Number.isInteger(attrs[key]) || attrs[key] < 1 || attrs[key] > 100)) invalid('Die verbundenen Tabellenzellen sind ungültig.');
    if (attrs.colwidth != null && (!Array.isArray(attrs.colwidth) || attrs.colwidth.length > 100 || attrs.colwidth.some(width => !Number.isFinite(width) || width < 1 || width > 100_000))) invalid('Die Tabellenspaltenbreiten sind ungültig.');
  }
  if(attrs.cellBorder!=null&&attrs.cellBorder!=='none'&&!SAFE_COLOR.test(attrs.cellBorder))invalid('Der Zellrahmen ist ungültig.');
  if(attrs.paddingMm!=null&&(!Number.isFinite(attrs.paddingMm)||attrs.paddingMm<0||attrs.paddingMm>30))invalid('Der Zellabstand ist ungültig.');
  if(attrs.background!=null&&!SAFE_COLOR.test(attrs.background))invalid('Die Zellfarbe ist ungültig.');
  if (node.type === 'image') {
    if(attrs.originalSrc!=null&&!SAFE_IMAGE.test(attrs.originalSrc))invalid('Das Originalbild ist ungültig.');
    if(attrs.float!=null&&!['inline','left','right','center'].includes(attrs.float))invalid('Der Bildumfluss ist ungültig.');
    if (typeof attrs.src !== 'string' || !SAFE_IMAGE.test(attrs.src)) invalid('Bilder müssen als eingebettetes PNG-, JPEG-, WEBP- oder GIF-Bild vorliegen. Externe Bildquellen werden nicht geladen.');
    for (const key of ['alt', 'title']) if (attrs[key] != null && (typeof attrs[key] !== 'string' || attrs[key].length > 10_000)) invalid('Die Bildbeschreibung ist ungültig.');
    for (const key of ['width', 'height']) if (attrs[key] != null && (!/^\d{1,6}$/.test(String(attrs[key])) || Number(attrs[key]) < 1 || Number(attrs[key]) > 100_000)) invalid('Die Bildabmessungen sind ungültig.');
  }
  if (node.type === 'text') {
    if (typeof node.text !== 'string' || node.text.length === 0) invalid('Ein Textelement ist leer oder ungültig.');
  } else if (node.text !== undefined) invalid('Text darf nur in Textelementen stehen.');
  if (node.marks !== undefined) {
    if (!Array.isArray(node.marks) || !INLINE_TYPES.has(node.type)) invalid('Die Textformatierungen sind ungültig.');
    const seen = new Set();
    for (const mark of node.marks) {
      if (!plain(mark) || !Object.hasOwn(MARK_ATTRIBUTES, mark.type)) invalid(`Die Textformatierung „${String(mark?.type || 'unbekannt')}“ wird noch nicht unterstützt.`);
      if (seen.has(mark.type)) invalid('Eine Textformatierung ist mehrfach vorhanden.');
      seen.add(mark.type);
      for (const key of Object.keys(mark)) if (!['type', 'attrs'].includes(key)) invalid('Eine Textformatierung enthält nicht unterstützte Eigenschaften.');
      validateAttributes(mark.attrs, MARK_ATTRIBUTES[mark.type], mark.type);
      const style = mark.attrs || {};
      if (style.color != null && (typeof style.color !== 'string' || !SAFE_COLOR.test(style.color))) invalid('Die Textfarbe ist ungültig.');
      if (style.fontFamily != null && (typeof style.fontFamily !== 'string' || !SAFE_FONT.test(style.fontFamily))) invalid('Der Schriftname ist ungültig.');
      if (style.fontSize != null && (typeof style.fontSize !== 'string' || !/^\d{1,3}(\.\d{1,2})?(px|pt)$/.test(style.fontSize))) invalid('Die Schriftgröße ist ungültig.');
      if (mark.type === 'link') {
        if (!safeLink(style.href)) invalid('Der Link enthält eine unzulässige Adresse.');
        if (style.target != null && !['_blank', '_self', '_parent', '_top'].includes(style.target)) invalid('Das Linkziel ist ungültig.');
        for (const key of ['rel', 'class', 'title']) if (style[key] != null && (typeof style[key] !== 'string' || style[key].length > 1000 || /[<>\x00-\x1f]/.test(style[key]))) invalid('Die Linkeigenschaften sind ungültig.');
      }
    }
    if (parent === 'codeBlock' && node.marks.length) invalid('Formatierungen innerhalb eines Codeblocks werden noch nicht unterstützt.');
  }
  if (node.content !== undefined && !Array.isArray(node.content)) invalid('Die Dokumentstruktur ist ungültig.');
  const content = node.content || [];
  if (['text', 'image', 'hardBreak', 'horizontalRule','layoutBreak'].includes(node.type) && content.length) invalid('Dieses Dokumentelement darf keine Unterelemente enthalten.');
  if (['doc', 'blockquote', 'tableCell', 'tableHeader', 'listItem', 'bulletList', 'orderedList', 'table', 'tableRow'].includes(node.type) && !content.length) invalid('Ein Strukturelement des Dokuments ist leer.');
  const allowed = node.type === 'paragraph' || node.type === 'heading' ? INLINE_TYPES
    : node.type === 'codeBlock' ? new Set(['text'])
      : ['doc', 'blockquote', 'tableCell', 'tableHeader', 'listItem'].includes(node.type) ? BLOCK_TYPES
        : ['bulletList', 'orderedList'].includes(node.type) ? new Set(['listItem'])
          : node.type === 'table' ? new Set(['tableRow'])
            : node.type === 'tableRow' ? new Set(['tableCell', 'tableHeader']) : new Set();
  if (node.type === 'listItem' && content[0]?.type !== 'paragraph') invalid('Ein Listeneintrag muss mit einem Absatz beginnen.');
  for (const child of content) {
    if (!allowed.has(child?.type)) invalid(`Das Element „${String(child?.type || 'unbekannt')}“ ist innerhalb von „${node.type}“ nicht zulässig.`);
    validateContentNode(child, node.type);
  }
}

function validateDocument(value) {
  if (!plain(value) || value.schemaVersion !== 1) invalid('Diese Dateiversion wird noch nicht unterstützt.');
  if (typeof value.id !== 'string' || !value.id || value.id.length > 128) invalid('Die Dokument-ID fehlt.');
  if (typeof value.title !== 'string' || value.title.length > 500) invalid('Der Dokumentname ist zu lang oder fehlt.');
  for (const key of ['createdAt', 'updatedAt']) if (typeof value[key] !== 'string' || !Number.isFinite(Date.parse(value[key]))) invalid('Ein Zeitstempel fehlt.');
  if (!plain(value.content) || value.content.type !== 'doc' || !Array.isArray(value.content.content)) invalid('Der Dokumentinhalt fehlt.');
  if (!plain(value.styles) || Object.keys(value.styles).length > 1000) invalid('Die Formatvorlagen fehlen oder sind zu umfangreich.');
  for (const [key, style] of Object.entries(value.styles)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) invalid('Der Inhalt enthält einen unzulässigen Schlüssel.');
    if (!/^[a-zA-Z][\w-]{0,60}$/.test(key) || !plain(style)) invalid('Eine Formatvorlage ist ungültig.');
    if (typeof style.name !== 'string' || style.name.length > 200) invalid('Der Name einer Formatvorlage fehlt oder ist zu lang.');
    if (style.basedOn !== undefined && (typeof style.basedOn !== 'string' || !/^[a-zA-Z][\w-]{0,60}$/.test(style.basedOn))) invalid('Die Basis einer Formatvorlage ist ungültig.');
    if (style.fontFamily !== undefined && (typeof style.fontFamily !== 'string' || !SAFE_FONT.test(style.fontFamily))) invalid('Die Schrift einer Formatvorlage ist ungültig.');
    if (style.fontSize !== undefined && (!Number.isFinite(style.fontSize) || style.fontSize < 6 || style.fontSize > 120)) invalid('Die Schriftgröße einer Formatvorlage ist ungültig.');
    if (style.color !== undefined && (typeof style.color !== 'string' || !SAFE_COLOR.test(style.color))) invalid('Die Farbe einer Formatvorlage ist ungültig.');
    if (style.lineHeight !== undefined && (!Number.isFinite(style.lineHeight) || style.lineHeight < 1 || style.lineHeight > 3)) invalid('Der Zeilenabstand einer Formatvorlage ist ungültig.');
  }
  try{require('./layout.mjs').validateLayout(value.page);}catch(error){invalid(error.message);}
  if (!Array.isArray(value.fonts) || value.fonts.length > 1000 || value.fonts.some(font => !plain(font) || typeof font.family !== 'string' || font.family.length > 200)) invalid('Die Schriftartenliste ist ungültig.');
  let nodes = 0;
  function inspect(item, depth) {
    if (depth > MAX_DEPTH) invalid('Der Inhalt ist zu stark verschachtelt.');
    if (++nodes > MAX_NODES) invalid('Das Dokument enthält zu viele Elemente.');
    if (item !== null && typeof item === 'object') {
      if (!Array.isArray(item) && !plain(item)) invalid('Der Inhalt enthält ungültige Objekte.');
      for (const [key, child] of Object.entries(item)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) invalid('Der Inhalt enthält einen unzulässigen Schlüssel.');
        inspect(child, depth + 1);
      }
    }
  }
  inspect(value, 0);
  validateContentNode(value.content);
  const bytes = Buffer.byteLength(JSON.stringify(value));
  if (bytes > MAX_FILE_BYTES) invalid('Das Dokument ist größer als 64 MB.');
  return value;
}

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
    await fs.rename(temporary, target);
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
  try { value = JSON.parse(await fs.readFile(filePath, 'utf8')); }
  catch (error) { if (error instanceof SyntaxError) invalid('Die Datei enthält kein lesbares JSON.'); throw error; }
  return validateDocument(value);
}

class LocalStore {
  constructor(directory, { historyLimit = 30, snapshotIntervalMs = 60_000 } = {}) {
    this.directory = directory;
    this.historyLimit = historyLimit;
    this.snapshotIntervalMs = snapshotIntervalMs;
    this.queue = Promise.resolve();
    this.lastSnapshot = new Map();
  }
  enqueue(task) {
    const pending = this.queue.then(task);
    this.queue = pending.catch(() => {});
    return pending;
  }
  async flush() { await this.queue; }
  async readRecoverySnapshot() {
    for (const name of ['recovery.writely', 'recovery.previous.writely']) {
      const filePath = path.join(this.directory, name);
      try { return { document: await readDocument(filePath), filePath }; }
      catch (error) { if (error.code !== 'ENOENT' && !error.message.includes('ungültig')) throw error; }
    }
    return null;
  }
  async preserveRecovery(nextDocument, forceVersion = false) {
    const previous = await this.readRecoverySnapshot();
    if (!previous) return;
    // A switch or explicit restore must preserve the latest typing even within the timed snapshot interval.
    if (forceVersion || previous.document.id !== nextDocument?.id) await this.writeVersion(previous.document, JSON.stringify(previous.document));
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
      if (!previous || Date.now() - previous > this.snapshotIntervalMs) await this.writeVersion(doc, snapshot);
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
  async writeVersion(document, snapshot) {
    const history = path.join(this.directory, 'versions');
    await fs.mkdir(history, { recursive: true });
    const existing = (await fs.readdir(history)).filter(name => /^\d+-[a-f0-9]+\.writely$/.test(name)).sort().reverse();
    const stamp = Math.max(Date.now(), Number(existing[0]?.split('-')[0] || 0) + 1);
    const id = `${stamp}-${crypto.randomBytes(6).toString('hex')}`;
    await atomicWrite(path.join(history, `${id}.writely`), snapshot);
    this.lastSnapshot.set(document.id, Date.now());
    const files = (await fs.readdir(history)).filter(name => /^\d+-[a-f0-9]+\.writely$/.test(name)).sort().reverse();
    for (const filename of files.slice(this.historyLimit)) await fs.rm(path.join(history, filename), { force: true });
  }
  async versions() {
    await this.queue;
    const history = path.join(this.directory, 'versions');
    let names;
    try { names = await fs.readdir(history); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    const result = [];
    for (const filename of names.filter(name => /^\d+-[a-f0-9]+\.writely$/.test(name)).sort().reverse()) {
      try {
        const document = await readDocument(path.join(history, filename));
        result.push({ id: filename.slice(0, -8), title: document.title, updatedAt: document.updatedAt });
      } catch { /* A damaged snapshot must not hide healthy history. */ }
    }
    return result;
  }
  async restoreVersion(id) {
    if (typeof id !== 'string' || !/^\d+-[a-f0-9]+$/.test(id)) throw new Error('Diese Dokumentversion ist ungültig.');
    return this.enqueue(async () => {
      // Read first: archiving the current state may prune this oldest requested version.
      const target = await readDocument(path.join(this.directory, 'versions', `${id}.writely`));
      await this.preserveRecovery(target, true);
      return target;
    });
  }
}

module.exports = { MAX_FILE_BYTES, validateDocument, atomicWrite, readDocument, LocalStore };
