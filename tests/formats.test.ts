import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { importFile, exportDocx, exportText, safeHtml, htmlToContent, exportStyles } = require('../electron/formats.cjs');

const text = (value: string, marks?: any[]) => ({ type: 'text', text: value, ...(marks ? { marks } : {}) });
const paragraph = (...content: any[]) => ({ type: 'paragraph', content });
const document = (content: any[]) => ({
  schemaVersion: 1, id: 'test-document', title: 'Gedanken – Grüße aus Köln', createdAt: '2026-11-08T12:00:00Z', updatedAt: '2026-11-08T12:00:00Z',
  content: { type: 'doc', content }, styles: {}, page: { size: 'A4', marginMm: 20 }, fonts: [],
});
function descendants(node: any, type: string): any[] { return [...(node.type === type ? [node] : []), ...(node.content || []).flatMap((child: any) => descendants(child, type))]; }

test('TXT preserves empty paragraphs, Unicode and line endings', async () => {
  const file = await importFile(Buffer.from('Grüße, Straße und „Ideen“\r\n\r\n日本語 ✦'), 'txt', 'Notizen.txt');
  assert.equal(file.title, 'Notizen');
  assert.equal(file.content.content.length, 3);
  assert.equal(exportText(file, 'txt'), 'Grüße, Straße und „Ideen“\n\n日本語 ✦');
  const windowsText = await importFile(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('Grüße aus Köln', 'utf16le')]), 'txt', 'Windows.txt');
  assert.equal(exportText(windowsText, 'txt'), 'Grüße aus Köln');
});

test('HTML import strips scripts, event handlers, remote images and unsafe URLs', async () => {
  const html = '<script>globalThis.bad = true</script><h2 onclick="evil()">Sicher</h2><p style="background-image:url(https://example.com/track);font-size:16px">Text <a href="javascript:alert(1)">Link</a><img src="https://example.com/pixel"><img src="data:image/svg+xml;base64,PHN2Zz4="><strong>Fett</strong></p>';
  const cleaned = safeHtml(html);
  assert.doesNotMatch(cleaned, /script|onclick|javascript|example\.com|svg\+xml|background-image/);
  const file = await importFile(Buffer.from(html), 'html', 'Sicher.html');
  assert.equal(descendants(file.content, 'heading')[0].attrs.level, 2);
  assert.equal(descendants(file.content, 'image').length, 0);
  assert.ok(descendants(file.content, 'text').some((n: any) => n.text === 'Fett' && n.marks.some((m: any) => m.type === 'bold')));
  assert.equal(descendants(file.content, 'text').some((n: any) => n.text.includes('globalThis')), false);
});

test('HTML puts embedded raster images between paragraphs as block nodes', () => {
  const content = htmlToContent('<p>Vorher<img src="data:image/png;base64,aGVsbG8=" alt="Skizze">Nachher</p>');
  assert.deepEqual(content.content.map((node: any) => node.type), ['paragraph', 'image', 'paragraph']);
  assert.equal(content.content[1].attrs.alt, 'Skizze');
});

test('Markdown imports headings, lists, links and GFM tables', async () => {
  const md = '# Kapitel\n\n**Gute** Ideen [lesen](https://example.com).\n\n- Eins\n- Zwei\n\n| Name | Wert |\n| --- | --- |\n| Äpfel | 2 |\n';
  const file = await importFile(Buffer.from(md), 'md', 'Bericht.md');
  assert.equal(descendants(file.content, 'heading').length, 1);
  assert.equal(descendants(file.content, 'listItem').length, 2);
  assert.equal(descendants(file.content, 'table').length, 1);
  const exported = exportText(file, 'md');
  assert.match(exported, /# Kapitel/);
  assert.match(exported, /\*\*Gute\*\*/);
  assert.match(exported, /\| Name \| Wert \|/);
  assert.match(exported, /Äpfel/);
});

test('DOCX roundtrip preserves Unicode, heading, bold, list and table text', async () => {
  const file = document([
    { type: 'heading', attrs: { level: 1 }, content: [text('Über die Straße')] },
    paragraph(text('Ein '), text('fetter Gedanke', [{ type: 'bold' }]), text(' – Grüße!')),
    { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph(text('Erstens'))] }] },
    { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableHeader', content: [paragraph(text('Spalte'))] }, { type: 'tableCell', content: [paragraph(text('Wert 42'))] }] }] },
    { type: 'image', attrs: { src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7xkAAAAASUVORK5CYII=', alt: 'Ein Pixel', width: 32, height: 32 } },
  ]);
  const buffer = await exportDocx(file);
  assert.equal(buffer.subarray(0, 2).toString(), 'PK');
  const imported = await importFile(buffer, 'docx', 'Gedanken.docx');
  const plain = exportText(imported, 'txt');
  assert.match(plain, /Über die Straße/);
  assert.match(plain, /fetter Gedanke/);
  assert.match(plain, /Wert 42/);
  assert.equal(descendants(imported.content, 'heading')[0].attrs.level, 1);
  assert.ok(descendants(imported.content, 'text').some((n: any) => n.text.includes('fetter Gedanke') && n.marks?.some((m: any) => m.type === 'bold')));
  assert.equal(descendants(imported.content, 'table').length, 1);
  assert.equal(descendants(imported.content, 'bulletList').length, 1);
  assert.equal(descendants(imported.content, 'image').length, 1);
  assert.ok(imported.importWarnings.length > 0);
});

test('DOCX import rejects broken archives with a German error', async () => {
  await assert.rejects(() => importFile(Buffer.from('kein ZIP'), 'docx', 'kaputt.docx'), /DOCX-Datei ist beschädigt/);
});

test('unsupported formats report a concrete German fallback', async () => {
  await assert.rejects(() => importFile(Buffer.from(''), 'odt', 'Datei.odt'), /noch nicht unterstützt.*DOCX/);
});

test('HTML export escapes document title and malicious link attributes', () => {
  const file = document([paragraph(text('<Gedanke>', [{ type: 'link', attrs: { href: 'javascript:evil()' } }]))]);
  file.title = '<script>evil()</script>';
  const html = exportText(file, 'html');
  assert.doesNotMatch(html, /<script>|javascript:/);
  assert.match(html, /&lt;Gedanke&gt;/);
  assert.match(html, /&lt;script&gt;/);
});

test('named styles resolve inheritance in HTML and DOCX export without CSS injection', async () => {
  const file: any = document([
    { type: 'heading', attrs: { level: 1 }, content: [text('Titel')] },
    { type: 'paragraph', attrs: { styleId: 'aside' }, content: [text('Randgedanke')] },
  ]);
  file.styles = {
    normal: { name: 'Normaltext', fontFamily: 'Source Serif 4', fontSize: 12, lineHeight: 1.6 },
    h1: { name: 'Überschrift 1', basedOn: 'normal', fontSize: 24, color: '#543090' },
    aside: { name: 'Randnotiz', basedOn: 'normal', fontSize: 10, color: '#444444' },
    malicious: { name: 'Malicious', fontFamily: 'bad;</style><script>evil()</script>', color: 'red;background:url(https://evil.example)' },
  };
  const html = exportText(file, 'html');
  assert.match(html, /<h1 id="heading-1" style="font-family:Source Serif 4;font-size:24pt;color:#543090;line-height:1.6">Titel<\/h1>/);
  assert.match(html, /font-size:10pt;color:#444444/);
  assert.doesNotMatch(html, /<script>|evil\.example/);
  const roundtrip = await importFile(await exportDocx(file), 'docx', 'Styles.docx');
  assert.equal(descendants(roundtrip.content, 'heading').length, 1);
  assert.match(exportText(roundtrip, 'txt'), /Randgedanke/);
});

test('named style IDs roundtrip through HTML with both supported attribute spellings', async () => {
  const file: any = document([
    { type: 'heading', attrs: { level: 2, styleId: 'chapter' }, content: [text('Kapitel')] },
    { type: 'paragraph', attrs: { styleId: 'aside' }, content: [text('Randgedanke')] },
  ]);
  file.styles = {
    chapter: { name: 'Kapitel', fontSize: 20, color: '#543090' },
    aside: { name: 'Randnotiz', fontSize: 10, lineHeight: 1.4 },
  };
  const html = exportText(file, 'html');
  assert.match(html, /data-style-id="chapter"/);
  assert.match(html, /data-style-id="aside"/);
  const roundtrip = await importFile(Buffer.from(html), 'html', 'Styles.html');
  assert.equal(roundtrip.content.content.length, 2);
  assert.equal(descendants(roundtrip.content, 'heading')[0].attrs.styleId, 'chapter');
  assert.equal(descendants(roundtrip.content, 'paragraph')[0].attrs.styleId, 'aside');
  assert.ok(descendants(roundtrip.content, 'text')[0].marks.some((mark: any) => mark.type === 'textStyle' && mark.attrs.fontSize === '20pt'));
  const legacy = htmlToContent('<h2 data-style="chapter">Titel</h2><p data-style="aside">Text</p>');
  assert.equal(legacy.content[0].attrs.styleId, 'chapter');
  assert.equal(legacy.content[1].attrs.styleId, 'aside');
  assert.match(exportStyles(file), /\[data-style-id="aside"\],\[data-style="aside"\]/);
});

test('print styles reject font size and selector injection', () => {
  const file: any = document([]);
  file.styles = {
    normal: { name: 'Normal', fontSize: '12pt;}body{background:url(https://evil.example)}', lineHeight: Infinity, color: '#123456' },
    'bad"]{}<style>': { name: 'Bad', fontSize: 12 },
  };
  const css = exportStyles(file);
  assert.doesNotMatch(css, /font-size|Infinity|evil\.example|<style>|bad/);
  assert.match(css, /color:#123456/);
});
