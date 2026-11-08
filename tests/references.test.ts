import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createDocument } from '../src/document';
import { migrateDocument, references, exportWarnings } from '../electron/document-schema.mjs';
const require = createRequire(import.meta.url),
  { validateDocument, readDocument } = require('../electron/storage.cjs'),
  { exportDocx, importFile, exportText } = require('../electron/formats.cjs'),
  { exportOdt } = require('../electron/odt.cjs'),
  { convert } = require('../electron/converters.cjs'),
  JSZip = require('jszip');
function sample() {
  const d = createDocument('blank');
  d.content = {
    type: 'doc',
    content: [
      { type: 'toc', attrs: { id: 'toc-1', title: 'Inhaltsverzeichnis', maxLevel: 6 } },
      {
        type: 'heading',
        attrs: { level: 1, anchorId: 'kapitel-1' },
        content: [{ type: 'text', text: 'Kapitel – Größe' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Ein Gedanke' },
          {
            type: 'note',
            attrs: { id: 'note-1', kind: 'footnote', text: 'Eine wichtige Fußnote: ÄÖÜ ß.' },
          },
          { type: 'text', text: ' und noch einer' },
          { type: 'note', attrs: { id: 'note-2', kind: 'endnote', text: 'Endnote mit Quelle.' } },
        ],
      },
    ],
  };
  return d;
}
test('explicit v1 migration preserves legacy tables, images and layouts and rejects unknown versions', () => {
  const legacy = { ...createDocument('welcome'), schemaVersion: 1 };
  const before = structuredClone(legacy);
  const current = migrateDocument(legacy);
  assert.equal(current.schemaVersion, 2);
  assert.deepEqual(current.content, legacy.content);
  assert.deepEqual(current.page, legacy.page);
  assert.deepEqual(legacy, before);
  validateDocument(current);
  assert.throws(() => validateDocument({ ...current, schemaVersion: 3 }), /Dateiversion/);
});
test('notes are numbered by occurrence and kind, TOC is derived from current headings', () => {
  const d = sample();
  validateDocument(d);
  assert.deepEqual(
    references(d).notes.map((n) => n.number),
    [1, 1],
  );
  const html = exportText(d, 'html');
  assert.match(html, /href="#kapitel-1"/);
  assert.match(html, /Eine wichtige Fußnote/);
  assert.match(html, /id="note-note-1"/);
  assert.ok(exportWarnings(d, 'pdf').some((w) => w.includes('nicht am unteren Rand')));
  assert.ok(exportWarnings(d, 'docx').some((w) => w.includes('Momentaufnahme')));
  assert.throws(() => validateDocument({ ...d, schemaVersion: 1 }), /Dokumentversion 2/);
});
test('DOCX emits genuine foot/endnote parts and bookmarks, external reimport retains both texts', async () => {
  const d = sample(),
    bytes = await exportDocx(d),
    zip = await JSZip.loadAsync(bytes);
  assert.match(await zip.file('word/footnotes.xml').async('string'), /Eine wichtige Fußnote/);
  assert.match(await zip.file('word/endnotes.xml').async('string'), /Endnote mit Quelle/);
  const xml = await zip.file('word/document.xml').async('string');
  assert.match(xml, /w:footnoteReference/);
  assert.match(xml, /w:endnoteReference/);
  assert.match(xml, /w:bookmarkStart/);
  assert.match(xml, /w:anchor="w_[a-f0-9]{32}"/);
  zip.remove('META-INF/writely-document.json');
  const external = await importFile(
    await zip.generateAsync({ type: 'nodebuffer' }),
    'docx',
    'Word.docx',
  );
  validateDocument(external);
  assert.deepEqual(
    references(external).notes.map((n) => n.kind),
    ['footnote', 'endnote'],
  );
  assert.match(references(external).notes[0].text, /ÄÖÜ ß/);
});
test('ODT writes native notes and TOC and external semantic import retains note bodies', async () => {
  const bytes = await exportOdt(sample()),
    zip = await JSZip.loadAsync(bytes),
    xml = await zip.file('content.xml').async('string');
  assert.match(xml, /text:note-class="footnote"/);
  assert.match(xml, /text:note-class="endnote"/);
  assert.match(xml, /text:table-of-content/);
  const parsed = await require('../electron/odt-layout.cjs').prepare(bytes),
    html = await convert(parsed.buffer, 'odt', 'html');
  const d = await importFile(html, 'html', 'LibreOffice.html');
  d.content = require('../electron/docx-layout.cjs').restore(d.content, parsed.tokens);
  validateDocument(d);
  assert.equal(references(d).notes.length, 2);
  assert.match(references(d).notes[0].text, /wichtige Fußnote/);
});
