export function searchBlocks({
  blocks,
  query,
  regex = false,
  caseSensitive = false,
  maxResults = 5000,
}) {
  if (typeof query !== 'string' || query.length > 256)
    throw new Error('Die Suchanfrage darf höchstens 256 Zeichen enthalten.');
  if (!regex) query = query.replace(/[\u00a0\u202f]/g, ' ');
  if (!query) return { matches: [], limited: false };
  if (!Array.isArray(blocks) || blocks.reduce((n, b) => n + b.text.length, 0) > 4000000)
    throw new Error(
      'Die Live-Suche ist auf vier Millionen Textzeichen begrenzt. Bitte suche in einem kleineren Dokument.',
    );
  let pattern;
  try {
    pattern = new RegExp(
      regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      caseSensitive ? 'gu' : 'giu',
    );
  } catch {
    throw new Error('Der reguläre Ausdruck ist ungültig.');
  }
  const matches = [];
  for (const block of blocks) {
    const text = regex ? block.text : block.text.replace(/[\u00a0\u202f]/g, ' ');
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text))) {
      if (!match[0].length) {
        pattern.lastIndex += (block.text.codePointAt(pattern.lastIndex) || 0) > 0xffff ? 2 : 1;
        continue;
      }
      matches.push({
        from: block.from + match.index,
        to: block.from + match.index + match[0].length,
      });
      if (matches.length >= maxResults) return { matches, limited: true };
    }
  }
  return { matches, limited: false };
}
