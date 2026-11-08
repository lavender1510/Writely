const { contextBridge, ipcRenderer } = require('electron');

let flushCallback;
ipcRenderer.on('writely:flush', async (_event, token) => {
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
  open: () => ipcRenderer.invoke('writely:open'),
  save: (document, path) => ipcRenderer.invoke('writely:save', document, path),
  recover: () => ipcRenderer.invoke('writely:recover'),
  autosave: document => ipcRenderer.invoke('writely:autosave', document),
  versions: () => ipcRenderer.invoke('writely:versions'),
  restoreVersion: id => ipcRenderer.invoke('writely:restore-version', id),
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
