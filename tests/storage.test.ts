import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { LocalStore, validateDocument, readDocument } = require('../electron/storage.cjs');

function document(title = 'Entwurf') {
  return { schemaVersion: 1, id: 'test-document', title, createdAt: '2026-11-08T12:00:00Z', updatedAt: new Date().toISOString(), content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Grüße, Straße und „Schreiben“.' }] }] }, styles: {}, page: { size: 'A4', marginMm: 20 }, fonts: [] };
}
async function setup(t: any, options = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'writely-storage-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, store: new LocalStore(directory, options) };
}

test('atomic saving preserves German Unicode and a recoverable document', async t => {
  const { directory, store } = await setup(t);
  const target = path.join(directory, 'Mein Dokument.writely');
  const value = document();
  await store.save(value, target);
  assert.deepEqual(await readDocument(target), {...value,schemaVersion:2,proofing:{language:'de-DE',enabled:true}});
  assert.deepEqual(await store.recover(), {...value,schemaVersion:2,proofing:{language:'de-DE',enabled:true}});
  assert.ok((await readFile(target, 'utf8')).includes('Grüße'));
  assert.equal((await readdir(directory)).some((name: string) => name.endsWith('.tmp')), false);
});

test('concurrent autosaves serialize and recover the latest snapshot', async t => {
  const { store } = await setup(t);
  await Promise.all(Array.from({ length: 12 }, (_, index) => store.autosave(document(`Entwurf ${index}`))));
  assert.equal((await store.recover()).title, 'Entwurf 11');
});

test('damaged latest recovery falls back to the preceding valid snapshot', async t => {
  const { directory, store } = await setup(t);
  await store.autosave(document('Vorherige Fassung'));
  await store.autosave(document('Neuere Fassung'));
  await writeFile(path.join(directory, 'recovery.writely'), '{unvollständig');
  assert.equal((await store.recover()).title, 'Vorherige Fassung');
});

test('version history is bounded, restorable and rejects traversal', async t => {
  const { directory, store } = await setup(t, { historyLimit: 3, snapshotIntervalMs: 0 });
  for (let index = 0; index < 5; index++) await store.save(document(`Fassung ${index}`), path.join(directory, 'test.writely'));
  const versions = await store.versions();
  assert.equal(versions.length, 3);
  const latest = await store.restoreVersion(versions[0].id);
  assert.ok(latest.title.startsWith('Fassung'));
  await assert.rejects(store.restoreVersion('../recovery'), /ungültig/);
});

test('validation rejects incompatible versions, malformed layout and prototype pollution', () => {
  assert.throws(() => validateDocument({ ...document(), schemaVersion: 3 }), /Dateiversion/);
  assert.throws(() => validateDocument({ ...document(), page: { size: 'A4', marginMm: -5 } }), /Seiteneinstellungen/);
  const polluted = JSON.parse(JSON.stringify(document()).replace('"styles":{}', '"styles":{"__proto__":{"polluted":true}}'));
  assert.throws(() => validateDocument(polluted), /Schlüssel/);
  assert.equal(({} as any).polluted, undefined);
});

test('invalid new content never replaces the valid recovery', async t => {
  const { store } = await setup(t);
  await store.autosave(document('Bewahrt'));
  await assert.rejects(store.autosave({ ...document(), content: {} }), /Dokumentinhalt/);
  assert.equal((await store.recover()).title, 'Bewahrt');
});

test('switching documents preserves the latest typing inside the timed snapshot interval', async t => {
  const { store } = await setup(t, { snapshotIntervalMs: 60_000 });
  await store.autosave(document('Erster Stand'));
  await store.autosave(document('Letzte ungespeicherte Eingaben'));
  assert.equal((await store.versions()).length, 1);
  await store.autosave({ ...document('Anderes Dokument'), id: 'other-document' });
  const history = await store.versions();
  assert.ok(history.some((version: any) => version.title === 'Letzte ungespeicherte Eingaben'));
  assert.equal((await store.recover()).title, 'Anderes Dokument');
});

test('restoring an older version archives current changes even for the same document ID', async t => {
  const { store } = await setup(t, { snapshotIntervalMs: 60_000 });
  await store.autosave(document('Alte Fassung'));
  const original = (await store.versions())[0];
  await store.autosave(document('Jüngste Eingaben vor Wiederherstellung'));
  const restored = await store.restoreVersion(original.id);
  assert.equal(restored.title, 'Alte Fassung');
  const history = await store.versions();
  assert.equal(history[0].title, 'Jüngste Eingaben vor Wiederherstellung');
  await store.autosave(restored);
  assert.equal((await store.recover()).title, 'Alte Fassung');
  assert.equal((await store.restoreVersion(history[0].id)).title, 'Jüngste Eingaben vor Wiederherstellung');
});

test('saving a different document archives the prior recovery before it is replaced', async t => {
  const { directory, store } = await setup(t, { snapshotIntervalMs: 60_000 });
  await store.autosave(document('Start'));
  await store.autosave(document('Jüngster Stand'));
  await store.save({ ...document('Neue Datei'), id: 'new-file' }, path.join(directory, 'new.writely'));
  assert.ok((await store.versions()).some((version: any) => version.title === 'Jüngster Stand'));
});

test('unsupported nodes, marks, attributes and invalid nesting fail before editor data can be lost', () => {
  const withContent = (content: any[]) => ({ ...document(), content: { type: 'doc', content } });
  assert.throws(() => validateDocument(withContent([{ type: 'futureWidget', content: [] }])), /nicht zulässig/);
  assert.throws(() => validateDocument(withContent([{ type: 'paragraph', content: [{ type: 'text', text: 'Bewahren', marks: [{ type: 'futureMark' }] }] }])), /noch nicht unterstützt/);
  assert.throws(() => validateDocument(withContent([{ type: 'paragraph', attrs: { onerror: 'code' }, content: [] }])), /Attribut/);
  assert.throws(() => validateDocument(withContent([{ type: 'paragraph', content: [{ type: 'table', content: [] }] }])), /nicht zulässig/);
  assert.throws(() => validateDocument(withContent([{ type: 'paragraph', content: [{ type: 'text', text: '' }] }])), /leer/);
});

test('unsafe links and external images are rejected while embedded raster images remain valid', () => {
  const linked = (href: string) => ({ ...document(), content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Link', marks: [{ type: 'link', attrs: { href, target: '_blank' } }] }] }] } });
  assert.throws(() => validateDocument(linked('javascript:alert(1)')), /unzulässige Adresse/);
  assert.throws(() => validateDocument(linked('file:///C:/secret.txt')), /unzulässige Adresse/);
  assert.throws(() => validateDocument({ ...document(), content: { type: 'doc', content: [{ type: 'image', attrs: { src: 'https://example.com/tracker.png' } }] } }), /Externe Bildquellen/);
  assert.doesNotThrow(() => validateDocument(linked('https://example.com/ä?text=grüße')));
  assert.doesNotThrow(() => validateDocument({ ...document(), content: { type: 'doc', content: [{ type: 'image', attrs: { src: 'data:image/png;base64,aGVsbG8=', width: 100, height: 50 } }] } }));
});

test('malformed style properties are rejected before rendering', () => {
  assert.throws(() => validateDocument({ ...document(), styles: { normal: { name: 'Normal', fontFamily: 42 } } }), /Schrift einer Formatvorlage/);
  assert.throws(() => validateDocument({ ...document(), styles: { normal: null } }), /Formatvorlage/);
});
