import {test,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
test.beforeEach(async({page})=>{
  const text=await readFile('tests/fixtures/sealed-v1.writely','utf8');
  await page.addInitScript(t=>{localStorage.setItem('writely.sealed.workspace.v1',t);localStorage.setItem('writely.sealed.theme','amoled');localStorage.setItem('writely.sealed.background','false');},text);
  await page.setViewportSize({width:412,height:915});await page.goto('/?mobile=1');
  await page.getByRole('button',{name:'Tresor entsperren',exact:true}).click();await page.getByLabel('Kennwort',{exact:true}).fill('Writely Testvektor Grüße 2026');await page.getByRole('button',{name:'Entsperren',exact:true}).click();await page.locator('.secure-card-open').click();
});
test('minimal writing chrome scrolls tools without widening the page and menus really work',async({page})=>{
  await expect(page.locator('.writing-header')).toBeVisible();await expect(page.getByLabel('Exportformat')).toHaveCount(0);
  expect(await page.locator('.secure-tools').evaluate(e=>e.scrollWidth>e.clientWidth)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Dokumentaktionen',exact:true}).click();await expect(page.getByLabel('Exportformat')).toBeVisible();
  await page.getByRole('button',{name:'Umbenennen',exact:true}).click();await expect(page.getByLabel('Dokumenttitel',{exact:true})).toBeFocused();
  await page.getByLabel('Dokumenttitel',{exact:true}).fill('Mein Schreibplatz');await expect(page.getByRole('status')).toContainText('Verschlüsselt gespeichert');
  await page.getByRole('button',{name:'Lesemodus',exact:true}).click();await expect(page.locator('.secure-prose')).toHaveAttribute('contenteditable','false');await expect(page.locator('.secure-tools')).toBeHidden();
  await page.getByRole('button',{name:'Lesemodus',exact:true}).click();await expect(page.locator('.secure-prose')).toHaveAttribute('contenteditable','true');
  await page.getByRole('button',{name:'Dokumentaktionen',exact:true}).click();await page.getByRole('button',{name:'Dokumentinformationen',exact:true}).click();await expect(page.getByRole('region',{name:'Dokumentinformationen'})).toContainText('Automatische Druckseiten');await page.getByRole('button',{name:'Schließen',exact:true}).click();
  await mkdir('work/redesign',{recursive:true});await page.screenshot({path:'work/redesign/phone-amoled.png'});
});
test('text selection survives toolbar formatting, undo and a smaller keyboard viewport',async({page})=>{
  const p=page.locator('.secure-prose > p').first();await p.click();await page.keyboard.press('Home');await page.keyboard.down('Shift');await page.keyboard.press('End');await page.keyboard.up('Shift');
  const before=await page.evaluate(()=>getSelection()?.toString());expect(before?.length).toBeGreaterThan(0);
  await page.getByRole('button',{name:'Unterstrichen',exact:true}).click();await expect(p.locator('u')).toContainText('Grüße');
  await expect(page.getByRole('button',{name:'Unterstrichen',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Rückgängig',exact:true}).click();await expect(p.locator('u')).toHaveCount(0);
  await page.setViewportSize({width:412,height:500});await p.click();await page.keyboard.press('End');await page.keyboard.insertText(' äöü ß 🎉');await expect(p).toContainText('äöü ß 🎉');
  const box=await p.boundingBox();expect(box!.y+box!.height).toBeLessThan(500);
  await page.setViewportSize({width:1024,height:768});await expect(page.locator('.secure-tabs')).toBeVisible();await page.screenshot({path:'work/redesign/tablet-amoled.png'});
});
