import test from 'node:test';
import assert from 'node:assert/strict';
import {createSealed,unlockSealed,changePassword,forget,parseEnvelope,KDF} from '../core/crypto';
import {Vault} from '../core/vault';
import {createDocument} from '../core/document';
import {validateDocument} from '../core/validation.mjs';
import {readFile} from 'node:fs/promises';
import {argon2Sync} from 'node:crypto';
import {deriveArgon2} from '../core/crypto';
import {decodeDocument,encodeDocument} from '../core/document-codec';
const password = 'Grüße 🪶 aus Köln – 123';
const store = () => {let text:string|null=null;return {read:async()=>text,write:async(value:string)=>{text=value;}};};

test('Argon2id WASM agrees with the independent OpenSSL implementation in Node',async()=>{
  const salt=new Uint8Array(32).fill(1);
  const expected=argon2Sync('argon2id',{message:Buffer.from('pass'),nonce:salt,parallelism:1,tagLength:32,memory:65536,passes:3});
  assert.equal(expected.toString('hex'),'d08b2426c39c04b8fada46de5e607ed1d549e7a64bfffecb177c00c50e062cde');
  assert.equal(Buffer.from(await deriveArgon2('pass',salt)).toString('hex'),expected.toString('hex'));
});

test('AES-GCM authenticates password, payload, nonces, identity and bounded Argon2id parameters',async()=>{
  const s = await createSealed({secret:'Vertraulich: Größe ß 🪶',image:'data:image/png;base64,xyz'},password);
  const text = JSON.stringify(s.envelope);
  assert.ok(!text.includes('Vertraulich'));
  assert.deepEqual((await unlockSealed(text,password)).payload,s.payload);
  await assert.rejects(unlockSealed(text,'falsches Kennwort'),/Entsperren fehlgeschlagen/);
  for (const field of ['ciphertext','wrappedKey','nonce','wrapNonce','salt'] as const) {
    const damaged = {...s.envelope,[field]:(s.envelope[field][0]==='A'?'B':'A')+s.envelope[field].slice(1)};
    await assert.rejects(unlockSealed(JSON.stringify(damaged),password));
  }
  await assert.rejects(unlockSealed(JSON.stringify({...s.envelope,id:crypto.randomUUID()}),password));
  assert.throws(()=>parseEnvelope(JSON.stringify({...s.envelope,kdf:{...KDF,memoryKiB:2**31}})),/Schlüsselableitung/);
  assert.throws(()=>parseEnvelope(JSON.stringify({...s.envelope,version:2})),/Dateiversion/);
  forget(s); assert.ok(s.key.every(b=>b===0)); assert.equal(s.payload,null);
});
test('password change re-authenticates and preserves content ciphertext without re-encrypting it',async()=>{
  const s = await createSealed({secret:'Ein Text'},password);
  const next = 'Ein anderes langes Kennwort';
  const text = JSON.stringify(s.envelope);
  await assert.rejects(changePassword(text,'falsch',next));
  const changed = await changePassword(text,password,next);
  assert.equal(JSON.parse(changed).ciphertext,s.envelope.ciphertext);
  assert.notEqual(JSON.parse(changed).salt,s.envelope.salt);
  await assert.rejects(unlockSealed(changed,password));
  assert.deepEqual((await unlockSealed(changed,next)).payload,{secret:'Ein Text'});
  forget(s);
});
test('encrypted vault covers nested folders, metadata, notes, trash, versions and merge-only backups',async()=>{
  const storage = store(), vault = new Vault(storage);
  await vault.create(password);
  const parent = await vault.folder('Geheimes Studium');
  const child = await vault.folder('Private Hausarbeit',parent);
  const doc = createDocument('blank'); doc.title = 'Verschlüsselter Titel';
  doc.content.content![0].content = [{type:'text',text:'Mein geheimer Text'},{type:'note',attrs:{id:'note-1',kind:'footnote',text:'Geheime Notiz'}}];
  await vault.put(doc,child);
  await vault.put({...doc,title:'Zweiter geheimer Titel'},child);
  await vault.move(doc.id,parent);
  const backup = await vault.backup();
  for (const secret of ['Studium','Hausarbeit','Titel','Notiz','Mein geheimer Text',doc.id]) assert.ok(!backup.includes(secret),secret);
  assert.equal(vault.search('geheime Notiz').length,1);
  await vault.trash(doc.id); assert.equal(vault.search('Titel').length,0);
  await assert.rejects(vault.purge(doc.id,false),/bestätigt/);
  await vault.restore(doc.id);
  await vault.restoreVersion(doc.id,0);
  assert.equal(vault.data().documents[0].document.title,doc.title);
  await vault.importBackup(backup,password);
  assert.equal(vault.data().documents.length,2);
  assert.equal(new Set(vault.data().documents.map(r=>r.document.id)).size,2);
  await vault.lock(); assert.throws(()=>vault.search('Titel'),/gesperrt/);
  await assert.rejects(vault.put(doc),/gesperrt/);
  await vault.unlock(password);
  assert.equal(vault.data().documents.length,2);
});
test('write failure preserves committed state; queued saves finish before lock and crash recovery',async()=>{
  const storage = store(), baseWrite = storage.write;
  const vault = new Vault(storage); await vault.create(password);
  const doc = createDocument('blank'); await vault.put(doc);
  const previous = await storage.read();
  storage.write = async()=>{throw new Error('ENOSPC');};
  await assert.rejects(vault.put({...doc,title:'Nicht gespeichert'}),/ENOSPC/);
  assert.equal(vault.data().documents[0].document.title,doc.title);
  assert.equal(await storage.read(),previous);
  storage.write = baseWrite;
  const save = vault.put({...doc,title:'Letzter Stand vor Sperre'});
  await Promise.all([save,vault.lock()]);
  const restarted = new Vault(storage); await restarted.unlock(password);
  assert.equal(restarted.data().documents[0].document.title,'Letzter Stand vor Sperre');
  await assert.rejects(restarted.importBackup('{kaputt}',password));
  assert.equal(restarted.data().documents.length,1);
});
test('shared validator remains identical for desktop and browser imports and rejects active image URLs',()=>{
  const doc = createDocument('blank'); validateDocument(doc);
  doc.content.content!.push({type:'image',attrs:{src:'https://attacker.invalid/private.png'}});
  assert.throws(()=>validateDocument(doc),/Externe Bildquellen/);
});
test('portable document codec validates legacy input before migration and preserves existing metadata',()=>{
  const doc=createDocument('blank');doc.schemaVersion=1;delete doc.proofing;
  assert.equal(decodeDocument(encodeDocument(doc)).schemaVersion,2);
  assert.deepEqual(decodeDocument(encodeDocument(doc)).page,doc.page);
  doc.content.content![0].content=[{type:'note',attrs:{id:'invalid-v1',text:'Neu',kind:'footnote'}}];
  assert.throws(()=>decodeDocument(JSON.stringify(doc)),/Dokumentversion 2/);
});
test('versioned interoperability fixture decrypts without platform-specific APIs',async()=>{
  const text = await readFile('tests/fixtures/sealed-v1.writely','utf8');
  const s = await unlockSealed(text,'Writely Testvektor Grüße 2026');
  const data = s.payload as any;
  assert.equal(data.documents[0].document.title,'Windows ↔ Android');
  validateDocument(data.documents[0].document);
  assert.equal(data.documents[0].document.content.content[1].type,'table');
  forget(s);
});
