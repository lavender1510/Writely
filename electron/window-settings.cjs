const fs = require('node:fs/promises');
const { atomicWrite } = require('./storage.cjs');
const MODES = ['windowed', 'maximized', 'fullscreen'];

// All coordinates are device-independent pixels, including negative monitor origins.
function fitBounds(bounds, displays, preferredId) {
  const display = displays.find(d => d.id === preferredId)
    || displays.find(d => bounds && bounds.x + bounds.width / 2 >= d.workArea.x && bounds.x + bounds.width / 2 < d.workArea.x + d.workArea.width && bounds.y + bounds.height / 2 >= d.workArea.y && bounds.y + bounds.height / 2 < d.workArea.y + d.workArea.height)
    || displays[0];
  const area = {...display.workArea, width:display.workArea.width>=100?display.workArea.width:1400, height:display.workArea.height>=100?display.workArea.height:900};
  const width = Math.min(area.width, Math.max(Math.min(960, area.width), Math.round(Number(bounds?.width) || Math.min(1400, area.width * .85))));
  const height = Math.min(area.height, Math.max(Math.min(640, area.height), Math.round(Number(bounds?.height) || Math.min(900, area.height * .85))));
  const x = Number.isFinite(bounds?.x) ? bounds.x : area.x + (area.width - width) / 2;
  const y = Number.isFinite(bounds?.y) ? bounds.y : area.y + (area.height - height) / 2;
  return { x: Math.round(Math.max(area.x, Math.min(x, area.x + area.width - width))), y: Math.round(Math.max(area.y, Math.min(y, area.y + area.height - height))), width, height };
}
async function readSettings(file) {
  try {
    const value = JSON.parse(await fs.readFile(file, 'utf8'));
    if(!value||typeof value!=='object'||Array.isArray(value))return {mode:'windowed'};
    const b = value.bounds;
    return { mode: MODES.includes(value.mode) ? value.mode : 'windowed', bounds: b && ['x', 'y', 'width', 'height'].every(k => Number.isFinite(b[k]) && Math.abs(b[k]) < 100000) && b.width > 0 && b.height > 0 ? b : undefined };
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return { mode: 'windowed' };
    throw error;
  }
}
class WindowSettings {
  constructor(file, screen) { this.file = file; this.screen = screen; this.queue = Promise.resolve(); this.state = { mode: 'windowed' }; }
  async load() { this.state = await readSettings(this.file); return this.bounds(); }
  displays() { const primary = this.screen.getPrimaryDisplay(); return [primary, ...this.screen.getAllDisplays().filter(d => d.id !== primary.id)]; }
  bounds(id) { return fitBounds(this.state.bounds, this.displays(), id); }
  save() { const snapshot = JSON.stringify(this.state); const write = this.queue.then(() => atomicWrite(this.file, snapshot)); this.queue = write.catch(() => {}); return write; }
  attach(window) {
    this.window = window;
    const remember = () => { if (!window.isDestroyed() && !window.isMaximized() && !window.isFullScreen()) { this.state.bounds = window.getBounds(); this.save().catch(() => {}); this.changed?.(this.info()); } };
    window.on('moved', remember); window.on('resized', remember);
    // Native caption buttons also update the remembered mode.
    for (const [event, mode] of [['maximize','maximized'], ['unmaximize','windowed'], ['enter-full-screen','fullscreen'], ['leave-full-screen','windowed']]) window.on(event, () => { if (!this.applying) { this.state.mode = mode; this.save().catch(() => {}); this.changed?.(this.info()); } });
    const repair = () => { if (!window.isDestroyed() && !window.isFullScreen()) { const bounds = fitBounds(window.getNormalBounds(), this.displays()); window.setMinimumSize(Math.min(960,bounds.width),Math.min(640,bounds.height)); window.setBounds(bounds); this.changed?.(this.info()); } };
    this.screen.on('display-added', repair); this.screen.on('display-removed', repair); this.screen.on('display-metrics-changed', repair);
    window.once('closed', () => { this.screen.removeListener('display-added', repair); this.screen.removeListener('display-removed', repair); this.screen.removeListener('display-metrics-changed', repair); });
  }
  info() { const w = this.window; return { mode: w.isFullScreen() ? 'fullscreen' : w.isMaximized() ? 'maximized' : 'windowed', displayId: this.screen.getDisplayMatching(w.getBounds()).id, displays: this.displays().map((d,i) => ({ id:d.id, label:d.label || `Bildschirm ${i+1} · ${d.workArea.width} × ${d.workArea.height}` })) }; }
  async setMode(mode) {
    if (!MODES.includes(mode)) throw new Error('Dieser Fenstermodus ist nicht verfügbar.');
    const w = this.window;
    this.applying = true;
    try {
      if (mode !== 'fullscreen' && w.isFullScreen()) w.setFullScreen(false);
      if (mode === 'windowed') { if(w.isMaximized())w.unmaximize(); if(w.isMinimized?.())w.restore(); const bounds=this.bounds(); w.setMinimumSize?.(Math.min(960,bounds.width),Math.min(640,bounds.height)); w.setBounds(bounds); }
      if (mode === 'maximized') w.maximize();
      if (mode === 'fullscreen') w.setFullScreen(true);
      this.state.mode = mode;
      w.focus(); w.webContents?.focus();
      await this.save();
    } finally { this.applying = false; }
    // Return the requested mode: native full-screen transitions can finish asynchronously.
    const info={ ...this.info(), mode };
    this.changed?.(info);
    return info;
  }
  async move(id) {
    if (!this.displays().some(d => d.id === id)) throw new Error('Dieser Bildschirm ist nicht mehr angeschlossen.');
    await this.setMode('windowed');
    this.state.bounds = fitBounds({width:this.window.getBounds().width,height:this.window.getBounds().height}, this.displays(), id);
    this.window.setMinimumSize?.(Math.min(960,this.state.bounds.width),Math.min(640,this.state.bounds.height)); this.window.setBounds(this.state.bounds); this.window.focus(); await this.save(); return this.info();
  }
}
module.exports = { fitBounds, readSettings, WindowSettings };
