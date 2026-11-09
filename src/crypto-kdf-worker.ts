import {deriveArgon2} from '../core/crypto';
self.onmessage = async (event: MessageEvent<{id:number;password:string;salt:Uint8Array}>) => {
  const {id,password,salt} = event.data;
  try {const result = await deriveArgon2(password,salt); self.postMessage({id,result}, {transfer:[result.buffer as ArrayBuffer]});}
  catch {self.postMessage({id,error:'Die lokale Schlüsselableitung ist fehlgeschlagen.'});}
};
