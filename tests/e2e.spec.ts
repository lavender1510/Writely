import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Vorlagen',exact:true}).click();
  await page.getByRole('button',{name:/Writely kennenlernen/}).click();
  await expect(page.locator('.tiptap')).toBeVisible();
  await expect(page.locator('.tiptap')).toHaveAttribute('contenteditable', 'true');
  await expect(page.locator('.save-state')).not.toContainText('Wird gesichert');
});

test('editor loads, exposes a real outline, and has no page errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.reload();
  await page.getByRole('button',{name:/Deine letzte Sitzung wartet/}).click();
  await expect(page.locator('.tiptap h1')).toHaveText('Gute Ideen brauchen einen Anfang.');
  await expect(page.locator('.outline-item')).toHaveCount(3);
  await expect(page.locator('.inspector')).toBeVisible();
  await fs.mkdir('work', { recursive: true });
  await page.screenshot({ path: 'work/writely-ui.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('real editing, save download, local recovery and versions', async ({ page }) => {
  const editor = page.locator('.tiptap');
  await editor.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Prueftext mit Umlauten: ÄÖÜ äöü ß.');
  await expect(editor).toContainText('Prueftext mit Umlauten');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('writely.recovery.v1'))).toContain('Prueftext mit Umlauten');
  const downloadPromise = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Gedanken, die bleiben.writely');
  const savedPath = await download.path();
  const content = JSON.parse(await fs.readFile(savedPath!, 'utf8'));
  expect(content.schemaVersion).toBe(2);
  expect(JSON.stringify(content.content)).toContain('Prueftext mit Umlauten');
  await page.reload();
  await page.getByRole('button',{name:/Deine letzte Sitzung wartet/}).click();
  await expect(page.locator('.tiptap')).toContainText('Prueftext mit Umlauten');
  await page.getByRole('button', { name: 'Versionsverlauf', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Versionsverlauf' }).locator('.versions-list button').filter({ hasText: 'Gedanken, die bleiben' }).first()).toBeVisible();
});

test('command palette opens templates and creates a blank document', async ({ page }) => {
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Befehlspalette' });
  await expect(palette).toBeVisible();
  await palette.getByPlaceholder('Befehl suchen …').fill('Neues Dokument');
  await palette.getByRole('button', { name: /Neues Dokument/ }).click();
  const templates = page.getByRole('dialog', { name: 'Neues Dokument' });
  await templates.getByRole('button', { name: 'Leeres Dokument Platz für alles, was kommt.' }).click();
  await expect(page.getByLabel('Dokumenttitel')).toHaveValue('Unbenanntes Dokument');
  await expect(page.locator('.tiptap')).toHaveText('');
  await page.locator('.tiptap').fill('Mein erster Gedanke.');
  await expect(page.locator('.tiptap')).toHaveText('Mein erster Gedanke.');
});

test('switching documents immediately preserves the latest edit in local history', async ({ page }) => {
  test.setTimeout(60_000);
  await page.locator('.tiptap').focus();
  await page.locator('.tiptap').press('Control+End');
  await page.locator('.tiptap').press('Enter');
  await page.keyboard.insertText('Letzter Gedanke vor dem Dokumentwechsel.');
  await page.keyboard.press('Control+n');
  await page.getByRole('dialog', { name: 'Neues Dokument' }).getByRole('button', { name: 'Leeres Dokument Platz für alles, was kommt.' }).click();
  await expect(page.getByLabel('Dokumenttitel')).toHaveValue('Unbenanntes Dokument');
  await page.getByRole('button', { name: 'Versionsverlauf', exact: true }).click();
  await expect(page.getByRole('dialog',{name:'Versionsverlauf'})).not.toContainText('Gedanken, die bleiben');
  await page.getByRole('dialog',{name:'Versionsverlauf'}).getByRole('button',{name:'Schließen',exact:true}).click();
  await page.getByRole('button',{name:'Zur Bibliothek'}).click();
  await page.locator('.document-card').filter({hasText:'Gedanken, die bleiben'}).getByRole('button',{name:/WRITELY/}).first().click();
  await page.getByRole('button', { name: 'Versionsverlauf', exact: true }).click();
  await page.getByRole('dialog',{name:'Versionsverlauf'}).locator('.versions-list button').first().click();
  await expect(page.getByLabel('Versionsvorschau')).toContainText('Letzter Gedanke vor dem Dokumentwechsel.');
  await page.getByRole('button',{name:'Diese Version wiederherstellen'}).click();
  await expect(page.locator('.tiptap')).toContainText('Letzter Gedanke vor dem Dokumentwechsel.');
});

test('shared style updates all headings, formatting and insertion work', async ({ page }) => {
  await page.getByLabel('Formatvorlage bearbeiten').selectOption('h2');
  await page.locator('.unit-input input').fill('20');
  const fontSizes = await page.locator('.tiptap h2').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).fontSize));
  expect(fontSizes).toHaveLength(2);
  fontSizes.forEach(size => expect(parseFloat(size)).toBeCloseTo(26.6667, 2));
  await page.locator('.tiptap h1').click();
  await page.getByRole('button', { name: 'Einfügen', exact: true }).click();
  await page.locator('.ribbon').getByRole('button', { name: 'Tabelle', exact: true }).click();
  await page.getByRole('button',{name:'Tabelle einfügen',exact:true}).click();
  await expect(page.locator('.tiptap table')).toHaveCount(1);
  await expect(page.locator('.tiptap tr')).toHaveCount(3);
  await expect(page.locator('.tiptap th')).toHaveCount(3);
});

test('search replaces text, focus and dark modes can be toggled', async ({ page }) => {
  await page.keyboard.press('Control+h');
  const search = page.getByRole('region', { name: 'Suchen und Ersetzen' });
  await search.getByLabel('Suchen', { exact: true }).fill('Gedanke');
  await search.getByLabel('Ersetzen durch').fill('Einfall');
  await search.getByRole('button', { name: 'Alle ersetzen' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.tiptap')).toContainText('Einfall');
  await page.getByRole('button', { name: 'Dunkles Design', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: 'work/writely-dark.png', fullPage: true });
  await page.getByRole('button', { name: 'Fokusmodus', exact: true }).click();
  await expect(page.locator('.navigator')).toBeHidden();
  await expect(page.locator('.exit-focus')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.navigator')).toBeVisible();
});

test('HTML and TXT export real content, desktop-only PDF has a clear message', async ({ page }) => {
  for (const [label, extension, expected] of [['HTML', 'html', '<h1'], ['Einfacher Text', 'txt', 'Gute Ideen brauchen']] as const) {
    await page.getByRole('button', { name: 'Exportieren', exact: true }).click();
    const exportDialog = page.getByRole('dialog', { name: 'Exportieren' });
    const event = page.waitForEvent('download');
    await exportDialog.getByRole('button', { name: new RegExp(label) }).click();
    const download = await event;
    expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${extension}$`));
    const file = await fs.readFile((await download.path())!, 'utf8');
    expect(file).toContain(expected);
  }
  await page.getByRole('button', { name: 'Exportieren', exact: true }).click();
  await page.getByRole('dialog', { name: 'Exportieren' }).getByRole('button', { name: /PDF Zum Lesen/ }).click();
  await expect(page.getByRole('status')).toContainText('Bitte nutze die Desktop-App für den PDF-Export.');
});

test('home library creates nested folders, pins documents and searches titles',async({page})=>{await page.getByRole('button',{name:'Zur Bibliothek'}).click();await expect(page.locator('.library-shell')).toBeVisible();await page.getByRole('button',{name:'Ordner erstellen'}).click();await page.getByRole('dialog',{name:'Neuer Ordner'}).getByLabel('Ordnername').fill('Studium');await page.getByRole('button',{name:'Speichern',exact:true}).click();await expect(page.locator('.library-nav')).toContainText('Studium');await page.getByRole('button',{name:'Gedanken, die bleiben anheften'}).click();await page.getByRole('button',{name:'Angeheftet',exact:true}).click();await expect(page.locator('.document-card')).toHaveCount(1);await page.getByLabel('Bibliothek durchsuchen').fill('nicht vorhanden');await expect(page.locator('.document-card')).toHaveCount(0);});

test('cover editor inserts editable title and theme changes global styles',async({page})=>{await page.getByRole('button',{name:'Gestalten',exact:true}).click();await page.getByLabel('Titel',{exact:true}).fill('Ein neuer Anfang');await page.getByLabel('Autor',{exact:true}).fill('Erika Muster');await page.getByRole('button',{name:'Als erste Seite einfügen'}).click();await expect(page.locator('.tiptap h1').first()).toHaveText('Ein neuer Anfang');await expect(page.locator('.tiptap')).toContainText('Erika Muster');await expect(page.locator('.tiptap [data-style-id="coverTitle"]')).toHaveCount(1);});

test('page setup is saved and supports true undo/redo',async({page})=>{await page.getByRole('button',{name:'Layout',exact:true}).click();await page.getByRole('button',{name:'Seite einrichten',exact:true}).click();await page.getByLabel('Papierformat',{exact:true}).selectOption('A5');await page.getByLabel('Ausrichtung',{exact:true}).selectOption('landscape');await page.getByRole('button',{name:'Layout anwenden'}).click();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('writely.recovery.v1')||'{}').page?.size)).toBe('A5');await page.keyboard.press('Control+z');await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('writely.recovery.v1')||'{}').page?.size)).toBe('A4');await page.keyboard.press('Control+y');await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('writely.recovery.v1')||'{}').page?.size)).toBe('A5');});

test('manual page breaks are distinct nodes and page sidebar duplicates without flattening content',async({page})=>{await page.locator('.tiptap').focus();await page.keyboard.press('Control+End');await page.keyboard.press('Control+Enter');await expect(page.locator('.tiptap [data-writely-break="page"]')).toHaveCount(1);await page.getByRole('button',{name:'Ansicht',exact:true}).click();await page.getByRole('button',{name:'Seitenbereiche',exact:true}).click();await expect(page.locator('.page-thumb')).toHaveCount(2);await page.getByRole('button',{name:'Seite duplizieren',exact:true}).first().click();await expect(page.locator('.page-thumb')).toHaveCount(3);await page.keyboard.press('Control+z');await expect(page.locator('.page-thumb')).toHaveCount(2);});

test('table rows can be duplicated and undo restores the original table',async({page})=>{await page.getByRole('button',{name:'Einfügen',exact:true}).click();await page.locator('.ribbon').getByRole('button',{name:'Tabelle',exact:true}).click();await page.getByRole('button',{name:'Tabelle einfügen',exact:true}).click();await page.locator('.tiptap th').first().click();await page.getByRole('navigation',{name:'Hauptmenü'}).getByRole('button',{name:'Tabelle',exact:true}).click();await page.getByRole('button',{name:'Zeile duplizieren',exact:true}).click();await expect(page.locator('.tiptap tr')).toHaveCount(4);await page.keyboard.press('Control+z');await expect(page.locator('.tiptap tr')).toHaveCount(3);});

test('graphic insertion and image transformations survive local recovery and undo',async({page})=>{await page.locator('.tiptap').focus();await page.keyboard.press('Control+End');await page.getByRole('button',{name:'Einfügen',exact:true}).click();await page.getByRole('button',{name:'Grafiken & Zeichen',exact:true}).click();await page.getByRole('dialog',{name:'Objekt einfügen'}).getByRole('button',{name:'Grafik',exact:true}).click();await page.getByLabel('Grafiktyp').selectOption('arrow');await page.getByRole('button',{name:'Grafik einfügen',exact:true}).click();const image=page.locator('.tiptap img').last();await image.click();await page.getByRole('button',{name:'Bild bearbeiten',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Bild bearbeiten'});await dialog.getByLabel('Breite in Pixel').fill('320');await dialog.getByLabel('Drehen',{exact:true}).selectOption('90');await dialog.getByLabel('Alternativtext').fill('Gedrehter Pfeil');await dialog.getByRole('button',{name:'Bildänderungen anwenden'}).click();await expect(image).toHaveAttribute('alt','Gedrehter Pfeil');await expect(image).toHaveAttribute('height','320');await expect.poll(()=>page.evaluate(()=>localStorage.getItem('writely.recovery.v1'))).toContain('originalSrc');await page.keyboard.press('Control+z');await expect(image).not.toHaveAttribute('alt','Gedrehter Pfeil');});

test('live search crosses marks, highlights, replaces a single hit and supports undo',async({page})=>{const editor=page.locator('.tiptap');const paragraph=editor.locator('p').first();await paragraph.fill('Hallo ');await paragraph.press('End');await page.getByRole('button',{name:'Fett (Strg+B)',exact:true}).click();await page.keyboard.insertText('Welt');await page.getByRole('button',{name:'Fett (Strg+B)',exact:true}).click();await expect(paragraph).toHaveText('Hallo Welt');await expect(paragraph.locator('strong')).toHaveText('Welt');await page.keyboard.press('Control+h');const panel=page.getByRole('region',{name:'Suchen und Ersetzen'});await panel.getByLabel('Suchen',{exact:true}).fill('lo We');await expect(panel.getByRole('status')).toHaveText('1 von 1');await expect.poll(async()=>(await editor.locator('.search-hit').allTextContents()).join('').replace(/[\u00a0\u202f]/g,' ')).toBe('lo We');await panel.getByLabel('Ersetzen durch').fill('X');await panel.getByRole('button',{name:'Treffer ersetzen',exact:true}).click();await expect(paragraph).toHaveText('HalXlt');await editor.focus();await page.keyboard.press('Control+z');await expect(paragraph).toHaveText('Hallo Welt');});

test('problematic regex is terminated without freezing the editor',async({page})=>{await page.locator('.tiptap').fill('a'.repeat(40000)+'!');await page.keyboard.press('Control+f');const panel=page.getByRole('region',{name:'Suchen und Ersetzen'});await panel.getByLabel('Regulärer Ausdruck').check();await panel.getByLabel('Suchen',{exact:true}).fill('(a+)+$');await expect(panel.getByRole('alert')).toContainText('abgebrochen');await panel.getByRole('button',{name:'Suche schließen'}).click();await page.locator('.tiptap').focus();await page.keyboard.press('Control+End');await page.keyboard.insertText('Weiter');await expect(page.locator('.tiptap')).toContainText('Weiter');});

test('trash restores documents and fulltext library search finds body contents',async({page})=>{await page.getByRole('button',{name:'Zur Bibliothek'}).click();await page.getByLabel('Bibliothek durchsuchen').fill('flüchtiger');await expect(page.locator('.document-card')).toHaveCount(1);await expect(page.locator('.search-snippet')).toContainText('flüchtiger');await page.getByLabel('Bibliothek durchsuchen').fill('');await page.getByRole('button',{name:'Gedanken, die bleiben verwalten'}).click();await page.getByRole('button',{name:'In den Papierkorb'}).click();await expect(page.locator('.document-card')).toHaveCount(0);await page.getByRole('button',{name:'Papierkorb',exact:true}).click();await expect(page.locator('.document-card')).toHaveCount(1);await page.locator('.document-card').getByRole('button',{name:'Wiederherstellen',exact:true}).click();await expect(page.locator('.document-card')).toHaveCount(0);await page.locator('.library-nav').getByRole('button',{name:'Meine Dokumente',exact:true}).click();await expect(page.locator('.document-card')).toHaveCount(1);});

test('dynamic TOC updates headings, footnotes renumber and survive recovery with undo',async({page})=>{await page.getByRole('button',{name:'Verweise',exact:true}).click();await page.getByRole('button',{name:'Inhaltsverzeichnis einfügen',exact:true}).click();const toc=page.getByRole('navigation',{name:'Dynamisches Inhaltsverzeichnis'});await expect(toc.getByRole('button')).toHaveCount(3);await page.locator('.tiptap h1').first().click();await page.keyboard.press('Home');await page.keyboard.insertText('Neu: ');await expect(toc).toContainText('Neu: Gute Ideen');await page.locator('.tiptap').focus();await page.keyboard.press('Control+End');await page.keyboard.press('Control+Alt+f');const dialog=page.getByRole('dialog',{name:'Note bearbeiten'});await dialog.getByRole('button',{name:'Schließen',exact:true}).focus();await page.keyboard.press('Shift+Tab');await expect(dialog.getByRole('button',{name:'Note übernehmen'})).toBeFocused();await page.keyboard.press('Tab');await expect(dialog.getByRole('button',{name:'Schließen',exact:true})).toBeFocused();await dialog.getByLabel('Notentext').fill('Fußnote mit Umlauten: ÄÖÜ ß.');await dialog.getByRole('button',{name:'Note übernehmen'}).click();await expect(page.locator('.note-reference')).toHaveAttribute('data-number','1');await expect(page.getByLabel('Dokumentnoten')).toContainText('Fußnote mit Umlauten');await expect.poll(()=>page.evaluate(()=>localStorage.getItem('writely.recovery.v1'))).toContain('Fußnote mit Umlauten');await page.keyboard.press('Control+z');await expect(page.locator('.note-reference')).toHaveCount(0);await page.keyboard.press('Control+y');await expect(page.locator('.note-reference')).toHaveCount(1);await page.reload();await page.getByRole('button',{name:/Deine letzte Sitzung wartet/}).click();await expect(page.getByLabel('Dokumentnoten')).toContainText('Fußnote mit Umlauten');});
