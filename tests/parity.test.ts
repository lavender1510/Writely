import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createDocument} from '../core/document';
import {Vault} from '../core/vault';
import {exportDocx} from '../core/office-export.mjs';
import {exportOdt} from '../core/odt-export.mjs';
import {attach,recover,openZip} from '../core/zip-roundtrip.mjs';
const legacy=createRequire(import.meta.url)('../electron/roundtrip.cjs');
test('portable Office exports are real DOCX/ODT with native sections/notes and desktop-compatible fingerprints',async()=>{
  const d=createDocument('blank');d.content.content=[{type:'heading',attrs:{level:1,anchorId:'chapter'},content:[{type:'text',text:'Grüße'}]},{type:'paragraph',content:[{type:'note',attrs:{id:'note',text:'Notentext',kind:'footnote'}}]}];
  const docx=await exportDocx(d),odt=await attach(await exportOdt(d),d);
  for(const bytes of [docx,odt]){assert.deepEqual(await recover(bytes),d);assert.deepEqual(await legacy.recover(Buffer.from(bytes)),d);}
  const zip=await openZip(docx);assert.match(await zip.file('word/document.xml')!.async('string'),/sectPr/);assert.match(await zip.file('word/footnotes.xml')!.async('string'),/Notentext/);
  const odf=await openZip(odt);assert.equal(await odf.file('mimetype')!.async('string'),'application/vnd.oasis.opendocument.text');assert.match(await odf.file('content.xml')!.async('string'),/text:note/);
  zip.file('word/document.xml','extern geändert');assert.equal(await recover(await zip.generateAsync({type:'uint8array'})),null);
});
test('templates, folder rename/move and duplicates stay encrypted and survive backup merging',async()=>{
  let text:string|null=null;const v=new Vault({read:async()=>text,write:async s=>{text=s;}});await v.create('Ein langes Testkennwort 2026');
  const a=await v.folder('Privat'),b=await v.folder('Kind',a);await v.renameFolder(b,'Neu');
  await assert.rejects(v.moveFolder(a,b),/Kreis/);assert.equal(v.data().folders[0].parentId,null);
  await v.moveFolder(b,null);const d=createDocument('blank');await v.put(d,a);await v.duplicate(d.id);await v.saveTemplate('template-save','Private Vorlage',d);
  const backup=await v.backup();assert.ok(!backup.includes('Private Vorlage'));await v.importBackup(backup,'Ein langes Testkennwort 2026');assert.equal(v.data().templates!.length,2);assert.equal(v.data().documents.length,4);await v.lock();await v.unlock('Ein langes Testkennwort 2026');assert.equal(v.data().templates!.length,2);
});
