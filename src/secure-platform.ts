import {Capacitor,registerPlugin} from '@capacitor/core';
import {parseEnvelope} from '../core/crypto';
import type {SealedStorage,PlatformFiles,TransferFile} from '../core/platform';
interface NativeFiles {
  readSealed():Promise<{text:string|null}>;
  writeSealed(options:{text:string}):Promise<void>;
  openFile():Promise<{cancelled?:boolean;name?:string;text?:string}>;
  saveFile(options:{name:string;text:string;mime:string}):Promise<{cancelled?:boolean}>;
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
    if(isAndroid){const r=await native.openFile();return r.cancelled?null:{name:r.name!,text:r.text!};}
    if(desktop()?.secureOpen)return desktop()!.secureOpen!();
    return new Promise<TransferFile|null>((resolve,reject)=>{
      const input=document.createElement('input');input.type='file';input.accept='.writely,.txt,.md,.html,.htm';
      input.oncancel=()=>resolve(null);
      input.onchange=async()=>{try{const f=input.files?.[0];if(!f)return resolve(null);if(f.size>90*1024*1024)throw new Error('Die Datei ist größer als 90 MB.');resolve({name:f.name,text:await f.text()});}catch(e){reject(e);}};
      input.click();
    });
  },
  async save(name,text,mime){
    if(isAndroid)return !(await native.saveFile({name,text,mime})).cancelled;
    if(desktop()?.secureSave)return desktop()!.secureSave!(name,text,mime);
    const url=URL.createObjectURL(new Blob([text],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return true;
  },
};
