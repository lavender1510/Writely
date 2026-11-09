/** Structural validation only. Authenticity requires AES-GCM verification. */
export const MAX_CLEAR_BYTES = 64 * 1024 * 1024;
export const MAX_SEALED_BYTES = 90 * 1024 * 1024;
export const KDF = Object.freeze({name:'argon2id',version:19,memoryKiB:65536,iterations:3,parallelism:1});
export class SealedError extends Error {
  constructor(message='Entsperren fehlgeschlagen. Das Kennwort ist falsch oder die Datei ist beschädigt.'){super(message);}
}
export function parseEnvelope(text) {
  if(typeof text!=='string'||text.length>MAX_SEALED_BYTES)throw new SealedError('Die verschlüsselte Datei ist zu groß.');
  let e;try{e=JSON.parse(text);}catch{throw new SealedError('Die verschlüsselte Datei enthält kein gültiges JSON.');}
  const fields=['format','version','id','kdf','salt','wrapNonce','wrappedKey','nonce','ciphertext'];
  if(!e||Object.keys(e).length!==fields.length||fields.some(k=>!Object.hasOwn(e,k))||e.format!=='WritelySealed'||e.version!==1||typeof e.id!=='string'||!/^[\da-f-]{36}$/.test(e.id)||!e.kdf||Object.keys(e.kdf).length!==Object.keys(KDF).length||Object.entries(KDF).some(([k,v])=>e.kdf[k]!==v))throw new SealedError('Die verschlüsselte Dateiversion oder Schlüsselableitung wird nicht unterstützt.');
  for(const [field,size] of [['salt',32],['wrapNonce',12],['wrappedKey',48],['nonce',12]]){
    const v=e[field];
    if(typeof v!=='string'||v.length!==Math.ceil(size/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(v)||Uint8Array.from(atob(v)).length!==size)throw new SealedError('Der Schlüsselumschlag ist beschädigt.');
  }
  if(typeof e.ciphertext!=='string'||e.ciphertext.length<24||e.ciphertext.length%4!==0||e.ciphertext.length>Math.ceil((MAX_CLEAR_BYTES+16)/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(e.ciphertext))throw new SealedError('Der verschlüsselte Inhalt ist ungültig.');
  return e;
}
