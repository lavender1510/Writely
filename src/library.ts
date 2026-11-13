import {getApi} from './browser';
import {documentText,documentStats} from './document';
import type {DocumentFile} from './shared';
import {validateDocument} from '../core/validation.mjs';
import {validateFolders,validateFolderTrash,activeFolder,saveFolder,descendants,trashFolderTree,restoreFolderTree,moveDocuments} from '../core/folders.mjs';
const api=getApi(),key='writely.library.v2';
const read=()=>{const data=JSON.parse(localStorage.getItem(key)||'{"folders":[],"documents":[],"templates":[],"styleSets":[]}');if(data.version!==undefined&&![1,2,3].includes(data.version))throw new Error('Diese Bibliotheksversion wird nicht unterstützt.');validateFolders(data.folders);return data;};
const write=(data:any)=>{validateFolders(data.folders);validateFolderTrash(data);data.version=3;localStorage.setItem(key,JSON.stringify(data));};
export const library={
 async list(){return api.libraryList?api.libraryList():read();},
 async search(query:string){if(api.librarySearch)return api.librarySearch(query);const q=query.trim().toLocaleLowerCase('de');return read().documents.filter((d:any)=>!d.deletedAt&&(documentText(d.document.content).toLocaleLowerCase('de').includes(q)||d.title.toLocaleLowerCase('de').includes(q))).slice(0,100).map((d:any)=>{const text=documentText(d.document.content),pos=text.toLocaleLowerCase('de').indexOf(q);return {id:d.id,title:d.title,folderId:d.folderId,snippet:text.slice(Math.max(0,pos-65),Math.max(0,pos-65)+220)};});},
 async get(id:string){if(api.libraryGet)return api.libraryGet(id);const data=read(),d=data.documents.find((d:any)=>d.id===id&&!d.deletedAt);if(!d)throw new Error('Das Dokument wurde nicht gefunden.');activeFolder(data.folders,d.folderId);return {document:d.document,path:d.path};},
 async put(document:DocumentFile,path?:string,folderId?:string|null){
  if(api.libraryPut)return api.libraryPut(document,path,folderId);
  validateDocument(document);const data=read(),old=data.documents.find((d:any)=>d.id===document.id);
  if(old?.deletedAt)throw new Error('Das Dokument liegt im Papierkorb.');
  const target=folderId===undefined?(old?.folderId??null):folderId;activeFolder(data.folders,target);
  const record={...old,id:document.id,title:document.title,document,folderId:target,path:path||old?.path,updatedAt:document.updatedAt,createdAt:document.createdAt,lastOpenedAt:new Date().toISOString(),words:documentStats(document.content).words,size:JSON.stringify(document).length};
  data.documents=data.documents.filter((d:any)=>d.id!==document.id);data.documents.push(record);write(data);return record;
 },
 async mutate(action:string,input:any){
  if(api.libraryMutate)return api.libraryMutate(action,input);const data=read();
  if(action==='folder-save')data.folders=saveFolder(data.folders,input,crypto.randomUUID());
  else if(action==='folder-trash')trashFolderTree(data,input.id,crypto.randomUUID());
  else if(action==='folder-restore')restoreFolderTree(data,input.id);
  else if(action==='documents-move')moveDocuments(data,input.ids,input.folderId);
  else if(action==='folder-delete'){const ids=descendants(data.folders,input.id);data.folders=data.folders.filter((f:any)=>!ids.has(f.id));data.documents.forEach((d:any)=>{if(ids.has(d.folderId)){d.folderId=null;delete d.folderTrashBatch;}});}
  else if(action==='document-update'){
   const d=data.documents.find((d:any)=>d.id===input.id);if(!d||d.deletedAt)throw new Error('Das Dokument fehlt oder liegt im Papierkorb.');
   if(input.folderId!==undefined){activeFolder(data.folders,input.folderId);d.folderId=input.folderId;}
   if(typeof input.pinned==='boolean')d.pinned=input.pinned;
   if(Number.isFinite(input.order))d.order=input.order;
  }else if(action==='document-remove'){const d=data.documents.find((d:any)=>d.id===input.id);if(!d)throw new Error('Dokument nicht gefunden.');d.deletedAt=new Date().toISOString();}
  else if(action==='document-restore'){const d=data.documents.find((d:any)=>d.id===input.id);if(!d)throw new Error('Dokument nicht gefunden.');activeFolder(data.folders,d.folderId);delete d.deletedAt;delete d.folderTrashBatch;}
  else if(action==='document-purge'){const d=data.documents.find((d:any)=>d.id===input.id);if(d?.deletedAt&&window.confirm('Dieses Dokument endgültig aus der Browser-Bibliothek löschen?'))data.documents=data.documents.filter((d:any)=>d.id!==input.id);}
  else if(action==='template-save'||action==='styles-save'){validateDocument(input.document);data[action==='template-save'?'templates':'styleSets'].push({id:crypto.randomUUID(),name:input.name,document:input.document});}
  else throw new Error('Diese Bibliotheksaktion ist nicht verfügbar.');
  write(data);return data;
 }
};
