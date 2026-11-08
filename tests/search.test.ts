import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchBlocks } from '../src/search-core.mjs';
test('search uses continuous block text so marks do not split matches', () => {
  const blocks = [{ from: 1, text: 'Hallo Welt – ÄÖÜ ß' }];
  assert.deepEqual(searchBlocks({ blocks, query: 'lo We' }).matches, [{ from: 4, to: 9 }]);
  assert.equal(searchBlocks({ blocks, query: 'hallo', caseSensitive: true }).matches.length, 0);
  assert.equal(searchBlocks({ blocks, query: 'hallo' }).matches.length, 1);
  assert.equal(searchBlocks({ blocks, query: 'Ä.Ü', regex: true }).matches.length, 1);
  assert.deepEqual(
    searchBlocks({ blocks: [{ from: 1, text: 'Hallo\u00a0Welt' }], query: 'lo We' }).matches,
    [{ from: 4, to: 9 }],
  );
});
test('zero-length unicode regex advances, invalid patterns and oversized input fail clearly', () => {
  assert.deepEqual(
    searchBlocks({ blocks: [{ from: 1, text: '😊' }], query: '(?=)', regex: true }).matches,
    [],
  );
  assert.throws(() => searchBlocks({ blocks: [], query: '[', regex: true }), /ungültig/);
  assert.throws(
    () => searchBlocks({ blocks: [{ from: 1, text: 'a'.repeat(4000001) }], query: 'a' }),
    /vier Millionen/,
  );
  assert.equal(
    searchBlocks({ blocks: [{ from: 1, text: 'aaaa' }], query: 'a', maxResults: 2 }).limited,
    true,
  );
});
