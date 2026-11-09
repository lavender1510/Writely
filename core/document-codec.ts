import {MAX_FILE_BYTES,validateDocument} from './validation.mjs';
import {migrateDocument} from './document-schema.mjs';
import type {DocumentFile} from './types';
export function decodeDocument(text:string):DocumentFile {
  if(typeof text!=='string'||text.length>MAX_FILE_BYTES||new TextEncoder().encode(text).byteLength>MAX_FILE_BYTES)throw new Error('Die Writely-Datei ist größer als 64 MB.');
  let value:unknown;try{value=JSON.parse(text);}catch{throw new Error('Die Writely-Datei enthält kein lesbares JSON.');}
  validateDocument(value);
  return validateDocument(migrateDocument(value));
}
export function encodeDocument(document:DocumentFile):string {validateDocument(document);return JSON.stringify(document);}
