import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { createDocument } from '../src/document';
const require = createRequire(import.meta.url),
  { Library } = require('../electron/library.cjs'),
  { LocalStore } = require('../electron/storage.cjs');
async function setup(t: any) {
  const root = await mkdtemp(join(tmpdir(), 'writely-safety-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return {
    root,
    lib: new Library(join(root, 'library')),
    store: new LocalStore(join(root, 'local')),
  };
}
test('trash retains folder and metadata, restore works, purge needs explicit confirmation and removes revision', async (t) => {
  const { root, lib } = await setup(t);
  const doc = createDocument('welcome');
  await lib.mutate('folder-save', { name: 'Arbeit' });
  const folder = (await lib.list()).folders[0].id;
  await lib.put(doc);
  await lib.mutate('document-update', { id: doc.id, folderId: folder, pinned: true });
  await lib.mutate('document-remove', { id: doc.id });
  await assert.rejects(lib.get(doc.id), /Papierkorb/);
  assert.equal((await lib.list()).documents[0].folderId, folder);
  await assert.rejects(lib.mutate('document-purge', { id: doc.id }), /Bestätigung/);
  await lib.mutate('document-restore', { id: doc.id });
  assert.deepEqual((await lib.get(doc.id)).document, doc);
  await lib.mutate('document-remove', { id: doc.id });
  await lib.mutate('document-purge', { id: doc.id, confirmed: true });
  assert.equal((await readdir(join(root, 'library', 'documents'))).length, 0);
});
test('immutable revisions protect the prior content when index commit fails and cleanup repairs interrupted staging', async (t) => {
  const { root, lib } = await setup(t);
  const doc = createDocument('blank');
  doc.title = 'Bewahrt';
  await lib.put(doc);
  const commit = lib.write.bind(lib);
  lib.write = async () => {
    throw Object.assign(new Error('Disk full'), { code: 'ENOSPC' });
  };
  await assert.rejects(lib.put({ ...doc, title: 'Nicht committed' }), { code: 'ENOSPC' });
  assert.equal((await lib.get(doc.id)).document.title, 'Bewahrt');
  lib.write = commit;
  await writeFile(join(root, 'library', 'documents', 'interrupted-revision.writely'), 'partial');
  await lib.initialize();
  assert.equal((await readdir(join(root, 'library', 'documents'))).length, 1);
});
test('backup validates hash before writes and merges folders, trash, documents and templates without overwriting', async (t) => {
  const { root, lib } = await setup(t);
  const doc = createDocument('welcome');
  await lib.put(doc, 'C:/Original.writely');
  await lib.mutate('template-save', { name: 'Eigene Vorlage', document: doc });
  const bytes = await lib.backup();
  const broken = JSON.parse(bytes);
  broken.payload.documents[0].document.title = 'Manipuliert';
  await assert.rejects(lib.restoreBackup(Buffer.from(JSON.stringify(broken))), /beschädigt/);
  assert.equal((await lib.list()).documents.length, 1);
  await lib.restoreBackup(bytes);
  const index = await lib.list();
  assert.equal(index.documents.length, 2);
  assert.notEqual(index.documents[0].id, index.documents[1].id);
  assert.equal(index.documents[1].path, undefined);
  assert.equal(index.templates.length, 2);
  assert.equal((await lib.get(doc.id)).document.title, doc.title);
});
test('fulltext library search finds text outside the title and excludes trash', async (t) => {
  const { lib } = await setup(t);
  const doc = createDocument('welcome');
  await lib.put(doc);
  const found = await lib.search('Flüchtiger');
  assert.equal(found.length, 1);
  assert.match(found[0].snippet, /flüchtiger/);
  await lib.mutate('document-remove', { id: doc.id });
  assert.equal((await lib.search('Flüchtiger')).length, 0);
});
test('history quotas are per document, previews do not change recovery, and preferences persist', async (t) => {
  const { root, store } = await setup(t);
  await store.configure({ historyLimit: 3, intervalMinutes: 2, maxMegabytes: 64 });
  const a = createDocument('blank'),
    b = createDocument('blank');
  for (let i = 0; i < 5; i++) {
    await store.save({ ...a, title: 'A' + i }, join(root, 'a.writely'));
    await store.save({ ...b, title: 'B' + i }, join(root, 'b.writely'));
  }
  assert.equal((await store.versions(a.id)).length, 3);
  assert.equal((await store.versions(b.id)).length, 3);
  const entry = (await store.versions(a.id))[0];
  const before = await store.recover();
  await store.previewVersion(entry.id, a.id);
  assert.deepEqual(await store.recover(), before);
  await assert.rejects(store.restoreVersion(entry.id, b.id), /anderen Dokument/);
  const reopened = new LocalStore(join(root, 'local'));
  await reopened.loadSettings();
  assert.equal(reopened.settings().intervalMinutes, 2);
  await assert.rejects(store.configure({ historyLimit: 0 }), /ungültig/);
});

test('save failures for permissions and full disks retain the original file and recovery', async (t) => {
  const { root, store } = await setup(t);
  const fs = require('node:fs/promises');
  const doc = createDocument('blank'),
    target = join(root, 'protected.writely');
  await store.save({ ...doc, title: 'Unverändert' }, target);
  for (const code of ['EACCES', 'ENOSPC']) {
    const rename = fs.rename;
    t.mock.method(fs, 'rename', async (from: string, to: string) => {
      if (to === target) throw Object.assign(new Error('Injected ' + code), { code });
      return rename(from, to);
    });
    await assert.rejects(store.save({ ...doc, title: 'Fehlerhafter Stand' }, target), { code });
    t.mock.restoreAll();
    assert.equal(JSON.parse(await fs.readFile(target, 'utf8')).title, 'Unverändert');
    assert.equal((await store.recover()).title, 'Unverändert');
  }
  assert.equal(
    (await readdir(root)).some((n) => n.endsWith('.tmp')),
    false,
  );
});

test('oversized backup is rejected before writing while bounded fulltext cache retains search correctness',async t=>{const {root}=await setup(t);const lib=new Library(join(root,'bounded'),{maxBackupBytes:1000,maxCachedCharacters:20});const doc=createDocument('welcome');await lib.put(doc);assert.equal((await lib.search('flüchtiger')).length,1);await assert.rejects(lib.backup(),/Größenlimit/);assert.equal((await lib.get(doc.id)).document.title,doc.title);});
