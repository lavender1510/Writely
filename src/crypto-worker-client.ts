import {configureKeyDerivation} from '../core/crypto';
let worker:Worker|undefined;
let sequence=0;
const pending=new Map<number,{resolve:(value:Uint8Array)=>void;reject:(reason:Error)=>void}>();
export function enableCryptoWorker() {
  configureKeyDerivation((password,salt)=>new Promise((resolve,reject)=>{
    if(!worker){
      worker=new Worker(new URL('./crypto-kdf-worker.ts',import.meta.url),{type:'module'});
      worker.onmessage=e=>{const job=pending.get(e.data.id);pending.delete(e.data.id);if(e.data.error)job?.reject(new Error(e.data.error));else job?.resolve(e.data.result);};
      worker.onerror=()=>{for(const job of pending.values())job.reject(new Error('Die lokale Schlüsselableitung wurde unterbrochen.'));pending.clear();worker?.terminate();worker=undefined;};
    }
    const id=++sequence;pending.set(id,{resolve,reject});worker.postMessage({id,password,salt});
  }));
}
export function stopCryptoWorker(){worker?.terminate();worker=undefined;for(const job of pending.values())job.reject(new Error('Der Tresor wurde gesperrt.'));pending.clear();}
