import { marked } from 'marked';
import {validateLayout} from '../electron/layout.mjs';
import { createDocument, documentText, styleSheet } from './document';
import type { DesktopBridge, DocumentFile, ExportFormat, JSONContent, VersionInfo } from './shared';

const RECOVERY_KEY = 'writely.recovery.v1';
const VERSIONS_KEY = 'writely.versions.v1';
const MAX_BYTES = 20 * 1024 * 1024;

function validDocument(value: unknown): DocumentFile {
  const doc = value as DocumentFile;
  const object = (item: unknown): item is Record<string, unknown> => item !== null && typeof item === 'object' && !Array.isArray(item);
  if (!doc || doc.schemaVersion !== 1 || typeof doc.id !== 'string' || !doc.id || doc.id.length > 128 || typeof doc.title !== 'string' || doc.title.length > 500 || !doc.content || doc.content.type !== 'doc' || !Array.isArray(doc.content.content) || !object(doc.styles) || !doc.page || !Array.isArray(doc.fonts)) throw new Error('Die Datei ist kein gültiges Writely-Dokument oder verwendet eine neuere Formatversion.');
  if (![doc.createdAt, doc.updatedAt].every(date => typeof date === 'string' && Number.isFinite(Date.parse(date)))) throw new Error('Die Writely-Datei enthält ungültige Zeitstempel.');
  for (const style of Object.values(doc.styles)) {
    if (!object(style) || (style.fontFamily !== undefined && typeof style.fontFamily !== 'string') || (style.fontSize !== undefined && (typeof style.fontSize !== 'number' || !Number.isFinite(style.fontSize))) || (style.basedOn !== undefined && typeof style.basedOn !== 'string')) throw new Error('Die Writely-Datei enthält eine ungültige Formatvorlage.');
  }
  if (doc.fonts.some(font => !object(font) || typeof font.family !== 'string')) throw new Error('Die Writely-Datei enthält eine ungültige Schriftartenliste.');
  let nodes = 0;
  validateLayout(doc.page);
  const walk = (node: JSONContent, depth: number) => {
    if (!object(node) || depth > 100 || ++nodes > 250_000 || typeof node.type !== 'string' || (node.text !== undefined && typeof node.text !== 'string') || (node.content !== undefined && !Array.isArray(node.content)) || (node.attrs !== undefined && !object(node.attrs)) || (node.marks !== undefined && !Array.isArray(node.marks))) throw new Error('Das Dokument enthält ungültige oder zu tief verschachtelte Inhalte.');
    if (node.marks?.some(mark => !object(mark) || typeof mark.type !== 'string' || (mark.attrs !== undefined && !object(mark.attrs)))) throw new Error('Das Dokument enthält eine ungültige Textformatierung.');
    if (node.marks?.some(mark => mark.type === 'textStyle' && mark.attrs?.fontFamily !== undefined && typeof mark.attrs.fontFamily !== 'string')) throw new Error('Das Dokument enthält einen ungültigen Schriftnamen.');
    if (node.type === 'image' && !/^data:image\/(png|jpeg|webp|gif);base64,/i.test(String(node.attrs?.src ?? ''))) throw new Error('Externe Bilder sind in der Browser-Vorschau nicht erlaubt. Bitte füge das Bild als lokale Datei ein.');
    if (node.marks?.some(mark => mark.type === 'link' && !/^(https?:|mailto:|#)/i.test(String(mark.attrs?.href ?? '')))) throw new Error('Das Dokument enthält einen nicht unterstützten Link.');
    node.content?.forEach(child => walk(child, depth + 1));
  };
  walk(doc.content, 0);
  return doc;
}

function readRecovery(): DocumentFile | null {
  const raw = localStorage.getItem(RECOVERY_KEY);
  if (!raw) return null;
  try { return validDocument(JSON.parse(raw)); }
  catch { throw new Error('Der lokale Wiederherstellungsstand konnte nicht gelesen werden. Er bleibt zur Prüfung erhalten. Öffne eine gespeicherte Dokumentdatei.'); }
}

type SavedVersion = VersionInfo & { document: DocumentFile; capturedAt?: number };
function readVersions(): SavedVersion[] {
  const raw = localStorage.getItem(VERSIONS_KEY);
  if (!raw) return [];
  try {
    const result = JSON.parse(raw);
    if (!Array.isArray(result)) throw new Error();
    for (const entry of result) {
      if (!entry || typeof entry.id !== 'string' || typeof entry.title !== 'string' || typeof entry.updatedAt !== 'string') throw new Error();
      validDocument(entry.document);
    }
    return result;
  }
  catch { throw new Error('Die lokale Versionshistorie ist beschädigt und konnte nicht gelesen werden.'); }
}

function rememberVersion(document: DocumentFile) {
  const versions = readVersions();
  // Keep version IDs immutable: restoring a snapshot must never change the version
  // the user selected just because a fresh recovery was written in the meantime.
  if (versions[0]?.document.id === document.id && JSON.stringify(versions[0].document) === JSON.stringify(document)) return;
  versions.unshift({ id: crypto.randomUUID(), title: document.title, updatedAt: document.updatedAt, capturedAt: Date.now(), document: structuredClone(document) });
  try { localStorage.setItem(VERSIONS_KEY, JSON.stringify(versions.slice(0, 30))); }
  catch { throw new Error('Die lokale Versionshistorie konnte nicht gesichert werden. Der Browser-Speicher ist möglicherweise voll. Speichere dein Dokument als Datei, bevor du wechselst.'); }
}

function download(value: string | Blob, name: string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(value instanceof Blob ? value : new Blob([value], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
function nodeHtml(node: JSONContent): string {
  if (node.type === 'text') {
    let value = escape(node.text ?? '');
    for (const mark of node.marks ?? []) {
      const tag = ({ bold: 'strong', italic: 'em', underline: 'u', strike: 's', code: 'code', highlight: 'mark' } as Record<string, string>)[mark.type];
      if (tag) value = `<${tag}>${value}</${tag}>`;
      else if (mark.type === 'link' && /^(https?:|mailto:|#)/i.test(String(mark.attrs?.href ?? ''))) value = `<a href="${escape(String(mark.attrs?.href))}">${value}</a>`;
    }
    return value;
  }
  if (node.type === 'hardBreak') return '<br>';
  if (node.type === 'horizontalRule') return '<hr>';
  if (node.type === 'image') return /^data:image\/(png|jpeg|webp|gif);base64,/i.test(String(node.attrs?.src ?? '')) ? `<img src="${escape(String(node.attrs?.src))}" alt="${escape(String(node.attrs?.alt ?? ''))}">` : '';
  const tags: Record<string, string> = { paragraph: 'p', blockquote: 'blockquote', bulletList: 'ul', orderedList: 'ol', listItem: 'li', table: 'table', tableRow: 'tr', tableHeader: 'th', tableCell: 'td', codeBlock: 'pre' };
  const tag = node.type === 'heading' ? `h${Math.max(1, Math.min(6, Number(node.attrs?.level) || 1))}` : tags[node.type ?? ''];
  const value = (node.content ?? []).map(nodeHtml).join('');
  const styleId = typeof node.attrs?.styleId === 'string' && /^[a-zA-Z][\w-]{0,60}$/.test(node.attrs.styleId) ? ` data-style-id="${node.attrs.styleId}"` : '';
  return tag ? `<${tag}${styleId}>${value}</${tag}>` : value;
}

function nodeMarkdown(node: JSONContent, depth = 0): string {
  if (node.type === 'text') {
    let value = (node.text ?? '').replace(/([\\`*_{}\[\]<>])/g, '\\$1');
    for (const mark of node.marks ?? []) { if (mark.type === 'bold') value = `**${value}**`; if (mark.type === 'italic') value = `*${value}*`; if (mark.type === 'link' && /^(https?:|mailto:|#)/i.test(String(mark.attrs?.href ?? ''))) value = `[${value}](${String(mark.attrs?.href).replace(/[()\s]/g, encodeURIComponent)})`; }
    return value;
  }
  const inner = (node.content ?? []).map(child => nodeMarkdown(child, depth + 1)).join('');
  if (node.type === 'heading') return `${'#'.repeat(Math.max(1, Math.min(6, Number(node.attrs?.level) || 1)))} ${inner}\n\n`;
  if (node.type === 'paragraph') return `${inner}\n\n`;
  if (node.type === 'listItem') return `- ${inner.trim()}\n`;
  if (node.type === 'blockquote') return `${inner.trim().split('\n').map(line => `> ${line}`).join('\n')}\n\n`;
  if (node.type === 'codeBlock') return `\`\`\`\n${documentText(node)}\n\`\`\`\n\n`;
  if (node.type === 'hardBreak') return '  \n';
  if (node.type === 'horizontalRule') return '\n---\n\n';
  if (node.type === 'table') return `${nodeHtml(node)}\n\n`;
  if (node.type === 'image') return `${nodeHtml(node)}\n\n`;
  return inner;
}

function htmlContent(source: string): JSONContent {
  const parsed = new DOMParser().parseFromString(source, 'text/html');
  const inline = (nodes: NodeListOf<ChildNode>, marks: JSONContent['marks'] = []): JSONContent[] => [...nodes].flatMap<JSONContent>(node => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ? [{ type: 'text', text: node.textContent, ...(marks.length ? { marks } : {}) }] : [];
    if (!(node instanceof Element)) return [];
    const tag = node.tagName.toLowerCase();
    if (['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'noscript', 'template'].includes(tag)) return [];
    if (tag === 'br') return [{ type: 'hardBreak' }];
    const mark = ({ strong: 'bold', b: 'bold', em: 'italic', i: 'italic', u: 'underline', s: 'strike', code: 'code', mark: 'highlight' } as Record<string, string>)[tag];
    const next = [...marks];
    if (mark) next.push({ type: mark });
    if (tag === 'a' && /^(https?:|mailto:|#)/i.test(node.getAttribute('href') ?? '')) next.push({ type: 'link', attrs: { href: node.getAttribute('href') } });
    return inline(node.childNodes, next);
  });
  const blocks = (nodes: NodeListOf<ChildNode>): JSONContent[] => [...nodes].flatMap<JSONContent>(node => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent?.trim() ? [{ type: 'paragraph', content: [{ type: 'text', text: node.textContent }] }] : [];
    if (!(node instanceof Element)) return [];
    const tag = node.tagName.toLowerCase();
    const importedStyle = node.getAttribute('data-style-id') ?? node.getAttribute('data-style');
    const styleAttrs = importedStyle && /^[a-zA-Z][\w-]{0,60}$/.test(importedStyle) ? { styleId: importedStyle } : {};
    if (['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'noscript', 'template', 'img'].includes(tag)) return [];
    if (/^h[1-6]$/.test(tag)) return [{ type: 'heading', attrs: { level: Number(tag[1]), ...styleAttrs }, content: inline(node.childNodes) }];
    if (tag === 'p') return [{ type: 'paragraph', attrs: styleAttrs, content: inline(node.childNodes) }];
    if (tag === 'blockquote') return [{ type: 'blockquote', attrs: styleAttrs, content: blocks(node.childNodes) }];
    if (tag === 'ul' || tag === 'ol') return [{ type: tag === 'ul' ? 'bulletList' : 'orderedList', content: [...node.children].filter(child => child.tagName === 'LI').map(child => ({ type: 'listItem', content: blocks(child.childNodes).length ? blocks(child.childNodes) : [{ type: 'paragraph', content: inline(child.childNodes) }] })) }];
    if (tag === 'pre') return [{ type: 'codeBlock', content: node.textContent ? [{ type: 'text', text: node.textContent }] : [] }];
    if (tag === 'hr') return [{ type: 'horizontalRule' }];
    if (tag === 'table') return [{ type: 'table', content: [...node.querySelectorAll('tr')].map(row => ({ type: 'tableRow', content: [...row.children].filter(cell => ['TD', 'TH'].includes(cell.tagName)).map(cell => ({ type: cell.tagName === 'TH' ? 'tableHeader' : 'tableCell', content: [{ type: 'paragraph', content: inline(cell.childNodes) }] })) })) }];
    return ['div', 'section', 'article', 'main', 'body', 'header', 'footer', 'li'].includes(tag) ? blocks(node.childNodes) : [{ type: 'paragraph', content: inline(node.childNodes) }];
  });
  const content = blocks(parsed.body.childNodes);
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

const browserApi: DesktopBridge = {
  platform: 'browser',
  async open() {
    const file = await new Promise<File | null>(resolve => {
      const input = document.createElement('input'); input.type = 'file'; input.accept = '.writely,.txt,.md,.markdown,.html,.htm';
      input.onchange = () => resolve(input.files?.[0] ?? null); input.addEventListener('cancel', () => resolve(null)); input.click();
    });
    if (!file) return null;
    if (file.size > MAX_BYTES) throw new Error('Die Datei ist zu groß für die Browser-Vorschau. Bitte nutze für Dateien über 20 MB die Desktop-App.');
    const raw = await file.text();
    const extension = file.name.split('.').pop()?.toLowerCase();
    let doc: DocumentFile;
    if (extension === 'writely') { try { doc = validDocument(JSON.parse(raw)); } catch (error) { throw error instanceof SyntaxError ? new Error('Die Writely-Datei enthält ungültiges JSON und konnte nicht geöffnet werden.') : error; } }
    else {
      doc = createDocument('blank'); doc.title = file.name.replace(/\.[^.]+$/, '');
      if (extension === 'txt') doc.content = { type: 'doc', content: raw.split(/\r?\n/).map(line => ({ type: 'paragraph', ...(line ? { content: [{ type: 'text', text: line }] } : {}) })) };
      else if (['md', 'markdown', 'html', 'htm'].includes(extension ?? '')) {
        doc.content = htmlContent(extension === 'md' || extension === 'markdown' ? await marked.parse(raw) : raw);
        doc.importWarnings = ['Import in der Browser-Vorschau: Externe Bilder und aktive Inhalte wurden entfernt. Komplexe Formatierungen können vereinfacht sein.'];
      } else throw new Error('Dieses Format wird in der Browser-Vorschau nicht unterstützt. Bitte nutze für DOCX die Desktop-App.');
    }
    return { path: file.name, document: doc };
  },
  async save(doc) {
    const valid = validDocument(doc);
    const name = `${valid.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') || 'Dokument'}.writely`;
    download(JSON.stringify(valid, null, 2), name, 'application/json');
    try { localStorage.setItem(RECOVERY_KEY, JSON.stringify(valid)); rememberVersion(valid); }
    catch { throw new Error('Der Dateidownload wurde gestartet. Die lokale Wiederherstellung und Versionshistorie konnten jedoch nicht vollständig gesichert werden. Bitte prüfe deinen Download.'); }
    return { path: name };
  },
  async recover() { return readRecovery(); },
  async autosave(doc) {
    const serialized = JSON.stringify(validDocument(doc));
    if (serialized.length > MAX_BYTES) throw new Error('Der Wiederherstellungsstand ist zu groß für den Browser-Speicher. Speichere das Dokument als Datei.');
    const previous = readRecovery();
    // Switching documents must preserve the final recovery, even if the last
    // interval snapshot is less than a minute old. Do this before overwriting it.
    if (previous && previous.id !== doc.id) rememberVersion(previous);
    const latest = readVersions().find(version => version.document.id === doc.id);
    const due = !latest || Date.now() - (latest.capturedAt ?? Date.parse(latest.updatedAt)) >= 60_000;
    // Archive before setting recovery so a quota failure cannot silently discard
    // the previous document when a new one becomes active.
    if (due) rememberVersion(doc);
    try { localStorage.setItem(RECOVERY_KEY, serialized); } catch { throw new Error('Der Browser-Speicher ist voll oder nicht verfügbar. Speichere dein Dokument mit Strg+S als Datei.'); }
  },
  async versions() {
    const current = readRecovery();
    if (current) rememberVersion(current);
    return readVersions().map(({ id, title, updatedAt }) => ({ id, title, updatedAt }));
  },
  async restoreVersion(id) {
    const found = readVersions().find(version => version.id === id);
    if (!found) throw new Error('Diese Dokumentversion ist nicht mehr verfügbar.');
    const result = structuredClone(validDocument(found.document));
    // Restoring an old version is also a document switch from a data-loss point
    // of view, including when both snapshots have the same document ID.
    const current = readRecovery();
    if (current) rememberVersion(current);
    return result;
  },
  async exportFile(format: ExportFormat, doc, html) {
    if (['docx','pdf','odt','rtf','epub'].includes(format)) throw new Error(`Bitte nutze die Desktop-App für den ${format.toUpperCase()}-Export.`);
    const name = `${doc.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') || 'Dokument'}.${format}`;
    const result = format === 'html' ? html || `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${escape(doc.title)}</title><style>${styleSheet(doc.styles)}</style></head><body><main class="tiptap">${nodeHtml(doc.content)}</main></body></html>` : format === 'md' ? nodeMarkdown(doc.content) : documentText(doc.content);
    download(result, name, format === 'html' ? 'text/html;charset=utf-8' : 'text/plain;charset=utf-8');
    return { path: name };
  },
  async listFonts() {
    await document.fonts.ready;
    const context = document.createElement('canvas').getContext('2d');
    if (!context) return ['Inter', 'Source Serif 4'];
    const sample = 'mmmmmmmmwwwwwwwiiiiiWritely012345';
    const measured = (family: string) => { context.font = `72px ${family}`; return context.measureText(sample).width; };
    const baseline = measured('monospace');
    const candidates = ['Arial', 'Calibri', 'Cambria', 'Consolas', 'Georgia', 'Segoe UI', 'Times New Roman', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Courier New', 'Impact', 'Wingdings'];
    return ['Inter', 'Source Serif 4', ...candidates.filter(family => measured(`"${family}",monospace`) !== baseline)];
  },
  minimize() {}, maximize() {}, close() {},
};

export function getApi(): DesktopBridge { return window.writely ?? browserApi; }
