import type { DocumentFile, JSONContent, StyleDefinition } from './types';

export const DEFAULT_STYLES: Record<string, StyleDefinition> = {
  normal: { name: 'Normaltext', fontFamily: 'Source Serif 4', fontSize: 12, color: '#34313c', lineHeight: 1.75 },
  h1: { name: 'Überschrift 1', fontFamily: 'Source Serif 4', fontSize: 30, color: '#2e2443', lineHeight: 1.18 },
  h2: { name: 'Überschrift 2', fontFamily: 'Inter', fontSize: 16, color: '#3a2b52', lineHeight: 1.45 },
  h3: { name: 'Überschrift 3', fontFamily: 'Inter', fontSize: 13, color: '#3a2b52', lineHeight: 1.45 },
  h4: { name: 'Überschrift 4', basedOn: 'h3', fontSize: 12 },
  h5: { name: 'Überschrift 5', basedOn: 'h3', fontSize: 11 },
  h6: { name: 'Überschrift 6', basedOn: 'h3', fontSize: 10 },
  quote: { name: 'Zitat', basedOn: 'normal', fontSize: 14, color: '#70578d', lineHeight: 1.7 },
  code: { name: 'Code', fontFamily: 'Consolas', fontSize: 10, color: '#39313f', lineHeight: 1.5 },
  caption: { name: 'Bildunterschrift', fontFamily: 'Inter', fontSize: 9, color: '#7d7589', lineHeight: 1.5 },
  footnote: { name: 'Fußnote', fontFamily: 'Source Serif 4', fontSize: 9, color: '#625a6d', lineHeight: 1.5 },
};

const text = (value: string, marks?: JSONContent['marks']): JSONContent => ({ type: 'text', text: value, ...(marks ? { marks } : {}) });
const paragraph = (...children: (string | JSONContent)[]): JSONContent => ({ type: 'paragraph', content: children.map(value => typeof value === 'string' ? text(value) : value).filter(node => node.type !== 'text' || !!node.text) });
const heading = (level: number, value: string): JSONContent => ({ type: 'heading', attrs: { level }, content: [text(value)] });

function welcome(): JSONContent[] {
  return [
    heading(1, 'Gute Ideen brauchen einen Anfang.'),
    paragraph('Manchmal ist es nur ein Satz. Ein flüchtiger Gedanke, ein Bild im Kopf oder eine Frage, die nicht mehr loslässt. Hier ist der Ort, an dem daraus etwas werden darf.'),
    paragraph('Willkommen bei ', text('Writely', [{ type: 'bold' }]), '. Ein ruhiger Raum für alles, was du schreiben möchtest. Ohne Ablenkung, ohne Umwege. Nur du, deine Gedanken und die nächste Zeile.'),
    heading(2, 'Ein Gedanke. Viele Möglichkeiten.'),
    paragraph('Ein gutes Dokument beginnt nicht mit der richtigen Schriftart. Es beginnt mit einer Idee. Halte sie fest, bevor sie weiterzieht. Die Form kannst du ihr später geben: mit klaren Überschriften, einer passenden Formatvorlage und dem nötigen Freiraum.'),
    { type: 'blockquote', content: [paragraph('„Schreiben heißt, sich selbst beim Denken zuzusehen.“')] },
    paragraph('Du musst noch nicht wissen, wohin dein Text führt. Ein erster Entwurf darf unvollständig sein. Er darf Fragen stellen, abbiegen und wieder von vorn beginnen. Wichtig ist nur, dass du anfängst.'),
    heading(2, 'Mehr Raum für deinen Text.'),
    paragraph('Alles, was du brauchst, ist schon da. Und alles andere wartet, bis du es brauchst:'),
    { type: 'bulletList', content: [
      { type: 'listItem', content: [paragraph(text('Struktur schaffen', [{ type: 'bold' }]), ' – mit Überschriften und dem Navigator.')] },
      { type: 'listItem', content: [paragraph(text('Im Fluss bleiben', [{ type: 'bold' }]), ' – mit Fokusmodus und schnellen Tastenkürzeln.')] },
      { type: 'listItem', content: [paragraph(text('Gedanken bewahren', [{ type: 'bold' }]), ' – lokal auf deinem Gerät, mit automatischer Wiederherstellung.')] },
    ] },
    paragraph('Dieser Text gehört jetzt dir. Verändere ihn, ergänze ihn oder beginne auf einer leeren Seite. Writely speichert deinen Arbeitsstand automatisch für die Wiederherstellung. Mit Strg+S legst du zusätzlich eine eigene Dokumentdatei an.'),
    paragraph(text('Dein nächster guter Gedanke wartet schon.', [{ type: 'italic' }])),
  ];
}

export function createDocument(template = 'welcome'): DocumentFile {
  const templates: Record<string, { title: string; content: JSONContent[] }> = {
    welcome: { title: 'Gedanken, die bleiben', content: welcome() },
    blank: { title: 'Unbenanntes Dokument', content: [paragraph()] },
    brief: { title: 'Mein Brief', content: [paragraph('Vorname Nachname'), paragraph('Straße und Hausnummer · PLZ Ort'), paragraph(''), paragraph('Empfängerin oder Empfänger'), paragraph('Straße und Hausnummer'), paragraph('PLZ Ort'), paragraph(''), paragraph('Ort, Datum'), heading(1, 'Betreff des Briefes'), paragraph('Sehr geehrte Damen und Herren,'), paragraph('hier beginnt Ihr Brief.'), paragraph('Mit freundlichen Grüßen'), paragraph('Vorname Nachname')] },
    bericht: { title: 'Mein Bericht', content: [heading(1, 'Bericht'), paragraph('Titel · Autorin oder Autor · Datum'), heading(2, 'Zusammenfassung'), paragraph('Die wichtigsten Ergebnisse auf einen Blick.'), heading(2, 'Ausgangslage'), paragraph('Beschreibe den Hintergrund und das Ziel des Berichts.'), heading(2, 'Ergebnisse'), paragraph('Halte Beobachtungen und Erkenntnisse fest.'), heading(2, 'Nächste Schritte'), paragraph('Welche Maßnahmen folgen daraus?')] },
    roman: { title: 'Mein Roman', content: [heading(1, 'Ein neuer Anfang'), paragraph('Ein Roman von …'), heading(2, 'Kapitel 1'), paragraph('An diesem Morgen war alles anders.'), paragraph('')] },
    protokoll: { title: 'Besprechungsprotokoll', content: [heading(1, 'Besprechungsprotokoll'), paragraph('Datum: … · Ort: …'), paragraph('Teilnehmende: …'), heading(2, 'Tagesordnung'), { type: 'orderedList', content: [{ type: 'listItem', content: [paragraph('Begrüßung und Ziele')] }, { type: 'listItem', content: [paragraph('Themen und Entscheidungen')] }] }, heading(2, 'Entscheidungen'), paragraph('Welche Entscheidungen wurden getroffen?'), heading(2, 'Aufgaben'), paragraph('Aufgabe · verantwortlich · Termin')] },
  };
  const chosen = templates[template] ?? templates.welcome;
  const now = new Date().toISOString();
  return {
    schemaVersion: 2, proofing:{language:'de-DE',enabled:true}, id: crypto.randomUUID(), title: chosen.title, createdAt: now, updatedAt: now,
    content: { type: 'doc', content: chosen.content }, styles: structuredClone(DEFAULT_STYLES),
    page: { size: 'A4', marginMm: 20 },
    fonts: [{ family: 'Inter', source: 'bundled' }, { family: 'Source Serif 4', source: 'bundled' }],
  };
}

export function documentText(content: JSONContent): string {
  if (content.type === 'text') return content.text ?? '';
  if(content.type==='toc')return content.attrs?.title||'Inhaltsverzeichnis';
  if (content.type === 'note')return ` [${content.attrs?.kind==='endnote'?'Endnote':'Fußnote'}: ${content.attrs?.text||''}] `;
  if (content.type === 'hardBreak') return '\n';
  const children = (content.content ?? []).map(documentText);
  return children.join(['doc', 'bulletList', 'orderedList', 'listItem', 'table', 'tableRow', 'tableCell', 'tableHeader', 'blockquote'].includes(content.type ?? '') ? '\n' : '');
}

export function documentStats(content: JSONContent) {
  const value = documentText(content);
  let paragraphs = 0;
  const countParagraphs = (node: JSONContent) => { if (node.type === 'paragraph' || node.type === 'heading') paragraphs++; node.content?.forEach(countParagraphs); };
  countParagraphs(content);
  const words = [...new Intl.Segmenter('de', { granularity: 'word' }).segment(value)].filter(segment => segment.isWordLike).length;
  return { words, characters: [...value].length, paragraphs, readingMinutes: words === 0 ? 0 : Math.max(1, Math.ceil(words / 200)) };
}

export function outline(content: JSONContent): { level: number; text: string; index: number }[] {
  const result: { level: number; text: string; index: number }[] = [];
  const walk = (node: JSONContent) => { if (node.type === 'heading') result.push({ level: Number(node.attrs?.level ?? 1), text: documentText(node), index: result.length }); node.content?.forEach(walk); };
  walk(content);
  return result;
}

function safeFont(value: string): string {
  return value.replace(/[^\p{L}\p{N} _.,-]/gu, '').slice(0, 120);
}

function cssProperties(style: StyleDefinition): string {
  const declarations: string[] = [];
  if (style.fontFamily && safeFont(style.fontFamily)) {
    const fallback = /mono|consolas|courier|fira code/i.test(style.fontFamily) ? 'monospace' : /inter|arial|calibri|segoe|sans|verdana|tahoma/i.test(style.fontFamily) ? 'sans-serif' : 'serif';
    declarations.push(`font-family:"${safeFont(style.fontFamily)}",${fallback}`);
  }
  if (typeof style.fontSize === 'number' && Number.isFinite(style.fontSize)) declarations.push(`font-size:${Math.max(6, Math.min(120, style.fontSize))}pt`);
  if (style.color && /^(#[0-9a-f]{3,8}|[a-z]{3,20})$/i.test(style.color)) declarations.push(`color:${style.color}`);
  if (typeof style.lineHeight === 'number' && Number.isFinite(style.lineHeight)) declarations.push(`line-height:${Math.max(1, Math.min(3, style.lineHeight))}`);
  return declarations.join(';');
}

export function styleSheet(styles: Record<string, StyleDefinition>): string {
  const resolve = (key: string, seen = new Set<string>()): StyleDefinition => {
    if (seen.has(key)) return { name: key };
    seen.add(key);
    const style = styles[key];
    return style ? { ...(style.basedOn ? resolve(style.basedOn, seen) : {}), ...style } : { name: key };
  };
  const selectors: Record<string, string> = { normal: '.tiptap', h1: '.tiptap h1', h2: '.tiptap h2', h3: '.tiptap h3', h4: '.tiptap h4', h5: '.tiptap h5', h6: '.tiptap h6', quote: '.tiptap blockquote', code: '.tiptap pre,.tiptap code' };
  return (styles.coverTitle?'.tiptap [data-style-id=coverTitle]{margin-top:60px}.tiptap hr:first-of-type{break-after:page}':'')+Object.keys(styles).filter(key => /^[a-zA-Z][\w-]{0,60}$/.test(key)).map(key => `${selectors[key] ?? `.tiptap [data-style="${key}"],.tiptap [data-style-id="${key}"]`}{${cssProperties(resolve(key))}}`).join('\n')+`\n.notes-list button{${cssProperties(resolve('footnote'))}}`;
}

export function resolveFont(requested: string, available: string[]): { family: string; substituted: boolean } {
  const exact = available.find(font => font.toLocaleLowerCase() === requested.toLocaleLowerCase());
  if (exact) return { family: exact, substituted: false };
  const lower = requested.toLocaleLowerCase();
  const preferred = /consolas|courier|mono|fira code|fira-code/.test(lower)
    ? ['JetBrains Mono', 'Fira Code', 'Noto Sans Mono', 'monospace']
    : /times|cambria|georgia|serif|merriweather|playfair/.test(lower)
      ? ['Source Serif 4', 'Noto Serif', 'Liberation Serif', 'serif']
      : ['Inter', 'Noto Sans', 'Liberation Sans', 'sans-serif'];
  const family = preferred.find(font => available.some(item => item.toLocaleLowerCase() === font.toLocaleLowerCase())) ?? preferred[preferred.length - 1];
  return { family, substituted: true };
}
