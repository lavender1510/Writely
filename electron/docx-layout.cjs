const { parseDocument } = require('htmlparser2');
const render = require('dom-serializer').default;
const { openZip } = require('./roundtrip.cjs');
const { normalizeLayout, PAGE_SIZES } = require('./layout.mjs');
const { randomUUID } = require('node:crypto');
const child = (node, name) => (node?.children || []).find((n) => n.name === name);
function all(node, name) {
  const result = [];
  if (node?.name === name) result.push(node);
  for (const c of node?.children || []) result.push(...all(c, name));
  return result;
}
async function prepare(buffer) {
  const zip = await openZip(buffer);
  const entry = zip.file('word/document.xml');
  if (!entry) return { buffer, tokens: new Map() };
  const tree = parseDocument(await entry.async('string'), { xmlMode: true });
  const body = all(tree, 'w:body')[0];
  if (!body) return { buffer, tokens: new Map() };
  let relations = {};
  if (zip.file('word/_rels/document.xml.rels'))
    for (const rel of all(
      parseDocument(await zip.file('word/_rels/document.xml.rels').async('string'), {
        xmlMode: true,
      }),
      'Relationship',
    ))
      relations[rel.attribs.Id] = rel.attribs.Target;
  const layoutOf = async (sect) => {
    const size = child(sect, 'w:pgSz')?.attribs || {},
      mar = child(sect, 'w:pgMar')?.attribs || {},
      cols = child(sect, 'w:cols')?.attribs || {},
      num = child(sect, 'w:pgNumType')?.attribs || {};
    const mm = (s) => (Number(s) / 1440) * 25.4;
    const width = mm(size['w:w']) || 210,
      height = mm(size['w:h']) || 297;
    const preset = Object.keys(PAGE_SIZES).find((key) => {
      const p = PAGE_SIZES[key];
      return (
        Math.abs(Math.min(width, height) - p[0]) < 0.8 &&
        Math.abs(Math.max(width, height) - p[1]) < 0.8
      );
    });
    let l = normalizeLayout({
      size: preset || 'Custom',
      widthMm: width,
      heightMm: height,
      orientation: size['w:orient'] === 'landscape' || width > height ? 'landscape' : 'portrait',
      marginMm: 20,
      margins: {
        top: mar['w:top'] ? Math.max(0, mm(mar['w:top'])) : 20,
        bottom: mar['w:bottom'] ? Math.max(0, mm(mar['w:bottom'])) : 20,
        left: mar['w:left'] ? Math.max(0, mm(mar['w:left'])) : 20,
        right: mar['w:right'] ? Math.max(0, mm(mar['w:right'])) : 20,
      },
      gutterMm: Math.max(0, mm(mar['w:gutter']) || 0),
      columns: Math.max(1, Math.min(12, Number(cols['w:num']) || 1)),
      columnGapMm: Math.max(0, mm(cols['w:space']) || 8),
      numbering: {
        restart: num['w:start'] !== undefined,
        start: Math.max(1, Number(num['w:start']) || 1),
        enabled: false,
        format: /roman/i.test(num['w:fmt'])
          ? 'roman'
          : /letter/i.test(num['w:fmt'])
            ? 'letters'
            : 'arabic',
        firstDifferent: !!child(sect, 'w:titlePg'),
      },
    });
    for (const [tag, key] of [
      ['w:headerReference', 'header'],
      ['w:footerReference', 'footer'],
    ]) {
      const refs = all(sect, tag);
      const ref = refs.find((r) => r.attribs['w:type'] === 'default') || refs[0];
      const target = relations[ref?.attribs?.['r:id']];
      if (!target) continue;
      const path = require('node:path').posix.normalize('word/' + target);
      if (!path.startsWith('word/')) continue;
      const f = zip.file(path);
      if (!f) continue;
      const xml = await f.async('string');
      const parsed = parseDocument(xml, { xmlMode: true });
      l[key] = all(parsed, 'w:t')
        .map((n) => (n.children || []).map((c) => c.data || '').join(''))
        .join(' ')
        .slice(0, 2000);
      if (/\bPAGE\b|NUMPAGES/.test(xml)) {
        l.numbering.enabled = true;
        l.numbering.position = key;
      }
    }
    try {
      return require('./layout.mjs').validateLayout(l);
    } catch {
      return normalizeLayout({ size: preset || 'A4', marginMm: 20, orientation: l.orientation });
    }
  };
  const sectionNodes = (body.children || [])
    .map((n) => (n.name === 'w:sectPr' ? n : child(child(n, 'w:pPr'), 'w:sectPr')))
    .filter(Boolean);
  const layouts = await Promise.all(sectionNodes.map(layoutOf));
  const tokens = new Map();
  const token = (node) => {
    const key = 'WRITELYBREAK' + randomUUID().replace(/-/g, '').toUpperCase();
    tokens.set(key, node);
    return key;
  };
  const noteText = new Map();
  for (const [part, kind] of [
    ['word/footnotes.xml', 'footnote'],
    ['word/endnotes.xml', 'endnote'],
  ]) {
    const entry = zip.file(part);
    if (!entry) continue;
    const notes = parseDocument(await entry.async('string'), { xmlMode: true });
    for (const note of all(notes, kind === 'footnote' ? 'w:footnote' : 'w:endnote')) {
      const id = note.attribs['w:id'];
      if (Number(id) <= 0) continue;
      const text = all(note, 'w:p')
        .map((p) =>
          all(p, 'w:t')
            .map((t) => (t.children || []).map((c) => c.data || '').join(''))
            .join(''),
        )
        .join('\n');
      noteText.set(kind + id, text);
    }
  }
  for (const [tag, kind] of [
    ['w:footnoteReference', 'footnote'],
    ['w:endnoteReference', 'endnote'],
  ])
    for (const ref of all(body, tag)) {
      const text = noteText.get(kind + ref.attribs['w:id']);
      if (text === undefined)
        throw new Error('Der Import enthält eine Notenreferenz ohne Notentext.');
      const name = 'WRITELYNOTE' + randomUUID().replace(/-/g, '').toUpperCase();
      tokens.set(name, { type: 'note', attrs: { id: 'w-' + randomUUID(), kind, text } });
      ref.name = 'w:t';
      ref.attribs = {};
      ref.children = parseDocument(name, { xmlMode: true }).children;
    }
  let section = 0;
  const children = [];
  for (const node of body.children || []) {
    for (const br of all(node, 'w:br'))
      if (['page', 'column'].includes(br.attribs['w:type'])) {
        const breakKind = br.attribs['w:type'];
        br.name = 'w:t';
        br.attribs = {};
        br.children = parseDocument(
          token({
            type: 'layoutBreak',
            attrs: {
              kind: breakKind === 'column' ? 'column' : 'page',
              id: randomUUID(),
              layout: null,
            },
          }),
          { xmlMode: true },
        ).children;
      }
    children.push(node);
    if (child(child(node, 'w:pPr'), 'w:sectPr') && layouts[section + 1]) {
      section++;
      const marker = token({
        type: 'layoutBreak',
        attrs: { kind: 'section', id: randomUUID(), layout: layouts[section] },
      });
      children.push(
        parseDocument(`<w:p><w:r><w:t>${marker}</w:t></w:r></w:p>`, { xmlMode: true }).children[0],
      );
    }
  }
  body.children = children;
  zip.file('word/document.xml', render(tree, { xmlMode: true }));
  return { buffer: await zip.generateAsync({ type: 'nodebuffer' }), page: layouts[0], tokens };
}
function restore(content, tokens) {
  function blocks(nodes) {
    return (nodes || []).flatMap((node) => {
      if (['paragraph', 'heading'].includes(node.type)) {
        let current = [],
          result = [];
        for (const inline of node.content || []) {
          if (inline.type !== 'text') {
            current.push(inline);
            continue;
          }
          const pieces = inline.text.split(/(WRITELY(?:BREAK|NOTE)[A-F0-9]{32})/g);
          for (const piece of pieces) {
            if (tokens.has(piece) && tokens.get(piece).type === 'note') {
              current.push(tokens.get(piece));
            } else if (tokens.has(piece)) {
              if (current.length) result.push({ ...node, content: current });
              current = [];
              result.push(tokens.get(piece));
            } else if (piece) current.push({ ...inline, text: piece });
          }
        }
        if (current.length || !result.length) result.push({ ...node, content: current });
        return result;
      }
      const children = node.content ? blocks(node.content) : null;
      if (node.type === 'listItem' && children?.[0]?.type !== 'paragraph')
        children.unshift({ type: 'paragraph' });
      return [{ ...node, ...(children ? { content: children } : {}) }];
    });
  }
  return { ...content, content: blocks(content.content) };
}
module.exports = { prepare, restore };
