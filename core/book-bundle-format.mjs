import { parseBookBlock, bookId, blockId } from "./book-block-format.mjs";
export const MAX_BUNDLE_BYTES = 90 * 1024 * 1024;
export function parseVaultTransfer(text) {
  if (typeof text !== "string" || text.length > MAX_BUNDLE_BYTES)
    throw new Error("Das Bibliotheksbackup ist größer als 90 MB.");
  let v;
  try {
    v = JSON.parse(text);
  } catch {
    throw new Error("Die Importdatei enthält kein lesbares Bibliotheksbackup.");
  }
  if (v?.format !== "WritelyVaultBundle")
    return { vault: text, blocks: [], bundle: false };
  if (
    v.version !== 1 ||
    Object.keys(v).length !== 4 ||
    typeof v.vault !== "string" ||
    !Array.isArray(v.blocks) ||
    v.blocks.length > 100000
  )
    throw new Error("Die Buchbackup-Version wird nicht unterstützt.");
  const ids = new Set();
  for (const b of v.blocks) {
    if (
      !b ||
      Object.keys(b).length !== 3 ||
      !bookId(b.projectId) ||
      !blockId(b.id) ||
      typeof b.text !== "string" ||
      ids.has(b.projectId + "/" + b.id)
    )
      throw new Error("Das Buchbackup enthält ungültige oder doppelte Blöcke.");
    parseBookBlock(b.text, b.projectId, b.id);
    ids.add(b.projectId + "/" + b.id);
  }
  return { vault: v.vault, blocks: v.blocks, bundle: true };
}
