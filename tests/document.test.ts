import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createDocument, DEFAULT_STYLES, documentStats, documentText, outline, resolveFont, styleSheet } from '../src/document';

const { validateDocument } = createRequire(import.meta.url)('../electron/storage.cjs');

test('document templates are independent, valid and retain German typography', () => {
  const first = createDocument(); const second = createDocument();
  assert.notEqual(first.id, second.id);
  first.styles.normal.fontSize = 99;
  assert.equal(second.styles.normal.fontSize, 12);
  assert.match(documentText(second.content), /„Schreiben heißt/);
  assert.equal(outline(second.content).length, 3);
  assert.deepEqual(outline(second.content).map(item => item.index), [0, 1, 2]);
  for (const template of ['blank', 'brief', 'bericht', 'roman', 'protokoll']) assert.equal(createDocument(template).content.type, 'doc');
});

test('every template satisfies the desktop document schema, including empty paragraphs', () => {
  for (const template of ['welcome', 'blank', 'brief', 'bericht', 'roman', 'protokoll']) {
    const document = createDocument(template);
    assert.doesNotThrow(() => validateDocument(document), template);
    assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(document))), document);
  }
  for (const template of ['brief', 'roman']) {
    const empty = createDocument(template).content.content?.filter(node => node.type === 'paragraph' && node.content?.length === 0);
    assert.ok(empty?.length, `${template} retains its blank paragraphs without empty text nodes`);
  }
});

test('statistics count Unicode words and characters, paragraphs and reading time', () => {
  const content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Grüße aus Köln. 👋' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Hello world!' }] }] };
  const stats = documentStats(content);
  assert.equal(stats.words, 5);
  assert.equal(stats.characters, [...'Grüße aus Köln. 👋\nHello world!'].length);
  assert.equal(stats.paragraphs, 2);
  assert.equal(stats.readingMinutes, 1);
  assert.equal(documentStats(createDocument('blank').content).words, 0);
});

test('shared styles update every matching heading and inherited styles without duplicating text', () => {
  const styles = structuredClone(DEFAULT_STYLES);
  styles.h3.fontSize = 18;
  styles.normal.fontFamily = 'Inter';
  const css = styleSheet(styles);
  assert.match(css, /\.tiptap h3\{[^}]*font-size:18pt/);
  assert.match(css, /\.tiptap h4\{[^}]*font-family:"Inter"/);
  assert.match(css, /\.tiptap blockquote\{[^}]*font-family:"Inter"/);
  assert.equal((css.match(/\.tiptap h3\{/g) ?? []).length, 1);
});

test('style CSS rejects injection, handles inheritance cycles and clamps values', () => {
  const css = styleSheet({ normal: { name: 'Normal', fontFamily: 'Arial";background:url(https://evil.test)', color: 'red;background:black', fontSize: 999, lineHeight: 900 }, a: { name: 'A', basedOn: 'b' }, b: { name: 'B', basedOn: 'a' }, 'bad"{}': { name: 'Unsafe' } });
  assert.doesNotMatch(css, /url\(|https:|background:/);
  assert.doesNotMatch(css, /color:/);
  assert.match(css, /font-size:120pt/);
  assert.match(css, /line-height:3/);
});

test('font fallback preserves available fonts and chooses similar bundled families', () => {
  assert.deepEqual(resolveFont('Arial', ['Arial', 'Inter']), { family: 'Arial', substituted: false });
  assert.deepEqual(resolveFont('arial', ['Arial', 'Inter']), { family: 'Arial', substituted: false });
  assert.deepEqual(resolveFont('Cambria', ['Source Serif 4', 'Inter']), { family: 'Source Serif 4', substituted: true });
  assert.deepEqual(resolveFont('Calibri', ['Source Serif 4', 'Inter']), { family: 'Inter', substituted: true });
  assert.deepEqual(resolveFont('Consolas', ['JetBrains Mono', 'Inter']), { family: 'JetBrains Mono', substituted: true });
});
