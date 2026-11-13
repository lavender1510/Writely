import { base64, unbase64 } from "./crypto";
import { parseBookBlock, MAX_BOOK_CLEAR } from "./book-block-format.mjs";
const encoder = new TextEncoder(),
  decoder = new TextDecoder("utf-8", { fatal: true });
const aad = (projectId: string, id: string) =>
  encoder.encode(JSON.stringify(["WritelyBookBlock", 1, projectId, id]));
const key = (raw: Uint8Array) => {
  if (raw.length !== 32) throw new Error("Der Projektschlüssel ist ungültig.");
  return crypto.subtle.importKey(
    "raw",
    raw as Uint8Array<ArrayBuffer>,
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
};
export async function sealBookBlock(
  raw: Uint8Array,
  projectId: string,
  id: string,
  payload: unknown,
) {
  const clear = encoder.encode(JSON.stringify(payload));
  if (clear.length > MAX_BOOK_CLEAR)
    throw new Error(
      "Dieser Buchabschnitt ist größer als 16 MB. Der letzte gespeicherte Stand bleibt erhalten.",
    );
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  try {
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: nonce,
        additionalData: aad(projectId, id),
        tagLength: 128,
      },
      await key(raw),
      clear,
    );
    const text = JSON.stringify({
      format: "WritelyBookBlock",
      version: 1,
      projectId,
      blockId: id,
      nonce: base64(nonce),
      ciphertext: base64(new Uint8Array(ciphertext)),
    });
    parseBookBlock(text, projectId, id);
    return text;
  } finally {
    clear.fill(0);
  }
}
export async function openBookBlock(
  raw: Uint8Array,
  projectId: string,
  id: string,
  text: string,
): Promise<unknown> {
  const e = parseBookBlock(text, projectId, id);
  let clear: Uint8Array | undefined;
  try {
    clear = new Uint8Array(
      await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: unbase64(e.nonce) as Uint8Array<ArrayBuffer>,
          additionalData: aad(projectId, id),
          tagLength: 128,
        },
        await key(raw),
        unbase64(e.ciphertext) as Uint8Array<ArrayBuffer>,
      ),
    );
    return JSON.parse(decoder.decode(clear));
  } catch {
    throw new Error(
      "Der Buchabschnitt konnte nicht authentifiziert werden. Er ist beschädigt oder gehört zu einem anderen Schlüssel.",
    );
  } finally {
    clear?.fill(0);
  }
}
export function newBookKey() {
  return crypto.getRandomValues(new Uint8Array(32));
}
