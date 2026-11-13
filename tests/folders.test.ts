import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDocument} from '../core/document';
import {Vault,validateVault} from '../core/vault';
import {validateFolders,saveFolder,folderTrail,moveDocuments,trashFolderTree,restoreFolderTree} from '../core/folders.mjs';
const {Library}=createRequire(import.meta.url)('../electron/library.cjs');
test('shared folder invariants reject missing targets, cycles and malformed metadata before mutation',()=>{
 const folders=[{id:'a',name:'Schule',parentId:null},{id:'b',name:'Deutsch',parentId:'a'}];
 assert.deepEqual(folderTrail(folders,'b').map((f:any)=>f.name),['Schule','Deutsch']);
 assert.throws(()=>saveFolder(folders,{id:'a',parentId:'b'},'unused'),/Kreis/);
 assert.throws(()=>saveFolder(folders,{name:'Neu',parentId:'missing'},'c'),/Zielordner/);
 assert.throws(()=>validateFolders([{...folders[0],color:'url(javascript:bad)'}]),/ungültig/);
 const data={folders,documents:[{id:'one',folderId:'a'},{id:'two',folderId:'a',deletedAt:new Date().toISOString()}]};
 assert.throws(()=>moveDocuments(data,['one','two'],'b'),/Papierkorb/);assert.equal(data.documents[0].folderId,'a');
 assert.throws(()=>moveDocuments(data,['one'],'missing'),/Zielordner/);
});
test('folder trash/restore preserves older trash and nested metadata without flattening hierarchy',()=>{
 const data:any={folders:[{id:'a',name:'Schule',parentId:null,pinned:true,color:'#112233',icon:'book'},{id:'b',name:'Deutsch',parentId:'a'}],documents:[{id:'one',folderId:'b'},{id:'old',folderId:'b',deletedAt:'2025-01-01T00:00:00Z'}]};
 trashFolderTree(data,'a','batch');assert.ok(data.folders.every((f:any)=>f.deletedAt));assert.ok(data.documents[0].deletedAt);
 restoreFolderTree(data,'b');assert.equal(data.documents[0].folderId,'b');assert.equal(data.documents[0].deletedAt,undefined);assert.equal(data.documents[1].deletedAt,'2025-01-01T00:00:00Z');assert.equal(data.folders[0].pinned,true);assert.equal(data.folders[1].parentId,'a');
});
test('native creation commits target folder atomically and every later save preserves it after restart',async t=>{
 const root=await mkdtemp(join(tmpdir(),'writely-target-'));t.after(()=>rm(root,{recursive:true,force:true}));let lib=new Library(root);
 await lib.mutate('folder-save',{name:'Schule'});const parent=(await lib.list()).folders[0];await lib.mutate('folder-save',{name:'Deutsch',parentId:parent.id});const child=(await lib.list()).folders.find((f:any)=>f.name==='Deutsch');
 const d=createDocument('blank');await lib.put(d,undefined,child.id);assert.equal((await lib.list()).documents[0].folderId,child.id);
 d.title='Aufsatz Grüße ß';await lib.put(d);lib=new Library(root);await lib.initialize();assert.equal((await lib.list()).documents[0].folderId,child.id);assert.equal((await lib.get(d.id)).document.title,d.title);
 const files=await readdir(join(root,'documents'));await assert.rejects(lib.put(createDocument('blank'),undefined,'missing'),/Zielordner/);assert.deepEqual(await readdir(join(root,'documents')),files);
 const commit=lib.write.bind(lib);lib.write=async()=>{throw new Error('ENOSPC');};await assert.rejects(lib.put({...d,title:'Nicht gespeichert'},undefined,parent.id),/ENOSPC/);lib.write=commit;assert.equal((await lib.list()).documents[0].folderId,child.id);assert.equal((await lib.get(d.id)).document.title,d.title);
 await lib.mutate('folder-trash',{id:parent.id});await assert.rejects(lib.put(d),/Papierkorb/);await assert.rejects(lib.mutate('document-restore',{id:d.id}),/Papierkorb/);await lib.mutate('folder-restore',{id:parent.id});assert.equal((await lib.list()).documents[0].folderId,child.id);
});
test('native bulk move is atomic and restored backup folder batches cannot affect original trash',async t=>{
 const root=await mkdtemp(join(tmpdir(),'writely-batch-'));t.after(()=>rm(root,{recursive:true,force:true}));const lib=new Library(root);
 await lib.mutate('folder-save',{name:'Archiv',pinned:true,color:'#112233',icon:'book'});const folder=(await lib.list()).folders[0];
 const a=createDocument('blank'),b=createDocument('blank');await lib.put(a,undefined,folder.id);await lib.put(b,undefined,folder.id);
 await assert.rejects(lib.mutate('documents-move',{ids:[a.id,'absent'],folderId:null}),/fehlt/);assert.ok((await lib.list()).documents.every((d:any)=>d.folderId===folder.id));
 await lib.mutate('folder-trash',{id:folder.id});const backup=await lib.backup();await lib.restoreBackup(backup);const imported=(await lib.list()).folders.find((f:any)=>f.id!==folder.id);assert.notEqual(imported.trashBatch,(await lib.list()).folders.find((f:any)=>f.id===folder.id).trashBatch);
 await lib.mutate('folder-restore',{id:imported.id});const data=await lib.list();assert.ok(data.folders.find((f:any)=>f.id===folder.id).deletedAt);assert.equal(data.documents.filter((d:any)=>!d.deletedAt).length,2);assert.ok(data.documents.filter((d:any)=>!d.deletedAt).every((d:any)=>d.folderId===imported.id));
});
test('encrypted folder creation, omitted-target saves, rollback and backup batches survive lock/restart',async()=>{
 let text:string|null=null,fail=false;const storage={read:async()=>text,write:async(s:string)=>{if(fail)throw new Error('ENOSPC');text=s;}};let vault=new Vault(storage);const password='Ein sicheres Ordnerkennwort 2026';await vault.create(password);
 const a=await vault.saveFolder({name:'Geheime Schule',pinned:true,color:'#112233',icon:'book'}),b=await vault.folder('Deutsch',a),doc=createDocument('blank');await vault.put(doc,b);await vault.put({...doc,title:'Geheimer Aufsatz'});assert.equal(vault.data().documents[0].folderId,b);
 await vault.move(doc.id,a);await vault.put({...doc,title:'Neu'});assert.equal(vault.data().documents[0].folderId,a);
 fail=true;const prior=text;await assert.rejects(vault.moveMany([doc.id],b),/ENOSPC/);assert.equal(text,prior);assert.equal(vault.data().documents[0].folderId,a);fail=false;
 await vault.trashFolder(a);await assert.rejects(vault.put(doc),/Papierkorb/);const backup=await vault.backup();assert.ok(!backup.includes('Geheime Schule'));await vault.importBackup(backup,password);const imported=vault.data().folders.find(f=>f.name==='Geheime Schule'&&f.id!==a)!;await vault.restoreFolder(imported.id);assert.ok(vault.data().folders.find(f=>f.id===a)!.deletedAt);assert.equal(vault.data().documents.filter(d=>!d.deletedAt).length,1);
 await vault.lock();vault=new Vault(storage);await vault.unlock(password);assert.equal(vault.data().folders.find(f=>f.id===imported.id)!.pinned,true);validateVault(vault.data());await vault.lock();
});
test('legacy vault payload upgrades only after a successful write and retains old long folder names',async()=>{
 const {readFile}=await import('node:fs/promises');let text=await readFile('tests/fixtures/sealed-v1.writely','utf8');const original=text;
 const storage={read:async()=>text,write:async(s:string)=>{text=s;}};const v=new Vault(storage);await v.unlock('Writely Testvektor Grüße 2026');assert.equal(text,original);assert.equal(v.data().version,1);
 const name='Ä'.repeat(180),id=await v.folder(name);assert.equal(v.data().version,2);assert.equal(v.data().folders.find(f=>f.id===id)!.name,name);await v.lock();await v.unlock('Writely Testvektor Grüße 2026');assert.equal(v.data().folders.find(f=>f.id===id)!.name,name);await v.lock();
});
