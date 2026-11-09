import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {_electron} from '@playwright/test';
import {unlockSealed,forget} from '../core/crypto';
const root=process.cwd(),work=path.join(root,'work/secure-desktop'),profile=path.join(work,'profile');
const password='Desktop Testkennwort Grüße 2026',secret='SECRET-SECURE-DESKTOP-ÄÖÜ-12345';
await fs.rm(work,{recursive:true,force:true});await fs.mkdir(work,{recursive:true});
const launch=()=>_electron.launch({executablePath:process.env.ELECTRON_PATH||createRequire(import.meta.url)('electron'),args:[...(process.platform==='linux'?['--no-sandbox','--disable-gpu','--ozone-platform=headless']:[]),`--user-data-dir=${profile}`,root],env:{...process.env,...(process.platform==='linux'?{XDG_CONFIG_HOME:path.join(work,'config'),XDG_CACHE_HOME:path.join(work,'cache')}:{})}});
let app=await launch();
try {
  let page=await app.firstWindow();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('button',{name:/Verschlüsselter Tresor/}).click();
  await page.getByRole('button',{name:'Tresor erstellen',exact:true}).click();
  await page.getByLabel('Kennwort',{exact:true}).fill(password);await page.getByLabel('Kennwort bestätigen').fill(password);
  await page.getByRole('button',{name:'Schutz aktivieren',exact:true}).click();
  await page.getByRole('button',{name:'Neues Dokument',exact:true}).click();
  await page.getByLabel('Dokumenttitel',{exact:true}).fill('Geschützter Desktop-Test');
  await page.getByRole('textbox',{name:'Geschütztes Dokument bearbeiten'}).fill(secret);
  // Close through the native frame before the debounce. It must await the
  // protected handshake and never route the document through LocalStore.
  const exited=new Promise<void>(resolve=>app.process().once('exit',()=>resolve()));
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());
  await exited;
  const sealed=await fs.readFile(path.join(profile,'sealed-workspace/workspace.sealed'),'utf8');
  const s=await unlockSealed(sealed,password);assert.ok(JSON.stringify(s.payload).includes(secret));forget(s);
  async function inspect(dir:string):Promise<void>{for(const entry of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())await inspect(p);else{const content=await fs.readFile(p);assert.ok(!content.includes(Buffer.from(secret)),`Klartext in ${path.relative(profile,p)}`);}}}
  await inspect(profile);
  app=await launch();page=await app.firstWindow();
  await page.getByRole('button',{name:/Verschlüsselter Tresor/}).click();
  assert.equal(await page.locator('.secure-card').count(),0);
  await page.getByRole('button',{name:'Tresor entsperren',exact:true}).click();await page.getByLabel('Kennwort',{exact:true}).fill(password);await page.getByRole('button',{name:'Entsperren',exact:true}).click();
  await page.locator('.secure-card-open').click();assert.ok((await page.locator('.secure-prose').innerText()).includes(secret));
  await page.screenshot({path:path.join(work,'secure-desktop.png')});assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(work,'report.json'),JSON.stringify({platform:process.platform,checks:['Native close saves newest encrypted content','No plaintext in profile, recovery, library, history or Chromium cache','Restart requires password','Reloaded payload preserves Unicode'],errors},null,2));
  console.log('4 protected desktop checks passed');
}finally{await app.close().catch(()=>{});}
