const { contextBridge, ipcRenderer } = require('electron');

let flushCallback;
let secureFlushCallback;
ipcRenderer.on('writely:flush', async (_event, token) => {
  if(secureFlushCallback){
    try{await secureFlushCallback();await ipcRenderer.invoke('writely:flush-reply',token,{secureFlush:true,failed:false});}
    catch{await ipcRenderer.invoke('writely:flush-reply',token,{secureFlush:true,failed:true});}
    return;
  }
  try {
    const document = flushCallback ? await flushCallback() : undefined;
    await ipcRenderer.invoke('writely:flush-reply', token, document);
  } catch {
    await ipcRenderer.invoke('writely:flush-reply', token, undefined).catch(() => {});
  }
});

// Expose only the capability-specific document API; never expose raw IPC or Node.
contextBridge.exposeInMainWorld('writely', Object.freeze({
  platform: process.platform,
  onSecureFlush:callback=>{secureFlushCallback=callback;return()=>{if(secureFlushCallback===callback)secureFlushCallback=undefined;};},
  sealedRead:()=>ipcRenderer.invoke('writely:sealed-read'),
  sealedWrite:text=>ipcRenderer.invoke('writely:sealed-write',text),
  secureOpen:()=>ipcRenderer.invoke('writely:secure-open'),
  secureSave:(name,text,mime)=>ipcRenderer.invoke('writely:secure-save',name,text,mime),
  spellCheck:(language,words)=>ipcRenderer.invoke('writely:spell-check',language,words),
  spellSuggest:(language,word)=>ipcRenderer.invoke('writely:spell-suggest',language,word),
  dictionaryWords:language=>ipcRenderer.invoke('writely:dictionary-list',language),
  dictionaryChange:(language,word,remove)=>ipcRenderer.invoke('writely:dictionary-change',language,word,remove),
  nativeWindow:true,
  clipboardImage:()=>ipcRenderer.invoke('writely:clipboard-image'),
  captureScreenshot:()=>ipcRenderer.invoke('writely:screenshot'),
  previewDocument:document=>ipcRenderer.invoke('writely:preview',document),
  onWindowSettingsChanged:callback=>{const listener=(_event,info)=>callback(info);ipcRenderer.on('writely:window-changed',listener);return ()=>ipcRenderer.removeListener('writely:window-changed',listener);},
  getWindowSettings:()=>ipcRenderer.invoke('writely:window-settings'),
  setWindowMode:mode=>ipcRenderer.invoke('writely:window-mode',mode),
  moveWindowToDisplay:id=>ipcRenderer.invoke('writely:window-display',id),
  launchOpen:()=>ipcRenderer.invoke('writely:launch-open'),
  librarySearch:query=>ipcRenderer.invoke('writely:library-search',query),
  exportBackup:()=>ipcRenderer.invoke('writely:backup-export'),
  importBackup:()=>ipcRenderer.invoke('writely:backup-import'),
  historySettings:()=>ipcRenderer.invoke('writely:history-settings'),
  configureHistory:value=>ipcRenderer.invoke('writely:history-configure',value),
  previewVersion:(id,documentId)=>ipcRenderer.invoke('writely:preview-version',id,documentId),
  libraryList:()=>ipcRenderer.invoke('writely:library-list'),
  libraryGet:id=>ipcRenderer.invoke('writely:library-get',id),
  libraryPut:(doc,path,folderId)=>ipcRenderer.invoke('writely:library-put',doc,path,folderId),
  libraryMutate:(action,data)=>ipcRenderer.invoke('writely:library-mutate',action,data),
  open: (folderId) => ipcRenderer.invoke('writely:open',folderId),
  save: (document, path) => ipcRenderer.invoke('writely:save', document, path),
  recover: () => ipcRenderer.invoke('writely:recover'),
  autosave: document => ipcRenderer.invoke('writely:autosave', document),
  versions: documentId => ipcRenderer.invoke('writely:versions',documentId),
  restoreVersion: (id,documentId) => ipcRenderer.invoke('writely:restore-version', id,documentId),
  exportFile: (format, document, html) => ipcRenderer.invoke('writely:export', format, document, html),
  listFonts: () => ipcRenderer.invoke('writely:fonts'),
  minimize: () => ipcRenderer.send('writely:minimize'),
  maximize: () => ipcRenderer.send('writely:maximize'),
  close: () => ipcRenderer.send('writely:close'),
  requestClose: document => ipcRenderer.invoke('writely:request-close', document),
  onFlush: callback => {
    flushCallback = callback;
    return () => { if (flushCallback === callback) flushCallback = undefined; };
  },
}));
