const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const sanitizeHtml = require('sanitize-html');
const { parseDocument } = require('htmlparser2');
const mammoth = require('mammoth');
const docx = require('docx');

const IMAGE_SOURCE = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-zA-Z0-9+/=\s]+$/;
const tags = ['p', 'div', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'a', 'img', 'span', 'sub', 'sup', 'hr'];

function imageDimensions(data, type) {
  if (type === 'png' && data.length >= 24 && data.subarray(1, 4).toString() === 'PNG') return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  if (type === 'gif' && data.length >= 10 && data.subarray(0, 3).toString() === 'GIF') return { width: data.readUInt16LE(6), height: data.readUInt16LE(8) };
  if ((type === 'jpeg' || type === 'jpg') && data.length >= 4) {
    let offset = 2;
    while (offset + 8 < data.length) {
      if (data[offset] !== 0xff) break;
      const marker = data[offset + 1];
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) return { width: data.readUInt16BE(offset + 7), height: data.readUInt16BE(offset + 5) };
      const size = data.readUInt16BE(offset + 2);
      if (size < 2) break;
      offset += size + 2;
    }
  }
  return { width: 480, height: 300 };
}

function safeHtml(html) {
  return sanitizeHtml(String(html), {
    allowedTags: tags,
    nonTextTags: ['script', 'style', 'textarea', 'option', 'head', 'title'],
    allowedAttributes: {
      '*': ['style', 'data-style-id', 'data-style'], a: ['href', 'title'], img: ['src', 'alt', 'width', 'height'],
      td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'], ol: ['start'],
    },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowedSchemesByTag: { img: ['data'] },
    allowProtocolRelative: false,
    allowedStyles: {
      '*': {
        color: [/^#[0-9a-fA-F]{3,8}$/, /^rgba?\([\d\s.,%]+\)$/, /^[a-zA-Z]+$/],
        'background-color': [/^#[0-9a-fA-F]{3,8}$/, /^[a-zA-Z]+$/],
        'font-family': [/^[\w\s,'"-]{1,120}$/u],
        'font-size': [/^\d{1,3}(\.\d{1,2})?(px|pt)$/],
        'line-height': [/^[1-3](\.\d{1,3})?$/],
        'text-align': [/^(left|right|center|justify)$/],
      },
    },
    exclusiveFilter: frame => frame.tag === 'img' && !IMAGE_SOURCE.test(frame.attribs.src || ''),
  });
}

function makeDocument(content, title, warnings = []) {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1, id: randomUUID(), title: title || 'Unbenannt', createdAt: now, updatedAt: now,
    content, styles: {}, page: { size: 'A4', marginMm: 20 }, fonts: [],
    ...(warnings.length ? { importWarnings: warnings } : {}),
  };
}

function css(style = '') {
  return Object.fromEntries(style.split(';').map(rule => rule.split(':').map(s => s.trim())).filter(pair => pair.length === 2));
}

function mergeText(nodes) {
  return nodes.reduce((out, node) => {
    const last = out[out.length - 1];
    if (node.type === 'text' && last?.type === 'text' && JSON.stringify(last.marks) === JSON.stringify(node.marks)) last.text += node.text;
    else out.push(node);
    return out;
  }, []);
}

function htmlToContent(source) {
  const root = parseDocument(safeHtml(source));
  function normalizeMarks(marks) {
    const result = new Map();
    for (const mark of marks) result.set(mark.type, { ...mark, ...(mark.attrs ? { attrs: { ...(result.get(mark.type)?.attrs || {}), ...mark.attrs } } : {}) });
    return Array.from(result.values());
  }
  function inlines(children, inherited = []) {
    const out = [];
    for (const node of children || []) {
      if (node.type === 'text') {
        if (node.data) out.push({ type: 'text', text: node.data.replace(/\r\n?/g, '\n'), ...(inherited.length ? { marks: normalizeMarks(inherited) } : {}) });
        continue;
      }
      if (node.type !== 'tag') continue;
      const marks = [...inherited];
      const markNames = { strong: 'bold', b: 'bold', em: 'italic', i: 'italic', u: 'underline', s: 'strike', del: 'strike', code: 'code', sub: 'subscript', sup: 'superscript' };
      if (markNames[node.name]) marks.push({ type: markNames[node.name] });
      if (node.name === 'a' && node.attribs.href) marks.push({ type: 'link', attrs: { href: node.attribs.href, target: '_blank', rel: 'noopener noreferrer' } });
      const styles = css(node.attribs.style);
      const attrs = {};
      if (styles.color) attrs.color = styles.color;
      if (styles['font-family']) attrs.fontFamily = styles['font-family'];
      if (styles['font-size']) attrs.fontSize = styles['font-size'];
      if (Object.keys(attrs).length) marks.push({ type: 'textStyle', attrs });
      if (styles['background-color']) marks.push({ type: 'highlight', attrs: { color: styles['background-color'] } });
      if (node.name === 'br') out.push({ type: 'hardBreak' });
      else if (node.name === 'img') out.push(imageNode(node));
      else out.push(...inlines(node.children, marks));
    }
    return mergeText(out);
  }
  function imageNode(node) {
    return { type: 'image', attrs: { src: node.attribs.src, alt: node.attribs.alt || '', ...(node.attribs.width ? { width: Number(node.attribs.width) || null } : {}), ...(node.attribs.height ? { height: Number(node.attribs.height) || null } : {}) } };
  }
  function paragraph(children, attrs = {}, style) {
    const inline = inlines(style ? [{ type: 'tag', name: 'span', attribs: { style }, children }] : children);
    // Tiptap's default Image extension is a block node, so images cannot sit inside paragraphs.
    const result = []; let run = [];
    const flush = () => { if (run.length) { result.push({ type: 'paragraph', attrs, content: run }); run = []; } };
    for (const node of inline) { if (node.type === 'image') { flush(); result.push(node); } else run.push(node); }
    flush();
    return result.length ? result : [{ type: 'paragraph', attrs }];
  }
  function blocks(children) {
    const out = []; let pending = [];
    const flush = () => {
      if (pending.some(n => n.type !== 'text' || n.data.trim())) out.push(...paragraph(pending));
      pending = [];
    };
    for (const node of children || []) {
      if (node.type === 'text') { pending.push(node); continue; }
      if (node.type !== 'tag') continue;
      const name = node.name;
      if (!['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'ul', 'ol', 'table', 'img', 'hr'].includes(name)) { pending.push(node); continue; }
      flush();
      const align = css(node.attribs.style)['text-align'];
      const id = node.attribs['data-style-id'] || node.attribs['data-style'];
      const attrs = { ...(align ? { textAlign: align } : {}), ...(typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id) ? { styleId: id } : {}) };
      if (/^h[1-6]$/.test(name)) out.push({ type: 'heading', attrs: { ...attrs, level: Number(name[1]) }, content: inlines([{ type: 'tag', name: 'span', attribs: { style: node.attribs.style || '' }, children: node.children }]).filter(n => n.type !== 'image') });
      else if (name === 'div' && node.children.some(n => n.type === 'tag' && ['p', 'div', 'table', 'ul', 'ol'].includes(n.name))) out.push(...blocks(node.children));
      else if (name === 'p' || name === 'div') out.push(...paragraph(node.children, attrs, node.attribs.style));
      else if (name === 'img') out.push(imageNode(node));
      else if (name === 'hr') out.push({ type: 'horizontalRule' });
      else if (name === 'blockquote') out.push({ type: 'blockquote', content: blocks(node.children) });
      else if (name === 'pre') {
        const text = nodeText(node);
        out.push({ type: 'codeBlock', ...(text ? { content: [{ type: 'text', text }] } : {}) });
      } else if (name === 'ul' || name === 'ol') {
        const items = node.children.filter(n => n.type === 'tag' && n.name === 'li').map(li => {
          const content = blocks(li.children);
          if (content[0]?.type !== 'paragraph') content.unshift({ type: 'paragraph' });
          return { type: 'listItem', content };
        });
        if (items.length) out.push({ type: name === 'ul' ? 'bulletList' : 'orderedList', ...(name === 'ol' ? { attrs: { start: Math.max(1, Number(node.attribs.start) || 1) } } : {}), content: items });
      } else if (name === 'table') {
        const rows = [];
        const collectRows = list => { for (const n of list || []) { if (n.name === 'tr') rows.push(n); else if (['thead', 'tbody', 'tfoot'].includes(n.name)) collectRows(n.children); } };
        collectRows(node.children);
        const content = rows.map(row => ({ type: 'tableRow', content: row.children.filter(n => n.type === 'tag' && ['td', 'th'].includes(n.name)).map(cell => ({
          type: cell.name === 'th' ? 'tableHeader' : 'tableCell', attrs: { colspan: Math.min(100, Math.max(1, Number(cell.attribs.colspan) || 1)), rowspan: Math.min(100, Math.max(1, Number(cell.attribs.rowspan) || 1)), colwidth: null }, content: blocks(cell.children).length ? blocks(cell.children) : [{ type: 'paragraph' }],
        })) })).filter(row => row.content.length);
        if (content.length) out.push({ type: 'table', content });
      }
    }
    flush(); return out;
  }
  const content = blocks(root.children);
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

function nodeText(node) { return node.type === 'text' ? node.data || node.text || '' : (node.children || node.content || []).map(nodeText).join(''); }

function decodeText(input) {
  const buffer = Buffer.from(input);
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString('utf16le');
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const flipped = Buffer.from(buffer.subarray(2, buffer.length - ((buffer.length - 2) % 2)));
    return flipped.swap16().toString('utf16le');
  }
  return buffer.toString('utf8').replace(/^\uFEFF/, '');
}

function checkDocxArchive(input) {
  const buffer = Buffer.from(input);
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error('Die DOCX-Datei ist beschädigt oder kein gültiges Dokument.');
  const entries = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  if (entries > 5000 || entries === 65535 || offset === 0xffffffff) throw new Error('Diese DOCX-Datei ist für den Basisimport zu komplex (maximal 5.000 Archiveinträge, kein ZIP64).');
  let total = 0;
  for (let i = 0; i < entries; i++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Die Verzeichnisstruktur der DOCX-Datei ist beschädigt.');
    const size = buffer.readUInt32LE(offset + 24);
    total += size;
    if (size > 30 * 1024 * 1024 || total > 100 * 1024 * 1024) throw new Error('Die entpackte DOCX-Datei ist zu groß für diese Vorabversion (maximal 100 MB insgesamt und 30 MB je Element).');
    if (buffer.readUInt16LE(offset + 8) & 1) throw new Error('Verschlüsselte DOCX-Dateien werden noch nicht unterstützt. Speichere eine unverschlüsselte Kopie.');
    offset += 46 + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
}

async function importFile(input, extension, fileName) {
  let buffer = input;
  if (typeof input === 'string' && !extension) { buffer = await fs.readFile(input); fileName = path.basename(input); extension = path.extname(input); }
  extension = String(extension || '').toLowerCase().replace(/^\./, '');
  const title = path.basename(fileName || 'Unbenannt', path.extname(fileName || ''));
  const warnings = [];
  let content;
  if (extension === 'docx') {
    checkDocxArchive(buffer);
    const result = await mammoth.convertToHtml({ buffer: Buffer.from(buffer) }, {
      externalFileAccess: false,
      includeDefaultStyleMap: true,
      styleMap: ["u => u", "p[style-name='Title'] => h1:fresh", "p[style-name='Subtitle'] => h2:fresh"],
      convertImage: mammoth.images.imgElement(async image => {
        const data = await image.read('base64');
        return { src: `data:${image.contentType};base64,${data}` };
      }),
    });
    content = htmlToContent(result.value);
    warnings.push('DOCX-Basisimport: Seitenlayout, Kopf-/Fußzeilen, Fußnoten, Kommentare und Änderungsverfolgung werden noch nicht originalgetreu übernommen. Bewahre die Originaldatei auf.');
    if (result.messages.length) warnings.push('Einige DOCX-Elemente konnten nicht vollständig übernommen werden.');
  } else {
    const source = decodeText(buffer);
    if (extension === 'txt') content = { type: 'doc', content: source.replace(/\r\n?/g, '\n').split('\n').map(text => ({ type: 'paragraph', ...(text ? { content: [{ type: 'text', text }] } : {}) })) };
    else if (extension === 'md' || extension === 'markdown') {
      const { marked } = await import('marked');
      content = htmlToContent(await marked.parse(source, { async: false }));
      if (/<img\b|!\[[^\]]*\]\((?!data:)/i.test(source)) warnings.push('Externe Bilder wurden für den Offlinebetrieb entfernt. Bilder lassen sich lokal neu einfügen.');
    } else if (extension === 'html' || extension === 'htm') {
      content = htmlToContent(source);
      warnings.push('HTML-Import: Skripte, externe Ressourcen und nicht unterstützte Layoutangaben wurden entfernt.');
    } else throw new Error(`Das Format „${extension || 'unbekannt'}“ wird in dieser Vorabversion noch nicht unterstützt. Öffne DOCX, TXT, Markdown, HTML oder eine Writely-Datei.`);
  }
  return makeDocument(content, title, warnings);
}

const escapeHtml = text => String(text ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
function styleKey(node) {
  if (node.attrs?.styleId) return node.attrs.styleId;
  return node.type === 'heading' ? `h${Math.min(6, Math.max(1, Number(node.attrs?.level) || 1))}` : node.type === 'blockquote' ? 'quote' : node.type === 'codeBlock' ? 'code' : 'normal';
}
function resolveStyle(document, key, visited = new Set()) {
  if (visited.has(key) || visited.size > 12) return {};
  visited.add(key);
  const style = document?.styles?.[key] || {};
  return { ...(style.basedOn ? resolveStyle(document, style.basedOn, visited) : {}), ...style };
}
function styleCss(style) {
  const values = [];
  if (typeof style.fontFamily === 'string' && /^[\w\s,'"-]{1,120}$/u.test(style.fontFamily)) values.push(`font-family:${style.fontFamily}`);
  if (typeof style.fontSize === 'number' && style.fontSize >= 4 && style.fontSize <= 300) values.push(`font-size:${style.fontSize}pt`);
  if (typeof style.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(style.color)) values.push(`color:${style.color}`);
  if (typeof style.lineHeight === 'number' && style.lineHeight >= 1 && style.lineHeight <= 3) values.push(`line-height:${style.lineHeight}`);
  return values.join(';');
}
function exportStyles(document) {
  const rules = [];
  if(document.theme==='Dunkel')rules.push('body{background:#25212d}');
  for (const [key, selector] of Object.entries({ normal: 'body,p,li,td,th', h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h5', h6: 'h6', quote: 'blockquote', code: 'pre,code' })) {
    const css = styleCss(resolveStyle(document, key));
    if (css) rules.push(`${selector}{${css}}`);
  }
  for (const key of Object.keys(document?.styles || {})) {
    if (/^[a-zA-Z0-9_-]{1,100}$/.test(key)) rules.push(`[data-style-id="${key}"],[data-style="${key}"]{${styleCss(resolveStyle(document, key))}}`);
  }
  if(document.styles?.coverTitle)rules.push('hr:first-of-type{break-after:page}');
  return rules.join('\n');
}
function contentHtml(node, document) {
  if (!node) return '';
  const inner = () => (node.content || []).map(child => contentHtml(child, document)).join('');
  const attrs = node.attrs || {};
  if (node.type === 'text') {
    let text = escapeHtml(node.text);
    for (const mark of node.marks || []) {
      const names = { bold: 'strong', italic: 'em', underline: 'u', strike: 's', code: 'code', subscript: 'sub', superscript: 'sup' };
      if (names[mark.type]) text = `<${names[mark.type]}>${text}</${names[mark.type]}>`;
      else if (mark.type === 'link') text = `<a href="${escapeHtml(mark.attrs?.href)}">${text}</a>`;
      else if (mark.type === 'textStyle') {
        const a = mark.attrs || {}; const style = [a.color && `color:${a.color}`, a.fontFamily && `font-family:${a.fontFamily}`, a.fontSize && `font-size:${a.fontSize}`].filter(Boolean).join(';');
        if (style) text = `<span style="${escapeHtml(style)}">${text}</span>`;
      } else if (mark.type === 'highlight') text = `<span style="background-color:${escapeHtml(mark.attrs?.color || '#fff2a8')}">${text}</span>`;
    }
    return text;
  }
  const css = [styleCss(resolveStyle(document, styleKey(node))), attrs.textAlign && `text-align:${attrs.textAlign}`].filter(Boolean).join(';');
  const idAttr = typeof attrs.styleId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(attrs.styleId) ? ` data-style-id="${escapeHtml(attrs.styleId)}"` : '';
  const align = `${css ? ` style="${escapeHtml(css)}"` : ''}${idAttr}`;
  if (node.type === 'doc') return inner();
  if (node.type === 'paragraph') return `<p${align}>${inner() || '<br>'}</p>`;
  if (node.type === 'heading') { const level = Math.min(6, Math.max(1, Number(attrs.level) || 1)); return `<h${level}${align}>${inner()}</h${level}>`; }
  const names = { bulletList: 'ul', orderedList: 'ol', listItem: 'li', blockquote: 'blockquote', table: 'table', tableRow: 'tr', tableCell: 'td', tableHeader: 'th' };
  if (names[node.type]) {
    const span = ['tableCell', 'tableHeader'].includes(node.type) ? ` colspan="${Math.max(1, Number(attrs.colspan) || 1)}" rowspan="${Math.max(1, Number(attrs.rowspan) || 1)}"` : node.type === 'orderedList' ? ` start="${Math.max(1, Number(attrs.start) || 1)}"` : '';
    return `<${names[node.type]}${span}>${inner()}</${names[node.type]}>`;
  }
  if (node.type === 'hardBreak') return '<br>';
  if (node.type === 'horizontalRule') return '<hr>';
  if (node.type === 'codeBlock') return `<pre><code>${inner()}</code></pre>`;
  if (node.type === 'image' && IMAGE_SOURCE.test(attrs.src || '')) return `<img src="${escapeHtml(attrs.src)}" alt="${escapeHtml(attrs.alt)}"${attrs.width ? ` width="${Math.max(1, Number(attrs.width) || 600)}"` : ''}${attrs.height ? ` height="${Math.max(1, Number(attrs.height) || 400)}"` : ''}>`;
  return inner();
}

function plainText(node) {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  if (node.type === 'hardBreak') return '\n';
  if (node.type === 'image') return node.attrs?.alt ? `[${node.attrs.alt}]` : '';
  const separator = ['doc', 'bulletList', 'orderedList', 'table', 'tableCell', 'tableHeader', 'blockquote'].includes(node.type) ? '\n' : node.type === 'tableRow' ? '\t' : '';
  return (node.content || []).map(plainText).join(separator);
}

function exportText(document, format) {
  if (format === 'txt') return plainText(document.content);
  const html = safeHtml(contentHtml(document.content, document));
  if (format === 'html') return `<!doctype html>\n<html lang="de"><head><meta charset="utf-8"><title>${escapeHtml(document.title)}</title><style>body{max-width:170mm;margin:20mm auto;font:12pt Georgia,serif;line-height:1.6}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:6px}img{max-width:100%;height:auto}pre{white-space:pre-wrap}${exportStyles(document)}</style></head><body>${html}</body></html>`;
  if (format === 'md') {
    const Turndown = require('turndown');
    const converter = new Turndown({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
    converter.addRule('table', {
      filter: 'table', replacement: (_, node) => {
        const rows = Array.from(node.querySelectorAll('tr')).map(row => Array.from(row.children).map(cell => converter.turndown(cell.innerHTML).replace(/\|/g, '\\|').replace(/\n/g, '<br>')));
        if (!rows.length) return '';
        const width = Math.max(...rows.map(row => row.length));
        const line = row => `| ${Array.from({ length: width }, (_, i) => row[i] || '').join(' | ')} |`;
        return `\n\n${line(rows[0])}\n${line(Array(width).fill('---'))}\n${rows.slice(1).map(line).join('\n')}\n\n`;
      },
    });
    return converter.turndown(html) + '\n';
  }
  throw new Error(`Der Export als „${format}“ wird noch nicht unterstützt.`);
}

async function exportDocx(document) {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, ExternalHyperlink, HeadingLevel, AlignmentType, WidthType, LevelFormat } = docx;
  const numbering = [];
  let coverSeparatorPending=!!document.styles?.coverTitle;
  const customIds = Object.fromEntries(Object.keys(document.styles || {}).map(key => [key, `Writely_${Buffer.from(key).toString('base64url')}`]));
  function runStyle(style) {
    const result = {};
    if (typeof style.fontFamily === 'string' && /^[\w\s,'"-]{1,120}$/u.test(style.fontFamily)) result.font = style.fontFamily.replace(/^['"]|['"]$/g, '');
    if (typeof style.fontSize === 'number' && style.fontSize >= 4 && style.fontSize <= 300) result.size = Math.round(style.fontSize * 2);
    if (typeof style.color === 'string' && /^#[0-9a-f]{6}$/i.test(style.color)) result.color = style.color.slice(1);
    if (typeof style.bold === 'boolean') result.bold = style.bold;
    if (typeof style.italic === 'boolean') result.italics = style.italic;
    return result;
  }
  function paragraphStyle(style) {
    return typeof style.lineHeight === 'number' && style.lineHeight >= 1 && style.lineHeight <= 3 ? { spacing: { line: Math.round(style.lineHeight * 240) } } : {};
  }
  function inline(nodes, inherited = {}) {
    return (nodes || []).flatMap(node => {
      if (node.type === 'hardBreak') return [new TextRun({ break: 1 })];
      if (node.type !== 'text') return inline(node.content, inherited);
      const options = { ...inherited, text: node.text || '' };
      let href;
      for (const mark of node.marks || []) {
        if (mark.type === 'bold') options.bold = true;
        if (mark.type === 'italic') options.italics = true;
        if (mark.type === 'underline') options.underline = {};
        if (mark.type === 'strike') options.strike = true;
        if (mark.type === 'subscript') options.subScript = true;
        if (mark.type === 'superscript') options.superScript = true;
        if (mark.type === 'code') options.font = 'Consolas';
        if (mark.type === 'link' && /^(https?:|mailto:)/i.test(mark.attrs?.href || '')) href = mark.attrs.href;
        if (mark.type === 'textStyle') {
          if (mark.attrs?.fontFamily) options.font = mark.attrs.fontFamily;
          if (mark.attrs?.color && /^#[0-9a-f]{6}$/i.test(mark.attrs.color)) options.color = mark.attrs.color.slice(1);
          const size = parseFloat(mark.attrs?.fontSize); if (size > 0 && size <= 300) options.size = Math.round(size * (String(mark.attrs.fontSize).endsWith('px') ? 1.5 : 2));
        }
      }
      const run = new TextRun(options);
      return [href ? new ExternalHyperlink({ children: [run], link: href }) : run];
    });
  }
  function blocks(nodes, list = null, level = 0) {
    return (nodes || []).flatMap(node => {
      const attrs = node.attrs || {};
      if (node.type === 'bulletList' || node.type === 'orderedList') {
        let config = { bullet: { level: Math.min(level, 8) } };
        if (node.type === 'orderedList') {
          const reference = `writely-list-${numbering.length}`;
          numbering.push({ reference, levels: Array.from({ length: 9 }, (_, i) => ({ level: i, format: LevelFormat.DECIMAL, text: `%${i + 1}.`, start: Math.max(1, Number(attrs.start) || 1), alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720 * (i + 1), hanging: 360 } } } })) });
          config = { numbering: { reference, level: Math.min(level, 8) } };
        }
        return (node.content || []).flatMap(item => blocks(item.content, config, level + 1));
      }
      if (node.type === 'table') return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: (node.content || []).map(row => new TableRow({ children: (row.content || []).map(cell => {
        const content = blocks(cell.content);
        return new TableCell({ children: content.length ? content : [new Paragraph('')], columnSpan: Number(cell.attrs?.colspan) || 1, ...(cell.type === 'tableHeader' ? { shading: { fill: 'EEEAF8' } } : {}) });
      }) })) })];
      if (node.type === 'image') {
        const match = /^data:image\/(png|jpeg|jpg|gif);base64,([\s\S]+)$/.exec(attrs.src || '');
        if (!match) throw new Error('Dieses Bildformat kann noch nicht als DOCX exportiert werden. Verwende PNG, JPG oder GIF oder exportiere als PDF.');
        const data = Buffer.from(match[2], 'base64');
        const intrinsic = imageDimensions(data, match[1]);
        const desiredWidth = Number(attrs.width) || intrinsic.width;
        const desiredHeight = Number(attrs.height) || desiredWidth * intrinsic.height / Math.max(1, intrinsic.width);
        const scale = Math.min(1, 600 / Math.max(1, desiredWidth), 900 / Math.max(1, desiredHeight));
        const width = Math.max(1, Math.round(desiredWidth * scale));
        const height = Math.max(1, Math.round(desiredHeight * scale));
        return [new Paragraph({ children: [new ImageRun({ data, type: ['jpg', 'jpeg'].includes(match[1]) ? 'jpg' : match[1], transformation: { width, height }, altText: { title: attrs.alt || 'Bild', description: attrs.alt || 'Bild', name: attrs.alt || 'Bild' } })] })];
      }
      if (node.type === 'blockquote') return blocks(node.content).map(p => p instanceof Paragraph ? p : p);
      if (node.type === 'listItem') return blocks(node.content, list, level);
      if (node.type === 'horizontalRule' && coverSeparatorPending) {coverSeparatorPending=false;return [new Paragraph({children:[new docx.PageBreak()]})];}
      if (node.type === 'horizontalRule') return [new Paragraph({ border: { bottom: { color: 'AAAAAA', size: 6, style: 'single' } }, children: [] })];
      if (!['paragraph', 'heading', 'codeBlock'].includes(node.type)) return blocks(node.content, list, level);
      const alignment = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED }[attrs.textAlign];
      const key = styleKey(node);
      const resolved = resolveStyle(document, key);
      const headingLevel = Math.min(6, Math.max(1, Number(attrs.level) || 1));
      const isCustom = attrs.styleId && customIds[attrs.styleId] && !/^h[1-6]$/.test(attrs.styleId);
      const style = isCustom ? { style: customIds[attrs.styleId], ...(node.type === 'heading' ? { outlineLevel: headingLevel - 1 } : {}) } : node.type === 'heading' ? { heading: HeadingLevel[`HEADING_${headingLevel}`] } : {};
      const spacing = paragraphStyle(resolved).spacing || {};
      const result = new Paragraph({ ...style, ...(list || {}), ...(alignment ? { alignment } : {}), spacing: { after: 180, ...spacing }, children: inline(node.content, { ...runStyle(resolved), ...(node.type === 'codeBlock' ? { font: 'Consolas' } : {}) }) });
      // Number only the first paragraph in a list item, leaving subsequent blocks unnumbered.
      list = null;
      return [result];
    });
  }
  const children = blocks(document.content?.content || []);
  const margin = Math.round(Math.min(60, Math.max(5, Number(document.page?.marginMm) || 20)) / 25.4 * 1440);
  const letter = document.page?.size === 'Letter';
  const semanticDefaults = Object.fromEntries(Array.from({ length: 6 }, (_, i) => i + 1).filter(level => document.styles?.[`h${level}`]).map(level => [`heading${level}`, { run: runStyle(resolveStyle(document, `h${level}`)), paragraph: paragraphStyle(resolveStyle(document, `h${level}`)) }]));
  const file = new Document({
    ...(document.theme==='Dunkel'?{background:{color:'25212d'}}:{}),
    creator: 'Writely', title: document.title || 'Unbenannt', description: 'Mit Writely erstellt',
    styles: {
      default: { document: { run: { font: 'Georgia', size: 24, ...runStyle(resolveStyle(document, 'normal')) }, paragraph: { spacing: { line: 300, ...(paragraphStyle(resolveStyle(document, 'normal')).spacing || {}) } } }, ...semanticDefaults },
      paragraphStyles: Object.entries(document.styles || {}).map(([key, style]) => ({ id: customIds[key], name: String(style.name || key), basedOn: customIds[style.basedOn] || 'Normal', run: runStyle(resolveStyle(document, key)), paragraph: paragraphStyle(resolveStyle(document, key)) })),
    },
    numbering: { config: numbering },
    sections: [{ properties: { page: { size: { width: letter ? 12240 : 11906, height: letter ? 15840 : 16838 }, margin: { top: margin, right: margin, bottom: margin, left: margin } } }, children: children.length ? children : [new Paragraph('')] }],
  });
  return Packer.toBuffer(file);
}

async function exportDocument(format, document) {
  return format === 'docx' ? exportDocx(document) : exportText(document, format);
}

module.exports = { importFile, exportDocument, exportDocx, exportText, safeHtml, htmlToContent, contentHtml, exportStyles };
