/** Explicit, non-destructive migration. Unknown versions are rejected by validators. */
export function migrateDocument(value) {
  if (value?.schemaVersion === 1)
    return {
      ...structuredClone(value),
      schemaVersion: 2,
      proofing: value.proofing || { language: 'de-DE', enabled: true },
    };
  return value;
}
export function references(document) {
  const headings = [],
    notes = [],
    counters = { footnote: 0, endnote: 0 };
  const walk = (node) => {
    if (node.type === 'heading')
      headings.push({
        id: node.attrs?.anchorId || 'heading-' + (headings.length + 1),
        level: node.attrs?.level || 1,
        text: textContent(node),
        node,
      });
    if (node.type === 'note') {
      const kind = node.attrs?.kind || 'footnote';
      notes.push({
        id: node.attrs.id,
        kind,
        text: node.attrs.text,
        number: ++counters[kind],
        node,
      });
    }
    for (const child of node.content || []) walk(child);
  };
  walk(document.content);
  return { headings, notes };
}
export function textContent(node) {
  if (node.type === 'text') return node.text || '';
  if (node.type === 'hardBreak') return '\n';
  return (node.content || []).map(textContent).join('');
}
export const escapeReference = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export function tocHTML(document, node) {
  const e = escapeReference;
  return `<div class="writely-toc"><h2>${e(node.attrs?.title || 'Inhaltsverzeichnis')}</h2>${references(
    document,
  )
    .headings.filter((h) => h.level <= (node.attrs?.maxLevel || 6))
    .map(
      (h) =>
        `<p data-style-id="toc" style="margin-left:${(h.level - 1) * 12}px"><a href="#${e(h.id)}">${e(h.text)}</a></p>`,
    )
    .join('')}</div>`;
}
export function noteHTML(document, node) {
  const note = references(document).notes.find((n) => n.id === node.attrs.id);
  return `<sup><a id="ref-${escapeReference(node.attrs.id)}" href="#note-${escapeReference(node.attrs.id)}">${note?.kind === 'endnote' ? 'E' : ''}${note?.number || '†'}</a></sup>`;
}
export function notesHTML(document) {
  const notes = references(document).notes;
  if (!notes.length) return '';
  const e = escapeReference;
  return ['footnote', 'endnote']
    .map((kind) => {
      const list = notes.filter((n) => n.kind === kind);
      return list.length
        ? `<div class="writely-notes"><h2>${kind === 'footnote' ? 'Fußnoten' : 'Endnoten'}</h2>${list.map((n) => `<p id="note-${e(n.id)}" data-style-id="footnote"><a href="#ref-${e(n.id)}">${n.number}.</a> ${e(n.text).replace(/\n/g, '<br>')}</p>`).join('')}</div>`
        : '';
    })
    .join('');
}
export function exportWarnings(document, format) {
  const { notes } = references(document);
  const warnings = [];
  if (
    notes.some((n) => n.kind === 'footnote') &&
    ['pdf', 'html', 'md', 'txt', 'epub', 'rtf'].includes(format)
  )
    warnings.push(
      `${format.toUpperCase()}: Fußnoten werden ${format === 'txt' ? 'als Text an ihrer Referenz' : 'als verlinkte Noten am Dokumentende'} ausgegeben, nicht am unteren Rand jeder Druckseite.`,
    );
  if (notes.some((n) => n.kind === 'endnote') && ['md', 'txt', 'rtf'].includes(format))
    warnings.push(
      `${format.toUpperCase()}: Endnoten werden als Text ausgegeben; ihre bearbeitbare Notenstruktur wird in diesem Format nicht erhalten.`,
    );
  let toc = false;
  const walk = (n) => {
    if (n.type === 'toc') toc = true;
    n.content?.forEach(walk);
  };
  walk(document.content);
  if (toc)
    warnings.push(
      `${format.toUpperCase()}: Das Inhaltsverzeichnis wird ${format === 'odt' ? 'als ODF-Verzeichnis mit Einträgen' : 'als Momentaufnahme'} ohne Seitenzahlen ausgegeben. In Writely bleibt es dynamisch.`,
    );
  return warnings;
}
