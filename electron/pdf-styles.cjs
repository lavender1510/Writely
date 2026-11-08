const fs = require('node:fs/promises');
const path = require('node:path');

/** Embed the application's own OFL-licensed fonts, preserving generated subset ranges. */
async function bundledFontFaces(assetsDirectory) {
  let files;
  try { files = await fs.readdir(assetsDirectory); } catch (error) { if (error.code === 'ENOENT') return ''; throw error; }
  const faces = [];
  for (const filename of files.filter(file => file.endsWith('.css'))) {
    const css = await fs.readFile(path.join(assetsDirectory, filename), 'utf8');
    for (const rule of css.match(/@font-face\s*\{[^}]*\}/gi) || []) {
      if (!/font-family\s*:\s*["']?(Inter|Source Serif 4)["']?(?=\s*[;}])/i.test(rule)) continue;
      // WOFF2 is supported by Chromium; drop fallback source URLs to keep the PDF payload small.
      const woff2 = rule.match(/url\(\s*["']?([^\s"')]+\.woff2)(?:["']?)\s*\)/i);
      if (!woff2) continue;
      const asset = path.basename(woff2[1]);
      if (!/^(inter|source-serif-4)-[a-zA-Z0-9_-]+\.woff2$/.test(asset)) continue;
      const bytes = await fs.readFile(path.join(assetsDirectory, asset));
      const source = `src:url(data:font/woff2;base64,${bytes.toString('base64')}) format('woff2');`;
      faces.push(rule.replace(/src\s*:[^;]+;/i, source).replace(/font-display\s*:[^;]+;/i, 'font-display:block;'));
    }
  }
  return faces.join('\n');
}

module.exports = { bundledFontFaces };
