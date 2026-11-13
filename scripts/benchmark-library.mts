/** Synthetic fixtures only; no user documents. Measures repositories, not editing FPS. */
import {performance} from 'node:perf_hooks';
import {mkdtemp,rm,writeFile,mkdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {createRequire} from 'node:module';
import {Vault} from '../core/vault';import {createDocument} from '../core/document';
const require=createRequire(import.meta.url),{Library}=require('../electron/library.cjs'),{atomicWrite}=require('../electron/storage.cjs');
const root=await mkdtemp(join(tmpdir(),'writely-bench-'));
const timed=async<T>(task:()=>Promise<T>)=>{const t=performance.now();await task();return +(performance.now()-t).toFixed(2);};
const doc=(words:number)=>{const d=createDocument('blank');d.content={type:'doc',content:Array.from({length:Math.ceil(words/100)},(_,i)=>({type:'paragraph',content:[{type:'text',text:Array.from({length:Math.min(100,words-i*100)},(_,n)=>n===0?'Suchwort':'Schreiben').join(' ')}]}))};return d;};
try{
 const library=new Library(join(root,'library')),vault=new Vault({read:async()=>readFile(join(root,'vault'),'utf8').catch(()=>null),write:async s=>{await atomicWrite(join(root,'vault'),s);}});
 const result:any={source:'synthetische Repository-Fixtures; keine UI-/Android-Gerätemessung',node:process.version,platform:process.platform,measurementsMs:{},limits:['100 einzelne Dokumente simulieren den künftigen Buchbestand, kein implementierter Bücher-Modus.','Kein Nachweis für 100 Druckseiten, Eingabelatenz, Speicherverbrauch oder echte Android-Geräte.','Der Gesamttresor serialisiert weiterhin den gesamten Bestand; Chunk-Speicher ist vor großen Buchprojekten erforderlich.']};
 result.measurementsMs.vaultCreateWithKdf=await timed(()=>vault.create('Benchmark Kennwort für synthetische Daten'));
 for(const [name,repo] of [['native',library],['encrypted',vault]] as const){
  const small=doc(500),large=doc(100000);result.measurementsMs[name+'SmallSave']=await timed(()=>repo.put(small));result.measurementsMs[name+'100000WordsSave']=await timed(()=>repo.put(large));
  const items=Array.from({length:100},()=>doc(1000));result.measurementsMs[name+'100DocumentsCreate']=await timed(async()=>{for(const d of items)await repo.put(d);});
  result.measurementsMs[name+'Search']=await timed(async()=>{await repo.search('Suchwort');});
  result.measurementsMs[name+'SmallSaveAt102Documents']=await timed(()=>repo.put({...small,title:'Geändert'}));
 }
 result.measurementsMs.nativeIndexRestart=await timed(async()=>{await new Library(join(root,'library')).list();});
 await vault.lock();result.measurementsMs.encryptedUnlockWithKdf=await timed(()=>vault.unlock('Benchmark Kennwort für synthetische Daten'));await vault.lock();
 result.processMaxRssKiB=process.resourceUsage().maxRSS;
 await mkdir('work/books',{recursive:true});await writeFile('work/books/benchmark.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await rm(root,{recursive:true,force:true});}
