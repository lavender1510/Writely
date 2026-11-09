import {unbase64} from '../core/crypto';
import {recover,attach} from '../core/zip-roundtrip.mjs';
import {validateDocument} from '../core/validation.mjs';
import type {DocumentFile} from '../core/types';
import {importPortable} from './secure-import';
export async function importOffice(name:string,value:string):Promise<DocumentFile>{
  const bytes=unbase64(value),original=await recover(bytes);
  if(original)return structuredClone(original);
  if(/\.odt$/i.test(name))throw new Error('Dieses ODT enthält keine unveränderten Writely-Daten. Der mobile semantische ODF-Importer ist noch nicht verfügbar; öffne diese Datei in Writely Windows.');
  const module=await import('mammoth/mammoth.browser');
  const mammoth=(module.default||module) as unknown as typeof import('mammoth');
  const result=await mammoth.convertToHtml({arrayBuffer:bytes.buffer as ArrayBuffer},{convertImage:mammoth.images.imgElement(async(image:any)=>({src:`data:${image.contentType};base64,${await image.read('base64')}`}))});
  const doc=importPortable(name+'.html',result.value);doc.title=name.replace(/\.docx$/i,'');doc.importWarnings=['Externer DOCX-Import übernimmt Text, Tabellen und eingebettete Bilder. Abschnittslayouts, Kommentare, Felder und komplexe Styles können abweichen.',...result.messages.map((m:any)=>m.message)];return validateDocument(doc);
}
export async function exportOffice(doc:DocumentFile,format:'docx'|'odt'){
  validateDocument(doc);
  if(format==='docx')return (await import('../core/office-export.mjs')).exportDocx(doc) as Promise<Uint8Array>;
  return attach(await (await import('../core/odt-export.mjs')).exportOdt(doc),doc) as Promise<Uint8Array>;
}
