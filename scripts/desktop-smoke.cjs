/* Run after npm run build. Tests the real Electron main/preload/UI bridge. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { _electron } = require('@playwright/test');

const root = path.resolve(__dirname, '..');
const work = path.join(root, 'work', 'desktop-smoke');
const profile = path.join(work, 'profile');
const report = { platform: `${process.platform}-${process.arch}`, checks: [], skipped: [], pdfFonts: '', pageErrors: [] };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try { const result = await check(); if (result) return result; } catch {}
    await sleep(100);
  }
  throw new Error(`Timed out: ${label}`);
}

(async () => {
  await fs.rm(work, { recursive: true, force: true });
  await fs.mkdir(work, { recursive: true });
  let app;
  let window;
  try {
    app = await _electron.launch({
      executablePath: process.env.ELECTRON_PATH || require('electron'),
      args: [...(process.platform === 'linux' ? ['--no-sandbox', '--disable-gpu', '--ozone-platform=headless'] : []), `--user-data-dir=${profile}`, root],
      env: { ...process.env, ...(process.platform === 'linux' ? { XDG_CONFIG_HOME: path.join(work, 'config'), XDG_CACHE_HOME: path.join(work, 'cache') } : {}) },
      timeout: 20000,
    });
    window = await app.firstWindow();
    await app.evaluate(({BrowserWindow})=>{globalThis.__windowKeys=[];const w=BrowserWindow.getAllWindows()[0];w.webContents.on('before-input-event',(_event,input)=>{if(input.key==='Escape'||input.key==='F11')globalThis.__windowKeys.push({key:input.key,type:input.type,full:w.isFullScreen()});});});
    window.on('pageerror', error => report.pageErrors.push(error.message));
    await window.getByRole('button',{name:'Einstellungen',exact:true}).click();
    if(process.platform==='win32')await window.getByLabel('Fenstermodus',{exact:true}).selectOption('maximized');
    else await window.evaluate(()=>window.writely.setWindowMode('maximized'));
    await until(async()=>JSON.parse(await fs.readFile(path.join(profile,'window-settings.json'),'utf8')).mode==='maximized','persist maximized setting');
    if(process.platform==='win32') await until(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isMaximized()),'native Windows maximize');
    if(process.platform==='win32')await window.getByLabel('Fenstermodus',{exact:true}).selectOption('windowed');
    else await window.evaluate(()=>window.writely.setWindowMode('windowed'));
    await until(async()=>JSON.parse(await fs.readFile(path.join(profile,'window-settings.json'),'utf8')).mode==='windowed','persist windowed setting');
    assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isFullScreen()),false);
    if(process.platform==='win32')assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isMovable()),true);
    if(process.platform==='win32') {
      await window.getByLabel('Fenstermodus',{exact:true}).selectOption('fullscreen');
      await until(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isFullScreen()),'native Windows fullscreen');
      await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.focus();w.webContents.focus();});
      await window.bringToFront();
      await window.getByLabel('Fenstermodus',{exact:true}).focus();
      // CDP keyboard events bypass Electron's native before-input-event hook.
      await app.evaluate(({BrowserWindow})=>{const contents=BrowserWindow.getAllWindows()[0].webContents;contents.sendInputEvent({type:'keyDown',keyCode:'Escape'});contents.sendInputEvent({type:'keyUp',keyCode:'Escape'});});
      await until(()=>app.evaluate(({BrowserWindow})=>!BrowserWindow.getAllWindows()[0].isFullScreen()),'Escape exits fullscreen');
      await until(async()=>(await window.getByLabel('Fenstermodus',{exact:true}).inputValue())==='windowed','settings reflect Escape');
    }
    report.checks.push('settings switch to maximized/windowed, persist mode, and native window stays movable');
    await window.getByRole('button',{name:'Vorlagen',exact:true}).click();
    await window.getByRole('button',{name:/Writely kennenlernen/}).click();
    await window.locator('.tiptap h1').waitFor();
    await window.locator('.tiptap[contenteditable="true"]').waitFor();
    assert.equal(await window.evaluate(() => window.writely.platform), process.platform);
    assert.equal(await window.evaluate(() => typeof window.require), 'undefined');
    assert.equal(await app.evaluate(({ app }) => app.getPath('userData')), profile);
    await window.screenshot({ path: path.join(work, 'desktop.png') });
    report.checks.push('real Electron renderer + isolated preload + isolated userData');

    const savedPath = path.join(work, 'desktop.writely');
    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, savedPath);
    await window.keyboard.press('Control+s');
    const saved = await until(async () => JSON.parse(await fs.readFile(savedPath, 'utf8')), 'native save .writely');
    assert.equal(saved.schemaVersion, 1);
    assert.equal(saved.title, 'Gedanken, die bleiben');
    report.checks.push('native Save dialog bridge writes valid .writely');

    // A real .writely file is opened through the desktop dialog, then edited in the UI.
    const fixturePath = path.join(work, 'fixture.writely');
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6GkAAAAASUVORK5CYII=';
    const fixture = { ...saved, id: 'desktop-smoke-fixture', title: 'Desktop-Prüfung', content: { type: 'doc', content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Prüfung – Größe & Spaß' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Ein fett gesetzter Gedanke', marks: [{ type: 'bold' }] }, { type: 'text', text: ' mit Umlauten: ÄÖÜ äöü ß.' }] },
      { type: 'table', content: [
        { type: 'tableRow', content: [{ type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Name' }] }] }, { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Wert' }] }] }] },
        { type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Lokal' }] }] }, { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '100 %' }] }] }] },
      ] },
      { type: 'image', attrs: { src: `data:image/png;base64,${png}`, alt: 'Lokales Testbild' } },
      { type: 'paragraph', content: [{ type: 'text', text: 'Ende des Dokuments.' }] },
    ] } };
    await fs.writeFile(fixturePath, JSON.stringify(fixture));
    await app.evaluate(({ dialog }, filePath) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] }); }, fixturePath);
    await window.keyboard.press('Control+o');
    await until(async () => (await window.locator('.tiptap h1').textContent()) === 'Prüfung – Größe & Spaß', 'native open .writely');
    assert.equal(await window.locator('.tiptap table').count(), 1);
    assert.equal(await window.locator('.tiptap img').count(), 1);
    assert.match(await window.locator('.tiptap strong').textContent(), /fett gesetzter/);
    report.checks.push('native Open reads headings, bold, Unicode, table and embedded PNG');

    const docxPath = path.join(work, 'desktop.docx');
    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, docxPath);
    await window.getByRole('button', { name: 'Exportieren', exact: true }).click();
    await window.getByRole('dialog', { name: 'Exportieren' }).getByRole('button', { name: /Word-Dokument/ }).click();
    const docx = await until(async () => { const data = await fs.readFile(docxPath); return data.length > 100 ? data : null; }, 'DOCX export');
    assert.equal(docx.subarray(0, 2).toString(), 'PK');
    await app.evaluate(({ dialog }, filePath) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] }); }, docxPath);
    await window.keyboard.press('Control+o');
    await until(async () => (await window.locator('.tiptap h1').textContent()) === 'Prüfung – Größe & Spaß', 'DOCX reimport');
    await until(async () => (await window.locator('.toast').textContent())?.includes('Writely-Struktur'), 'DOCX import completed');
    assert.equal(await window.getByLabel('Dokumenttitel').inputValue(),fixture.title);
    assert.equal(await window.locator('.tiptap table').count(), 1);
    assert.equal(await window.locator('.tiptap img').count(), 1);
    assert.match(await window.locator('.tiptap strong').textContent(), /fett gesetzter/);
    assert.match(await window.locator('.tiptap').textContent(), /ÄÖÜ äöü ß/);
    report.checks.push('UI DOCX export/reimport preserves headings, Unicode, bold, table and PNG');

    const pdfPath = path.join(work, 'desktop.pdf');
    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, pdfPath);
    await window.getByRole('button', { name: 'Exportieren', exact: true }).click();
    await window.getByRole('dialog', { name: 'Exportieren' }).getByRole('button', { name: /PDF Zum Lesen/ }).click();
    const pdf = await until(async () => { const data = await fs.readFile(pdfPath); return data.length > 500 ? data : null; }, 'PDF export', 30000);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    report.checks.push('UI PDF export writes a valid PDF header and nonempty content');
    await window.getByRole('dialog', { name: 'Exportieren' }).waitFor({ state: 'hidden' });
    try {
      report.pdfFonts = execFileSync('pdffonts', [pdfPath], { encoding: 'utf8' });
      assert.match(report.pdfFonts, /SourceSerif|Inter/);
      assert.match(report.pdfFonts, /yes\s+yes/);
      report.checks.push('Poppler verifies embedded bundled fonts in PDF');
    } catch (error) {
      if (error.code === 'ENOENT') report.skipped.push('PDF font embedding inspection: pdffonts is not installed');
      else throw error;
    }
    try {
      const pdfText = execFileSync('pdftotext', ['-enc', 'UTF-8', pdfPath, '-'], { encoding: 'utf8' });
      assert.match(pdfText, /Prüfung – Größe & Spaß/);
      assert.match(pdfText, /ÄÖÜ äöü ß/);
      report.checks.push('Poppler verifies Unicode PDF text extraction');
    } catch (error) {
      if (error.code === 'ENOENT') report.skipped.push('PDF Unicode text extraction inspection: pdftotext is not installed');
      else throw error;
    }

    const mainWindowId=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].id);
    const mixedDoc={...fixture,page:{size:'A5',marginMm:15,widthMm:148,heightMm:210,numbering:{enabled:true,start:5,total:true}},content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Hochformat'}]},{type:'layoutBreak',attrs:{kind:'section',id:'mixed-section',layout:{size:'A4',marginMm:20,orientation:'landscape',numbering:{enabled:true,start:1,total:true}}}},{type:'paragraph',content:[{type:'text',text:'Querformat'}]}]}};
    const mixedPDF=path.join(work,'mixed-layout.pdf');
    await app.evaluate(({dialog},filePath)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath});},mixedPDF);
    await window.evaluate(doc=>window.writely.exportFile('pdf',doc,''),mixedDoc);
    const {PDFDocument}=require('pdf-lib');const parsed=await PDFDocument.load(await fs.readFile(mixedPDF));
    assert.equal(parsed.getPageCount(),2);
    assert.ok(Math.abs(parsed.getPage(0).getWidth()-148/25.4*72)<2);
    assert.ok(Math.abs(parsed.getPage(1).getWidth()-297/25.4*72)<2);
    try{const text=execFileSync('pdftotext',[mixedPDF,'-'],{encoding:'utf8'});assert.match(text,/Seite 5 von 2/);assert.match(text,/Seite 6 von 2/);report.checks.push('mixed PDF numbering continues across sections');}catch(error){if(error.code==='ENOENT')report.skipped.push('Mixed PDF numbering text inspection: pdftotext is not installed');else throw error;}
    await window.evaluate(doc=>window.writely.previewDocument(doc),mixedDoc);
    assert.ok(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length>=2));
    const preview=await until(()=>app.windows().find(p=>/Druckvorschau/.test(p.url())), 'PDF preview window');
    if(process.platform==='linux')await preview.setViewportSize({width:1100,height:850});
    const pdfFrame=await until(()=>preview.frames().find(f=>f.url().startsWith('chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/')), 'native PDF viewer frame');
    await pdfFrame.locator('viewer-toolbar').waitFor({state:'visible'});
    await pdfFrame.locator('#plugin').waitFor({state:'attached'});
    await until(()=>pdfFrame.evaluate(()=>document.querySelector('pdf-viewer')?.loadState_==='success'), 'native PDF viewer finishes rendering');
    await fs.writeFile(path.join(work,'preview-dom.html'),await pdfFrame.content());
    await preview.screenshot({path:path.join(work,'preview.png')});
    await app.evaluate(({BrowserWindow},id)=>{for(const w of BrowserWindow.getAllWindows())if(w.id!==id)w.close();},mainWindowId);
    report.checks.push('mixed A5 portrait/A4 landscape PDF uses genuine page boxes and opens native preview');

    // Close immediately after an edit, before the debounce can save it.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].focus());
    await window.locator('.tiptap').focus();
    await window.locator('.tiptap').press('Control+End');
    await window.locator('.tiptap').press('Enter');
    await window.locator('.tiptap').pressSequentially('Letzte Eingabe unmittelbar vor dem Schließen.');
    report.finalInputState = await window.locator('.tiptap').evaluate(element => ({ editable: element.getAttribute('contenteditable'), focused: document.activeElement === element, lastText: element.textContent.slice(-200) }));
    assert.ok((await window.locator('.tiptap').textContent()).includes('Letzte Eingabe unmittelbar vor dem Schließen.'), 'The final edit must be visible before native close');
    const child = app.process();
    const exited = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Native close did not exit')), 15000);
      child.once('exit', code => { clearTimeout(timeout); resolve(code); });
    });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    await exited;
    app = undefined;
    const recoveryPath = path.join(profile, 'local-documents', 'recovery.writely');
    const recovery = JSON.parse(await fs.readFile(recoveryPath, 'utf8'));
    assert.ok(JSON.stringify(recovery.content).includes('Letzte Eingabe unmittelbar vor dem Schließen.'), 'Native close must preserve the last editor transaction');
    report.checks.push('native close flushes last edit before autosave debounce');
    assert.deepEqual(report.pageErrors, []);
    await fs.writeFile(path.join(work, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    if(app)report.windowDiagnostics=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];return {keys:globalThis.__windowKeys,focused:w?.isFocused(),fullscreen:w?.isFullScreen(),bounds:w?.getBounds()};}).catch(()=>null);
    if (window && !window.isClosed()) await window.screenshot({ path: path.join(work, 'failure.png') }).catch(() => {});
    if (app) await app.close().catch(() => {});
    await fs.writeFile(path.join(work, 'report.json'), JSON.stringify({ ...report, failure: error.message }, null, 2));
    console.error(error.stack || error);
    process.exitCode = 1;
  }
})();
