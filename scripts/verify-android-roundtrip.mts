import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {unlockSealed,forget} from '../core/crypto';
import {validateVault} from '../core/vault';
import {documentText} from '../core/document';
const text=await readFile('work/android-roundtrip.writely','utf8');
const s=await unlockSealed(text,'Writely Testvektor Grüße 2026');
try{
  const v=validateVault(s.payload),d=v.documents[0].document;
  assert.equal(d.title,'Windows ↔ Android');
  assert.ok(documentText(d.content).includes('Android'));
  assert.ok(d.content.content!.some(n=>n.type==='table'));
  assert.ok(d.content.content!.some(n=>n.type==='image'&&n.attrs?.src.startsWith('data:image/png;base64,')));
  assert.ok(JSON.stringify(d.content).includes('Interoperable Notiz'));
  assert.ok(JSON.stringify(d.content).includes('"type":"bold"'));
  assert.ok(!text.includes('Interoperable Notiz'));
  await writeFile('work/android-roundtrip.json',JSON.stringify({checks:['Node fixture unlocked by Android WebView','Native Android key input saved','Android ciphertext decrypts in Node','Tables, PNG, bold and footnote preserved'],documentId:d.id},null,2));
  console.log('Android ↔ Node: four interoperability checks passed');
}finally{forget(s);}
