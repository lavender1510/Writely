import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {unlockSealed,forget} from '../core/crypto';
import {validateVault,Vault} from '../core/vault';
import {documentText} from '../core/document';
const {BookStorage}=createRequire(import.meta.url)('../electron/book-storage.cjs');
const text=await readFile('work/android-roundtrip.writely','utf8');
const password='Writely Testvektor Grüße 2026';
const s=await unlockSealed(text,password);
const checks:string[]=[];
function rich(d:ReturnType<typeof validateVault>['documents'][number]['document']){
  assert.ok(d.content.content!.some(n=>n.type==='table'));
  assert.ok(d.content.content!.some(n=>n.type==='image'&&n.attrs?.src.startsWith('data:image/png;base64,')));
  assert.ok(JSON.stringify(d.content).includes('Interoperable Notiz'));
  assert.ok(JSON.stringify(d.content).includes('"type":"bold"'));
}
try{
  const v=validateVault(s.payload),d=v.documents[0].document;
  assert.equal(d.title,'Windows ↔ Android');assert.equal(d.page.size,'A5');
  assert.ok(documentText(d.content).includes('Android'));rich(d);
  const folder=v.folders.find(f=>f.name==='Android-Ordner');assert.ok(folder);
  assert.equal(v.documents.find(r=>r.document.title==='Android-Ordnerdokument')?.folderId,folder.id);
  assert.equal(v.version,3);
  for(const secret of ['Interoperable Notiz','Android-Ordner','Private Projektnotiz','Windows-Buchkapitel'])assert.ok(!text.includes(secret));
  checks.push('Node fixture unlocked by Android WebView','Native Android key input saved','Android ciphertext decrypts in Node','Tables, PNG, bold and footnote preserved','New Android document persists in its current encrypted folder');
}finally{forget(s);}
const vault=new Vault({read:async()=>text,write:async()=>{throw Error('Verifier is read-only');}},new BookStorage('work/android-books/books'));
try{
  await vault.unlock(password);const ref=vault.data().books!.find(b=>b.title==='Interoperables Testbuch');assert.ok(ref);
  const repo=await vault.openBook(ref.id),project=repo.data();
  assert.equal(project.notes,'Private Projektnotiz – niemals veröffentlichen.');
  const chapter=project.nodes.find(n=>n.title==='Windows-Buchkapitel');assert.ok(chapter);
  assert.equal(chapter.notes,'Private Kapitelnotiz – kein Manuskriptbestandteil.');
  const doc=await repo.readDocument(chapter.id);rich(doc);assert.ok(documentText(doc.content).includes('Android Buch'));
  const scene=project.nodes.find(n=>n.title==='Zweite Szene');assert.ok(scene);assert.equal(scene.parentId,chapter.id);
  assert.ok(documentText((await repo.readDocument(scene.id)).content).includes('Größe und Spaß'));
  assert.ok((await repo.readCover())?.startsWith('data:image/png;base64,'));
  assert.ok(chapter.document!.history.some(h=>h.label==='Vor dem Plattformwechsel'));
  const bundle=await vault.backup();for(const secret of ['Private Projektnotiz','Android Buch','Windows-Buchkapitel'])assert.ok(!bundle.includes(secret));
  await writeFile('work/android-book-roundtrip.writely',bundle);
  checks.push('Native per-chapter ciphertext decrypts with shared desktop repository','Scene hierarchy, private metadata, cover and named history survive Android','Complete Android book bundle remains ciphertext-only');
}finally{await vault.lock();}
await writeFile('work/android-roundtrip.json',JSON.stringify({checks},null,2));
console.log(`Android ↔ Node: ${checks.length} interoperability checks passed`);
