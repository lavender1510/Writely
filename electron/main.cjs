const { app, BrowserWindow, dialog, ipcMain, Menu, session, screen } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL, fileURLToPath } = require('node:url');
const { LocalStore, MAX_FILE_BYTES, validateDocument, atomicWrite, readDocument } = require('./storage.cjs');
const { bundledFontFaces } = require('./pdf-styles.cjs');

const APP_DIRECTORY = path.resolve(__dirname, '..', 'dist');
let mainWindow;
let store;
let library;
let windowSettings;
let pendingLaunch=process.argv.find(arg=>/\.writely$/i.test(arg));
let isQuitting = false;
let closing = false;
let closePending = false;
let pendingFlush;
let cachedFontCSS;
const writablePaths = new Set();
const devURL = process.env.WRITELY_DEV_URL;
if (devURL && !/^http:\/\/(localhost|127\.0\.0\.1):\d+\/?$/.test(devURL)) throw new Error('Die Entwicklungsadresse muss lokal sein.');

function isMainFrame(event) {
  return mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents && event.senderFrame === mainWindow.webContents.mainFrame;
}
function assertSender(event) { if (!isMainFrame(event)) throw new Error('Dieser Zugriff auf Writely ist nicht erlaubt.'); }
function germanError(error) {
  const message = typeof error?.message === 'string' ? error.message : '';
  if (/^(Dieser Fenstermodus|Dieser Bildschirm|Die Writely-Datei|Diese Dokumentversion|Dieses Dateiformat|Das Dokument|Der Import|Die Datei)/.test(message)) return message;
  if (error?.code === 'ENOENT') return 'Die Datei wurde nicht gefunden. Sie wurde möglicherweise verschoben.';
  if (['EACCES', 'EPERM', 'EBUSY'].includes(error?.code)) return 'Die Datei konnte nicht geschrieben werden. Prüfe die Zugriffsrechte und ob sie in einer anderen App geöffnet ist.';
  if (error?.code === 'ENOSPC') return 'Die Datei konnte nicht gespeichert werden. Auf dem Laufwerk ist kein freier Speicherplatz mehr.';
  return 'Die Datei konnte nicht verarbeitet werden. Prüfe das Format und versuche es erneut.';
}
function handle(name, callback) {
  ipcMain.handle(`writely:${name}`, async (event, ...args) => {
    assertSender(event);
    try { return await callback(...args); } catch (error) { throw new Error(germanError(error)); }
  });
}
function documentName(document) { return (document.title || 'Unbenannt').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim().slice(0, 180) || 'Unbenannt'; }

async function exportPDF(document, html) {
  const {renderDocument,sectionBody}=require('./print-layout.cjs');
  return Buffer.from(await renderDocument(document,(section,css)=>exportPDFSection({...document,page:section.layout},sectionBody(section,document),css)));
}
async function exportPDFSection(document, html, pageCSS='') {
  const { safeHtml, exportStyles } = require('./formats.cjs');
  if (typeof html !== 'string' || Buffer.byteLength(html) > MAX_FILE_BYTES) throw new Error('Das Dokument ist für den PDF-Export zu groß.');
  const temporaryRoot = path.join(app.getPath('temp'), 'writely-pdf');
  await fs.mkdir(temporaryRoot, { recursive: true });
  const temporaryDirectory = await fs.mkdtemp(path.join(temporaryRoot, 'export-'));
  const pdfSession = session.fromPartition('writely-pdf');
  pdfSession.webRequest.onBeforeRequest((details, callback) => {
    let allowed = details.url.startsWith('data:');
    if (details.url.startsWith('file:')) {
      try { const relative = path.relative(temporaryRoot, fileURLToPath(details.url)); allowed = relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative); } catch { allowed = false; }
    }
    callback({ cancel: !allowed });
  });
  pdfSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  const pdfWindow = new BrowserWindow({ show: false, webPreferences: { session: pdfSession, sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: true, webSecurity: true } });
  try {
    const body = safeHtml(html);
    cachedFontCSS ??= bundledFontFaces(path.join(APP_DIRECTORY, 'assets'));
    const fontCSS = await cachedFontCSS;
    const styleCSS = typeof exportStyles === 'function' ? exportStyles(document) : '';
    const title = document.title.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
    const pdfHTML = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${title}</title><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:"><style>${fontCSS}body{font-family:'Source Serif 4',serif;font-size:12pt;line-height:1.6;color:#1c1c20}h1,h2,h3,h4,h5,h6{break-after:avoid}img{max-width:100%;height:auto}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:6px}blockquote{border-left:3px solid #8b6ace;margin-left:0;padding-left:16px;color:#555}pre{white-space:pre-wrap}a{color:inherit;text-decoration:underline}p{orphans:3;widows:3}${styleCSS}${pageCSS}</style></head><body>${body}</body></html>`;
    // A temporary local page avoids Chromium's navigation URL limit with embedded images/fonts.
    const pdfFile = path.join(temporaryDirectory, 'document.html');
    await atomicWrite(pdfFile, pdfHTML);
    await pdfWindow.loadFile(pdfFile);
    // Only this application-owned statement executes; the page's CSP rejects all document scripts.
    await pdfWindow.webContents.executeJavaScript('document.fonts.ready.then(() => true)', true);
    await pdfWindow.webContents.executeJavaScript('Promise.all(Array.from(document.images).map(img=>img.decode().catch(()=>{})))',true);
    return await pdfWindow.webContents.printToPDF({printBackground:true,preferCSSPageSize:true,pageSize:{width:Math.round(document.page.widthMm*1000),height:Math.round(document.page.heightMm*1000)},margins:{top:0,bottom:0,left:0,right:0},generateDocumentOutline:true});
  } finally { pdfWindow.destroy(); await fs.rm(temporaryDirectory, { recursive: true, force: true }); }
}

function registerBridge() {
  handle('clipboard-image',()=>{const image=require('electron').clipboard.readImage();if(image.isEmpty())throw new Error('Die Datei fehlt: In der Zwischenablage liegt kein Bild.');return image.toDataURL();});
  handle('screenshot',async()=>{const sources=await require('electron').desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:1920,height:1080}});if(!sources.length)throw new Error('Die Datei konnte nicht erstellt werden: Kein Bildschirm für einen Screenshot verfügbar.');const result=await dialog.showMessageBox(mainWindow,{type:'question',title:'Screenshot einfügen',message:'Welchen Bildschirm möchtest du als Bild einfügen?',buttons:[...sources.map(s=>s.name),'Abbrechen'],cancelId:sources.length});if(result.response>=sources.length)return null;return sources[result.response].thumbnail.toDataURL();});
  handle('preview', async document => {
    validateDocument(document);
    const bytes = await exportPDF(document, '');
    const dir = await fs.mkdtemp(path.join(app.getPath('temp'), 'writely-preview-'));
    const file = path.join(dir, 'Druckvorschau.pdf');
    await atomicWrite(file, bytes);
    const viewerOrigin = 'chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/';
    const sameFile = url => {
      try {
        if (!url.startsWith('file:')) return false;
        const candidate = path.resolve(fileURLToPath(url)), expected = path.resolve(file);
        return process.platform === 'win32' ? candidate.toLowerCase() === expected.toLowerCase() : candidate === expected;
      } catch { return false; }
    };
    const isViewerDocument = url => sameFile(url) || url.startsWith(viewerOrigin);
    const previewSession = session.fromPartition('preview-' + Date.now());
    previewSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !isViewerDocument(details.url) && !details.url.startsWith('chrome://resources/') && !details.url.startsWith('chrome://pdf/') && !details.url.startsWith('blob:') && !details.url.startsWith('data:') }));
    previewSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    const preview = new BrowserWindow({ parent: mainWindow, icon: path.join(APP_DIRECTORY, 'writely.png'), width: 1100, height: 850, title: 'Writely · Druckvorschau', webPreferences: { session: previewSession, sandbox: true, contextIsolation: true, nodeIntegration: false, plugins: true } });
    preview.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    preview.webContents.on('will-navigate', (event, url) => { if (!isViewerDocument(url)) event.preventDefault(); });
    preview.on('closed', () => fs.rm(dir, { recursive: true, force: true }).catch(() => {}));
    try { await preview.loadFile(file); }
    catch (error) { console.error('Writely PDF preview:', error); if (!preview.isDestroyed()) preview.destroy(); throw error; }
  });
  handle('window-settings',()=>windowSettings.info());
  handle('window-mode',mode=>windowSettings.setMode(mode));
  handle('window-display',id=>windowSettings.move(id));
  handle('launch-open',async()=>{if(!pendingLaunch)return null;const filePath=path.resolve(pendingLaunch);pendingLaunch=undefined;const document=await readDocument(filePath);writablePaths.add(filePath);await library.put(document,filePath);return {document,path:filePath};});
  handle('library-list',()=>library.list());
  handle('library-get',async id=>{const result=await library.get(id);if(result.path)writablePaths.add(path.resolve(result.path));return result;});
  handle('library-put',(doc,filePath)=>library.put(validateDocument(doc),typeof filePath==='string'&&writablePaths.has(path.resolve(filePath))?filePath:undefined));
  handle('library-mutate',(action,data)=>library.mutate(action,data));
  handle('flush-reply', (token, document) => {
    if (!pendingFlush || pendingFlush.token !== token) return;
    const snapshot = document === undefined ? null : validateDocument(document);
    const resolve = pendingFlush.resolve;
    pendingFlush = undefined;
    resolve(snapshot);
  });
  handle('request-close', async document => {
    await store.autosave(validateDocument(document));
    await library.put(document);
    await store.flush();
    // Let the invocation return before destroying its renderer process.
    setImmediate(() => { closing = true; if (!mainWindow.isDestroyed()) mainWindow.close(); });
  });
  handle('open', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { title: 'Dokument öffnen', properties: ['openFile'], filters: [{ name: 'Unterstützte Dokumente', extensions: ['writely', 'docx', 'txt', 'md', 'markdown', 'html', 'htm', 'odt', 'rtf', 'epub'] }, { name: 'Alle Dateien', extensions: ['*'] }] });
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    const stat = await fs.stat(filePath);
    if (stat.size > MAX_FILE_BYTES) throw new Error('Die Datei ist größer als 64 MB. Bitte teile sie vor dem Import auf.');
    const extension = path.extname(filePath).toLowerCase().slice(1);
    let document;
    if (extension === 'writely') document = await readDocument(filePath);
    else if(['odt','rtf','epub'].includes(extension)){const buffer=await fs.readFile(filePath);const recovered=extension==='odt'||extension==='epub'?await require('./roundtrip.cjs').recover(buffer):null;const layoutImport=!recovered&&extension==='odt'?await require('./odt-layout.cjs').prepare(buffer):null;const html=recovered?null:await require('./converters.cjs').convert(layoutImport?.buffer||buffer,extension,'html',path.basename(filePath));document=recovered||validateDocument(await require('./formats.cjs').importFile(html,'html',path.basename(filePath)));if(layoutImport){document.content=require('./docx-layout.cjs').restore(document.content,layoutImport.tokens);if(layoutImport.page)document.page=layoutImport.page;}if(!recovered)document.importWarnings=['Semantischer Import: Seitenlayout, Kopf-/Fußzeilen, Noten und Kommentare können vereinfacht werden. Bitte prüfe das Ergebnis.'];}
    else document = validateDocument(await require('./formats.cjs').importFile(await fs.readFile(filePath), extension, path.basename(filePath)));
    if (extension === 'writely') writablePaths.add(path.resolve(filePath));
    await library.put(document,filePath);
    return { path: filePath, document };
  });
  handle('save', async (document, requestedPath) => {
    validateDocument(document);
    let filePath;
    if (typeof requestedPath === 'string' && path.extname(requestedPath).toLowerCase() === '.writely' && writablePaths.has(path.resolve(requestedPath))) filePath = requestedPath;
    else {
      const result = await dialog.showSaveDialog(mainWindow, { title: 'Writely-Dokument speichern', defaultPath: `${documentName(document)}.writely`, filters: [{ name: 'Writely-Dokument', extensions: ['writely'] }] });
      if (result.canceled || !result.filePath) return null;
      filePath = result.filePath.toLowerCase().endsWith('.writely') ? result.filePath : `${result.filePath}.writely`;
      writablePaths.add(path.resolve(filePath));
    }
    await store.save(document, filePath);
    await library.put(document,filePath);
    return { path: filePath };
  });
  handle('recover', () => store.recover());
  handle('autosave', async document => {await store.autosave(validateDocument(document));await library.put(document);});
  handle('versions', () => store.versions());
  handle('restore-version', id => store.restoreVersion(id));
  handle('export', async (format, document, html) => {
    validateDocument(document);
    const names = { docx: 'Word-Dokument', pdf: 'PDF-Dokument', html: 'HTML-Dokument', txt: 'Textdatei', md: 'Markdown', odt:'OpenDocument',rtf:'Rich Text',epub:'E-Book' };
    if (!Object.hasOwn(names, format)) throw new Error('Dieses Dateiformat wird in dieser Vorabversion noch nicht unterstützt.');
    const result = await dialog.showSaveDialog(mainWindow, { title: `Als ${names[format]} exportieren`, defaultPath: `${documentName(document)}.${format}`, filters: [{ name: names[format], extensions: [format] }] });
    if (result.canceled || !result.filePath) return null;
    const filePath = result.filePath.toLowerCase().endsWith(`.${format}`) ? result.filePath : `${result.filePath}.${format}`;
    let resultBuffer = format==='odt'?await require('./odt.cjs').exportOdt(document):['rtf','epub'].includes(format) ? await require('./converters.cjs').convert(Buffer.from(require('./formats.cjs').exportText(document,'html')),'html',format,document.title) : format === 'pdf' ? await exportPDF(document, html||require('./formats.cjs').exportText(document,'html')) : await require('./formats.cjs').exportDocument(format, document, html);
    if(format==='odt'||format==='epub')resultBuffer=await require('./roundtrip.cjs').attach(resultBuffer,document);
    await atomicWrite(filePath, resultBuffer);
    return { path: filePath };
  });
  handle('fonts', async () => {
    try {
      const fontList = require('font-list');
      const fonts = await fontList.getFonts({ disableQuoting: true });
      return [...new Set(fonts.filter(name => typeof name === 'string' && name.length < 200))].sort((a, b) => a.localeCompare(b));
    } catch { return ['Arial', 'Calibri', 'Cambria', 'Consolas', 'Georgia', 'Segoe UI', 'Times New Roman', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Courier New', 'Impact']; }
  });
  for (const action of ['minimize', 'maximize', 'close']) ipcMain.on(`writely:${action}`, event => {
    if (!isMainFrame(event)) return;
    if (action === 'minimize') mainWindow.minimize();
    if (action === 'maximize') windowSettings.setMode(mainWindow.isMaximized()||mainWindow.isFullScreen()?'windowed':'maximized').catch(()=>{});
    if (action === 'close') mainWindow.close();
  });
}

function lockNetwork() {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    let allowed = details.url.startsWith('data:') || details.url.startsWith('blob:');
    if (details.url.startsWith('file:')) {
      try { const relative = path.relative(APP_DIRECTORY, fileURLToPath(details.url)); allowed = relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative); } catch { allowed = false; }
    }
    if (devURL) { try { allowed ||= new URL(details.url).origin === new URL(devURL).origin; } catch {} }
    callback({ cancel: !allowed });
  });
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.on('will-download', event => event.preventDefault());
}

async function createWindow() {
  windowSettings=new (require('./window-settings.cjs').WindowSettings)(path.join(app.getPath('userData'),'window-settings.json'),screen);
  const bounds=await windowSettings.load();
  mainWindow = new BrowserWindow({ ...bounds, minWidth: Math.min(960,bounds.width), minHeight:Math.min(640,bounds.height), resizable:true, movable:true, show: false, frame: true, icon:path.join(APP_DIRECTORY,'writely.png'), title: 'Writely', backgroundColor: '#f5f4f8', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, spellcheck: true } });
  windowSettings.changed=info=>{if(!mainWindow.isDestroyed())mainWindow.webContents.send('writely:window-changed',info);};
  windowSettings.attach(mainWindow);
  mainWindow.webContents.on('before-input-event',(event,input)=>{if(input.type==='keyDown'&&((input.key==='Escape'&&mainWindow.isFullScreen())||(input.key==='F11'&&input.control&&input.shift))){event.preventDefault();windowSettings.setMode('windowed').catch(()=>{});}});
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', event => event.preventDefault());
  mainWindow.once('ready-to-show', () => {mainWindow.show();windowSettings.setMode(windowSettings.state.mode).catch(()=>{});});
  mainWindow.on('close', event => {
    if (closing) return;
    event.preventDefault();
    if (closePending) return;
    closePending = true;
    (async () => {
      const document = await new Promise(resolve => {
        const token = `${Date.now()}-${Math.random()}`;
        const timeout = setTimeout(() => { if (pendingFlush?.token === token) { pendingFlush = undefined; resolve(null); } }, 2000);
        pendingFlush = { token, resolve: value => { clearTimeout(timeout); resolve(value); } };
        mainWindow.webContents.send('writely:flush', token);
      });
      if (document) {await store.autosave(document);await library.put(document);}
      await store.flush();
      await windowSettings.queue;
      closing = true;
      if (!mainWindow.isDestroyed()) mainWindow.close();
    })().catch(error => { closePending = false; dialog.showErrorBox('Writely konnte deine letzten Änderungen nicht sichern', germanError(error)); });
  });
  if (devURL) await mainWindow.loadURL(devURL);
  else await mainWindow.loadURL(pathToFileURL(path.join(APP_DIRECTORY, 'index.html')).href);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    store = new LocalStore(path.join(app.getPath('userData'), 'local-documents'));
    library=new (require('./library.cjs').Library)(path.join(app.getPath('userData'),'library'));
    lockNetwork();
    registerBridge();
    await createWindow();
  }).catch(error => { dialog.showErrorBox('Writely konnte nicht gestartet werden', germanError(error)); app.quit(); });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', event => {
    if (isQuitting || !store) return;
    event.preventDefault();
    isQuitting = true;
    store.flush().finally(() => app.quit());
  });
}
