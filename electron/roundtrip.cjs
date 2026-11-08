const JSZip=require('jszip');
const {createHash}=require('node:crypto');
const META='META-INF/writely-document.json';
async function openZip(buffer){const zip=await JSZip.loadAsync(buffer);const files=Object.values(zip.files);if(files.length>5000||files.reduce((sum,f)=>sum+(f._data?.uncompressedSize||0),0)>128*1024*1024)throw new Error('Die Datei enthält zu viele oder zu große Paketbestandteile.');return zip;}
async function digest(zip){const hash=createHash('sha256');for(const name of Object.keys(zip.files).sort()){const entry=zip.files[name];if(name===META||entry.dir)continue;hash.update(name);hash.update(await entry.async('nodebuffer'));}return hash.digest('hex');}
async function attach(buffer,document){const zip=await openZip(buffer);if(zip.file('mimetype'))zip.file('mimetype',await zip.file('mimetype').async('string'),{compression:'STORE'});
 if(zip.file('META-INF/manifest.xml')){const f=zip.file('META-INF/manifest.xml');zip.file('META-INF/manifest.xml',(await f.async('string')).replace('</manifest:manifest>','<manifest:file-entry manifest:full-path="'+META+'" manifest:media-type="application/json"/></manifest:manifest>'));}
 if(zip.file('[Content_Types].xml'))zip.file('[Content_Types].xml',(await zip.file('[Content_Types].xml').async('string')).replace('</Types>','<Override PartName="/'+META+'" ContentType="application/json"/></Types>'));
 const fingerprint=await digest(zip);zip.file(META,JSON.stringify({application:'Writely',revision:1,fingerprint,document}));return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});}
async function recover(buffer){try{const zip=await openZip(buffer);const file=zip.file(META);if(!file)return null;const value=JSON.parse(await file.async('string'));if(value.application!=='Writely'||value.revision!==1||value.fingerprint!==await digest(zip))return null;return require('./storage.cjs').validateDocument(value.document);}catch{return null;}}
module.exports={attach,recover,openZip};
