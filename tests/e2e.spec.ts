import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.tiptap')).toBeVisible();
  await expect(page.locator('.tiptap')).toHaveAttribute('contenteditable', 'true');
  await expect(page.locator('.save-state')).not.toContainText('Wird gesichert');
});

test('editor loads, exposes a real outline, and has no page errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.reload();
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
  expect(content.schemaVersion).toBe(1);
  expect(JSON.stringify(content.content)).toContain('Prueftext mit Umlauten');
  await page.reload();
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
  await page.getByRole('dialog', { name: 'Versionsverlauf' }).locator('.versions-list button').filter({ hasText: 'Gedanken, die bleiben' }).first().click();
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
  await page.getByRole('button', { name: 'Tabelle', exact: true }).click();
  await expect(page.locator('.tiptap table')).toHaveCount(1);
  await expect(page.locator('.tiptap tr')).toHaveCount(3);
  await expect(page.locator('.tiptap th')).toHaveCount(3);
});

test('search replaces text, focus and dark modes can be toggled', async ({ page }) => {
  await page.keyboard.press('Control+h');
  const search = page.getByRole('dialog', { name: 'Suchen und Ersetzen' });
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
  for (const [label, extension, expected] of [['HTML', 'html', '<h1>'], ['Einfacher Text', 'txt', 'Gute Ideen brauchen']] as const) {
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
