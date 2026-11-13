import {Capacitor,registerPlugin} from '@capacitor/core';
import {base64,parseEnvelope} from '../core/crypto';
import type {SealedStorage,PlatformFiles,TransferFile} from '../core/platform';
interface NativeFiles {
  commitSealed(options:{text:string;expected:string|null}):Promise<void>;
  readSealed():Promise<{text:string|null}>;
  writeSealed(options:{text:string}):Promise<void>;
  openFile():Promise<{cancelled?:boolean;name?:string;text?:string;base64?:string}>;
  saveFile(options:{name:string;text:string;mime:string;base64?:boolean}):Promise<{cancelled?:boolean}>;
}
const native = registerPlugin<NativeFiles>('WritelyFiles');
export const isAndroid=Capacitor.getPlatform()==='android';
const desktop = () => window.writely;
const KEY='writely.sealed.workspace.v1';
export const sealedStorage:SealedStorage = {
  async read(){
    if(isAndroid)return (await native.readSealed()).text;
    if(desktop()?.sealedRead)return desktop()!.sealedRead!();
    return localStorage.getItem(KEY);
  },
  async compareAndSwap(text,expected){
    parseEnvelope(text);if(expected!==null)parseEnvelope(expected);
    if(isAndroid){await native.commitSealed({text,expected});return;}
    if(desktop()?.sealedCommit){await desktop()!.sealedCommit!(text,expected);return;}
    if(desktop()?.sealedWrite)throw new Error('Aktualisiere die vollständige Desktop-App. Dieser Speicheradapter unterstützt keine geprüften Versionswechsel.');
    if(!navigator.locks)throw new Error('Dieser Browser unterstützt keine sichere parallele Tresorspeicherung. Nutze die Desktop- oder Android-App.');
    await navigator.locks.request('writely.sealed.workspace.v1',()=>{const current=localStorage.getItem(KEY),canonical=(t:string|null)=>t===null?null:JSON.stringify(parseEnvelope(t));if(canonical(current)!==canonical(expected))throw new Error('Der Tresor wurde zwischenzeitlich geändert. Entsperre ihn erneut.');localStorage.setItem(KEY,text);});
  },
  async write(text){
    parseEnvelope(text);
    if(isAndroid){await native.writeSealed({text});return;}
    if(desktop()?.sealedWrite){await desktop()!.sealedWrite!(text);return;}
    // Browser test/demo adapter stores ciphertext exclusively; no document cache.
    localStorage.setItem(KEY,text);
  },
};
export const secureFiles:PlatformFiles = {
  async open(){
    if(isAndroid){const r=await native.openFile();return r.cancelled?null:{name:r.name!,text:r.text||'',base64:r.base64};}
    if(desktop()?.secureOpen)return desktop()!.secureOpen!();
    return new Promise<TransferFile|null>((resolve,reject)=>{
      const input=document.createElement('input');input.type='file';input.accept='.writely,.txt,.md,.html,.htm,.docx,.odt';
      input.oncancel=()=>resolve(null);
      input.onchange=async()=>{try{const f=input.files?.[0];if(!f)return resolve(null);if(f.size>90*1024*1024)throw new Error('Die Datei ist größer als 90 MB.');resolve(/\.(docx|odt)$/i.test(f.name)?{name:f.name,text:'',base64:base64(new Uint8Array(await f.arrayBuffer()))}:{name:f.name,text:await f.text()});}catch(e){reject(e);}};
      input.click();
    });
  },
  async save(name,text,mime){
    if(isAndroid)return !(await native.saveFile({name,text,mime})).cancelled;
    if(desktop()?.secureSave)return desktop()!.secureSave!(name,text,mime);
    const url=URL.createObjectURL(new Blob([text],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return true;
  },
};

export async function saveBinary(name:string,bytes:Uint8Array,mime:string){if(isAndroid)return !(await native.saveFile({name,text:base64(bytes),mime,base64:true})).cancelled;const url=URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return true;}
