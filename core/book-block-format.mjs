/** Storage adapters validate ciphertext structure only. AEAD authentication happens in core. */
export const MAX_BOOK_CLEAR = 16 * 1024 * 1024;
export const MAX_BOOK_BLOCK = 24 * 1024 * 1024;
export function bookId(value) {
  return (
    typeof value === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value)
  );
}
export function blockId(value) {
  return value === "manifest" || bookId(value);
}
export function parseBookBlock(text, projectId, id) {
  if (
    !bookId(projectId) ||
    !blockId(id) ||
    typeof text !== "string" ||
    text.length > MAX_BOOK_BLOCK
  )
    throw new Error("Der Buchblock ist ungültig oder zu groß.");
  let e;
  try {
    e = JSON.parse(text);
  } catch {
    throw new Error("Der Buchblock enthält kein gültiges JSON.");
  }
  const fields = [
    "format",
    "version",
    "projectId",
    "blockId",
    "nonce",
    "ciphertext",
  ];
  if (
    !e ||
    Object.keys(e).length !== 6 ||
    fields.some((k) => !Object.hasOwn(e, k)) ||
    e.format !== "WritelyBookBlock" ||
    e.version !== 1 ||
    e.projectId !== projectId ||
    e.blockId !== id ||
    typeof e.nonce !== "string" ||
    !/^[A-Za-z0-9+/]{16}$/.test(e.nonce) ||
    typeof e.ciphertext !== "string" ||
    e.ciphertext.length < 24 ||
    e.ciphertext.length % 4 !== 0 ||
    e.ciphertext.length > Math.ceil((MAX_BOOK_CLEAR + 16) / 3) * 4 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(e.ciphertext)
  )
    throw new Error(
      "Der Buchblock ist beschädigt oder gehört zu einem anderen Projekt.",
    );
  return e;
}
