const fs = require('node:fs/promises');
const path = require('node:path');
const {atomicWrite} = require('./storage.cjs');
const {MAX_SEALED_BYTES:LIMIT,parseEnvelope} = require('../core/sealed-format.mjs');
function validateSealed(text){parseEnvelope(text);return text;}
class SealedStorage {
  constructor(directory){this.file=path.join(directory,'workspace.sealed');this.queue=Promise.resolve();this.initialized=false;}
  enqueue(job){const next=this.queue.then(job);this.queue=next.catch(()=>{});return next;}
  read(){return this.enqueue(async()=>{
    if(!this.initialized){
      const names=await fs.readdir(path.dirname(this.file)).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
      for(const name of names)if(/^workspace\.sealed\.\d+\.[a-f0-9]+\.tmp$/.test(name))await fs.rm(path.join(path.dirname(this.file),name),{force:true});
      this.initialized=true;
    }
    try{const stat=await fs.stat(this.file);if(stat.size>LIMIT)throw new Error('Die Datei ist zu groß.');return validateSealed(await fs.readFile(this.file,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}
  });}
  async write(text){validateSealed(text);return this.enqueue(()=>atomicWrite(this.file,text));}
}
module.exports={SealedStorage,validateSealed};
