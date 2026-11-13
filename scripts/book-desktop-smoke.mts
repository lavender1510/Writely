/** Native IPC and shutdown test. Uses only the public encrypted test vector. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {_electron,type Page} from '@playwright/test';
import {parseVaultTransfer} from '../core/book-bundle';
import {Vault} from '../core/vault';
import {documentText} from '../core/document';
const require=createRequire(import.meta.url),{BookStorage}=require('../electron/book-storage.cjs');
const root=process.cwd(),work=path.join(root,'work/book-desktop'),profile=path.join(work,'profile');
const password='Writely Testvektor Grüße 2026',marker=' Desktop Buch';
await fs.rm(work,{recursive:true,force:true});await fs.mkdir(path.join(profile,'sealed-workspace'),{recursive:true});
const transfer=parseVaultTransfer(await fs.readFile('tests/fixtures/book-bundle-v1.writely','utf8'));
await fs.writeFile(path.join(profile,'sealed-workspace/workspace.sealed'),transfer.vault);
const storage=new BookStorage(path.join(profile,'book-blocks'));
for(const block of transfer.blocks.filter(b=>b.id!=='manifest'))await storage.writeNew(block.projectId,block.id,block.text);
for(const block of transfer.blocks.filter(b=>b.id==='manifest'))await storage.compareAndSwap(block.projectId,block.text,null);
const launch=()=>_electron.launch({executablePath:process.env.ELECTRON_PATH||require('electron'),args:[...(process.platform==='linux'?['--no-sandbox','--disable-gpu','--ozone-platform=headless']:[]),`--user-data-dir=${profile}`,root],env:{...process.env,...(process.platform==='linux'?{XDG_CONFIG_HOME:path.join(work,'config'),XDG_CACHE_HOME:path.join(work,'cache')}:{})}});
const errors:string[]=[];
async function open(page:Page){
  page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('button',{name:'Bücher',exact:true}).click();
  await page.getByRole('button',{name:'Tresor entsperren',exact:true}).click();
  await page.getByLabel('Kennwort',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Entsperren',exact:true}).click();
  await page.locator('.book-project-open').click();
  await page.locator('.book-binder-title').filter({hasText:'Windows-Buchkapitel'}).click();
  await page.locator('.secure-prose table').waitFor();await page.locator('.secure-prose img[src^="data:image"]').waitFor();
}
let app=await launch();
try{
  let page=await app.firstWindow();await open(page);
  await page.locator('.secure-prose > p').first().click();await page.keyboard.press('End');await page.keyboard.type(marker);
  // Close before the chapter debounce; the native close handshake must flush it.
  const exited=new Promise<void>(resolve=>app.process().once('exit',()=>resolve()));
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await exited;
  const sealed=await fs.readFile(path.join(profile,'sealed-workspace/workspace.sealed'),'utf8');assert.equal(sealed,transfer.vault,'Chapter edit must not rewrite the root vault');
  const vault=new Vault({read:async()=>sealed,write:async()=>{throw Error('Read-only verifier');}},storage);
  try{
    await vault.unlock(password);const repo=await vault.openBook(vault.data().books![0].id),project=repo.data();
    const chapter=project.nodes.find(n=>n.title==='Windows-Buchkapitel')!;
    const d=await repo.readDocument(chapter.id);assert.ok(documentText(d.content).includes(marker));
    assert.ok(d.content.content!.some(n=>n.type==='table'));assert.ok(d.content.content!.some(n=>n.type==='image'));
    assert.ok(JSON.stringify(d.content).includes('Interoperable Notiz'));assert.ok(JSON.stringify(d.content).includes('"type":"bold"'));
    assert.equal(project.notes,'Private Projektnotiz – niemals veröffentlichen.');assert.ok(await repo.readCover());
    await fs.writeFile(path.join(work,'desktop-book-roundtrip.writely'),await vault.backup());
  }finally{await vault.lock();}
  async function inspect(dir:string):Promise<void>{for(const entry of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())await inspect(p);else{const bytes=await fs.readFile(p);for(const secret of ['Private Projektnotiz','Private Kapitelnotiz',marker])assert.ok(!bytes.includes(Buffer.from(secret)),`Plaintext in ${path.relative(profile,p)}`);}}}
  await inspect(profile);
  app=await launch();page=await app.firstWindow();assert.equal(await page.locator('.secure-prose').count(),0);await open(page);
  assert.ok((await page.locator('.secure-prose').innerText()).includes(marker));
  await page.screenshot({path:path.join(work,'book-desktop.png')});assert.deepEqual(errors,[]);
  const checks=['Native chapter IPC preserves rich text, table, image and note','Native close flushes newest chapter before debounce','Root vault remains byte-identical','Private project data and cover survive restart','Profile, Chromium cache, history and recovery contain no test plaintext','Restart requires password and opens latest chapter'];
  await fs.writeFile(path.join(work,'report.json'),JSON.stringify({platform:process.platform,checks,errors},null,2));console.log(`${checks.length} native book desktop checks passed`);
}finally{await app.close().catch(()=>{});}
