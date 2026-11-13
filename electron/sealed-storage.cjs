const fs = require('node:fs/promises');
const path = require('node:path');
const {atomicWrite} = require('./storage.cjs');
const {MAX_SEALED_BYTES:LIMIT,parseEnvelope} = require('../core/sealed-format.mjs');
function validateSealed(text){parseEnvelope(text);return text;}
class SealedStorage {
  constructor(directory){this.file=path.join(directory,'workspace.sealed');this.queue=Promise.resolve();this.initialized=false;}
  enqueue(job){const next=this.queue.then(job);this.queue=next.catch(()=>{});return next;}
  async current(){
    if(!this.initialized){
      const names=await fs.readdir(path.dirname(this.file)).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
      for(const name of names)if(/^workspace\.sealed\.\d+\.[a-f0-9]+\.tmp$/.test(name))await fs.rm(path.join(path.dirname(this.file),name),{force:true});
      this.initialized=true;
    }
    try{const stat=await fs.stat(this.file);if(stat.size>LIMIT)throw new Error('Die Datei ist zu groß.');return validateSealed(await fs.readFile(this.file,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}
  }
  read(){return this.enqueue(()=>this.current());}
  compareAndSwap(text,expected){validateSealed(text);if(expected!==null)validateSealed(expected);return this.enqueue(async()=>{const current=await this.current(),canonical=t=>t===null?null:JSON.stringify(parseEnvelope(t));if(canonical(current)!==canonical(expected))throw new Error('Der Tresor wurde zwischenzeitlich geändert. Entsperre ihn erneut, bevor du speicherst.');await atomicWrite(this.file,text);});}
  async write(text){validateSealed(text);return this.enqueue(()=>atomicWrite(this.file,text));}
}
module.exports={SealedStorage,validateSealed};
