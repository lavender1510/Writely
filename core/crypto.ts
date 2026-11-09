import {argon2id} from 'hash-wasm';

import {MAX_CLEAR_BYTES,SealedError,KDF,parseEnvelope as parseStructure} from './sealed-format.mjs';
export {MAX_CLEAR_BYTES,MAX_SEALED_BYTES,KDF,SealedError} from './sealed-format.mjs';
const utf8 = new TextEncoder();
const decode = new TextDecoder('utf-8', {fatal: true});
export interface Envelope {
  format: 'WritelySealed'; version: 1; id: string;
  kdf: typeof KDF; salt: string; wrapNonce: string; wrappedKey: string;
  nonce: string; ciphertext: string;
}
export function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(binary);
}
export function unbase64(value: string): Uint8Array {
  if (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new SealedError('Die verschlüsselte Datei hat ein ungültiges Format.');
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}
function random(size: number) {return crypto.getRandomValues(new Uint8Array(size));}
type Deriver = (password: string, salt: Uint8Array) => Promise<Uint8Array>;
export const deriveArgon2: Deriver = async (password, salt) => argon2id({
  password: utf8.encode(password), salt, parallelism: KDF.parallelism,
  iterations: KDF.iterations, memorySize: KDF.memoryKiB, hashLength: 32, outputType: 'binary',
});
let derive: Deriver = deriveArgon2;
/** Renderer installs a dedicated worker; Node uses the same implementation. */
export function configureKeyDerivation(worker: Deriver) {derive = worker;}
function passwordOK(password: string, creating = false) {
  if (typeof password !== 'string' || utf8.encode(password).length > 1024 || password.length < (creating ? 12 : 1))
    throw new SealedError('Das Kennwort muss mindestens 12 Zeichen und höchstens 1024 UTF-8-Bytes enthalten.');
}
function aad(id: string, slot: 'content' | 'key', salt?: string) {
  return utf8.encode(JSON.stringify(['WritelySealed', 1, id, slot, ...(slot === 'key' ? [KDF, salt] : [])]));
}
async function key(bytes: Uint8Array) {
  return crypto.subtle.importKey('raw', bytes as Uint8Array<ArrayBuffer>, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function encrypt(bytes: Uint8Array, secret: CryptoKey, nonce: Uint8Array, additionalData: Uint8Array) {
  return new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM', iv: nonce as Uint8Array<ArrayBuffer>, additionalData: additionalData as Uint8Array<ArrayBuffer>, tagLength:128}, secret, bytes as Uint8Array<ArrayBuffer>));
}
async function decrypt(bytes: Uint8Array, secret: CryptoKey, nonce: Uint8Array, additionalData: Uint8Array) {
  return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM', iv: nonce as Uint8Array<ArrayBuffer>, additionalData: additionalData as Uint8Array<ArrayBuffer>, tagLength:128}, secret, bytes as Uint8Array<ArrayBuffer>));
}
export function parseEnvelope(text:string):Envelope {return parseStructure(text) as Envelope;}
async function wrap(raw: Uint8Array, id: string, password: string) {
  passwordOK(password, true);
  const salt = random(32), nonce = random(12), material = await derive(password, salt);
  try {
    return {kdf: KDF, salt: base64(salt), wrapNonce: base64(nonce),
      wrappedKey: base64(await encrypt(raw, await key(material), nonce, aad(id, 'key', base64(salt))))};
  } finally {material.fill(0);}
}
export interface Unlocked {envelope: Envelope; key: Uint8Array; payload: unknown}
export async function createSealed(payload: unknown, password: string): Promise<Unlocked> {
  passwordOK(password, true);
  const id = crypto.randomUUID(), raw = random(32);
  try {
    const header = await wrap(raw, id, password);
    const session: Unlocked = {key: raw, envelope: {format:'WritelySealed', version:1, id, ...header, nonce:'', ciphertext:''}, payload};
    session.envelope = await updateSealed(session, payload);
    return session;
  } catch (error) {raw.fill(0); throw error;}
}
export async function unlockSealed(text: string, password: string): Promise<Unlocked> {
  const e = parseEnvelope(text);
  passwordOK(password);
  const material = await derive(password, unbase64(e.salt));
  let raw: Uint8Array | undefined;
  try {
    raw = await decrypt(unbase64(e.wrappedKey), await key(material), unbase64(e.wrapNonce), aad(e.id,'key',e.salt));
    const clear = await decrypt(unbase64(e.ciphertext), await key(raw), unbase64(e.nonce), aad(e.id,'content'));
    try {return {key:raw, envelope:e, payload:JSON.parse(decode.decode(clear))};} finally {clear.fill(0);}
  } catch {raw?.fill(0); throw new SealedError();} finally {material.fill(0);}
}
export async function updateSealed(session: Unlocked, payload: unknown): Promise<Envelope> {
  const bytes = utf8.encode(JSON.stringify(payload));
  if (bytes.length > MAX_CLEAR_BYTES) {bytes.fill(0); throw new SealedError('Der Tresor ist größer als 64 MB. Exportiere ein Backup und reduziere Bilder oder Versionen.');}
  const nonce = random(12);
  try {return {...session.envelope, nonce:base64(nonce), ciphertext:base64(await encrypt(bytes, await key(session.key), nonce, aad(session.envelope.id,'content')))};}
  finally {bytes.fill(0);}
}
export async function changePassword(text: string, oldPassword: string, newPassword: string): Promise<string> {
  const unlocked = await unlockSealed(text, oldPassword);
  try {return JSON.stringify({...unlocked.envelope, ...await wrap(unlocked.key, unlocked.envelope.id, newPassword)});}
  finally {unlocked.key.fill(0); unlocked.payload = null;}
}
export function forget(session: Unlocked) {session.key.fill(0); session.payload = null;}
