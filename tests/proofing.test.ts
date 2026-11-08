import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url),
  { Proofing } = require('../electron/proofing.cjs');
test('bundled German and English dictionaries check locally, suggest and retain personal words', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'writely-spell-'));
  const service = new Proofing(join(root, 'personal.json'));
  t.after(async () => {
    await service.close();
    await rm(root, { recursive: true, force: true });
  });
  const wrong = await service.check('de-DE', ['Haus', 'Größe', 'Spaß', 'Huas']);
  assert.deepEqual(wrong, ['Huas']);
  assert.ok((await service.suggest('de-DE', 'Huas')).includes('Haus'));
  assert.deepEqual(await service.check('en-US', ['writing', 'beautiful', 'writting']), [
    'writting',
  ]);
  await service.change('de-DE', 'Writely', false);
  assert.deepEqual(await service.check('de-DE', ['Writely']), []);
  const second = new Proofing(join(root, 'personal.json'));
  assert.ok((await second.words('de-DE')).includes('Writely'));
  await service.change('de-DE', 'Writely', true);
  assert.equal((await service.words('de-DE')).includes('Writely'), false);
  await assert.rejects(service.check('fr-FR', ['Bonjour']), /nicht unterstützt/);
  await assert.rejects(service.change('de-DE', '../bad', false), /ungültig/);
  await second.close();
});
