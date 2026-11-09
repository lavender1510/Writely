import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {unlockSealed,forget} from '../core/crypto';
test.beforeEach(async({page})=>{
  const fixture=await readFile('tests/fixtures/sealed-v1.writely','utf8');
  await page.addInitScript(text=>{if(!localStorage.getItem('writely.sealed.workspace.v1'))localStorage.setItem('writely.sealed.workspace.v1',text);localStorage.setItem('writely.sealed.background','false');},fixture);
  await page.setViewportSize({width:412,height:915});await page.goto('/?mobile=1');
  await page.getByRole('button',{name:'Tresor entsperren',exact:true}).click();await page.getByLabel('Kennwort',{exact:true}).fill('Writely Testvektor Grüße 2026');await page.getByRole('button',{name:'Entsperren',exact:true}).click();await page.locator('.secure-card-open').click();
});
test('mobile section layout is a real undoable transaction and survives encrypted saving',async({page})=>{
  await page.getByRole('button',{name:'Erweiterte Werkzeuge',exact:true}).click();await page.getByRole('button',{name:'Layout',exact:true}).click();await page.getByRole('button',{name:'Seite einrichten',exact:true}).click();
  await page.getByLabel('Papierformat',{exact:true}).selectOption('A5');await page.getByLabel('Ausrichtung',{exact:true}).selectOption('landscape');await page.getByRole('button',{name:'Layout anwenden',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Verschlüsselt gespeichert');
  const text=await page.evaluate(()=>localStorage.getItem('writely.sealed.workspace.v1'));
  const s=await unlockSealed(text!,'Writely Testvektor Grüße 2026');const d=(s.payload as any).documents[0].document;expect(d.page.size).toBe('A5');expect(d.page.orientation).toBe('landscape');expect(d.content.content.some((n:any)=>n.type==='table')).toBe(true);expect(JSON.stringify(d.content)).toContain('Interoperable Notiz');forget(s);
  await page.getByRole('button',{name:'Rückgängig',exact:true}).click();
  await page.getByRole('button',{name:'Seite einrichten',exact:true}).click();await expect(page.getByLabel('Papierformat',{exact:true})).toHaveValue('A4');
});
test('mobile table tools add real rows and notes remain editable',async({page})=>{
  await page.locator('.secure-prose td p').click();await page.getByRole('button',{name:'Erweiterte Werkzeuge',exact:true}).click();await page.getByRole('button',{name:'Tabelle',exact:true}).click();await page.getByRole('button',{name:'Zeile danach',exact:true}).click();await expect(page.locator('.secure-prose tr')).toHaveCount(2);
  await page.getByRole('button',{name:'Rückgängig',exact:true}).click();await expect(page.locator('.secure-prose tr')).toHaveCount(1);
  await page.getByRole('button',{name:'Verweise',exact:true}).click();await page.getByRole('button',{name:'Inhaltsverzeichnis',exact:true}).click();await expect(page.locator('.secure-prose [data-toc-view]')).toHaveCount(1);
  await page.getByRole('button',{name:/Fußnote 1.*Interoperable/}).click();await page.getByLabel('Notentext',{exact:true}).fill('Unter Android bearbeitete Fußnote');await page.getByRole('button',{name:'Note übernehmen',exact:true}).click();await expect(page.getByRole('region',{name:'Dokumentnoten'})).toContainText('Unter Android bearbeitete Fußnote');
});
test('browser Office exporter downloads a real DOCX with intact private document data',async({page})=>{
  page.on('dialog',d=>d.accept());
  await page.getByLabel('Exportformat',{exact:true}).selectOption('docx');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Unverschlüsselt exportieren …',exact:true}).click();
  const file=await download;expect(file.suggestedFilename()).toBe('Writely-Dokument.docx');
  const {recover,openZip}=await import('../core/zip-roundtrip.mjs');const bytes=await readFile((await file.path())!);
  const model=await recover(bytes);expect(model.title).toBe('Windows ↔ Android');expect(JSON.stringify(model.content)).toContain('Interoperable Notiz');
  const zip=await openZip(bytes);expect(await zip.file('word/document.xml')!.async('string')).toContain('Grüße');
});
