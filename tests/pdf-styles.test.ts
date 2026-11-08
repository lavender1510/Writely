import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { bundledFontFaces } = require('../electron/pdf-styles.cjs');

test('PDF font styles embed only bundled WOFF2 while preserving weight and Unicode subsets', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'writely-fonts-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path.join(directory, 'inter-latin-400-normal-abc.woff2'), Buffer.from('inter test font'));
  await writeFile(path.join(directory, 'source-serif-4-latin-ext-600-normal-def.woff2'), Buffer.from('serif test font'));
  await writeFile(path.join(directory, 'index.css'), `@font-face{font-family:Inter;font-style:normal;font-display:swap;font-weight:400;src:url(/assets/inter-latin-400-normal-abc.woff2) format("woff2"),url(/assets/inter-latin-400-normal-abc.woff) format("woff");unicode-range:U+0-FF;}\n@font-face{font-family:"Source Serif 4";font-weight:600;src:url("./source-serif-4-latin-ext-600-normal-def.woff2") format("woff2");unicode-range:U+100-2FF;}\nbody{color:red}`);
  const css = await bundledFontFaces(directory);
  assert.match(css, /data:font\/woff2;base64,aW50ZXIgdGVzdCBmb250/);
  assert.match(css, /font-weight:600/);
  assert.match(css, /unicode-range:U\+100-2FF/);
  assert.match(css, /font-display:block/);
  assert.doesNotMatch(css, /url\(\/assets|\.woff\)|body\{/);
});

test('PDF font styles tolerate a missing development build', async () => {
  assert.equal(await bundledFontFaces(path.join(tmpdir(), `writely-missing-${Date.now()}`)), '');
});
