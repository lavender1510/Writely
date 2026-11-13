import {validateFolders,validateFolderTrash,activeFolder,saveFolder as stageFolder,trashFolderTree,restoreFolderTree,moveDocuments} from './folders.mjs';
import {createSealed, unlockSealed, updateSealed, forget, changePassword, parseEnvelope, type Unlocked} from './crypto';
import {validateDocument} from './validation.mjs';
import {migrateDocument} from './document-schema.mjs';
import {documentText} from './document';
import type {DocumentFile} from './types';
import type {SealedStorage} from './platform';

export interface VaultFolder {id:string; name:string; parentId:string|null;color?:string;icon?:string;pinned?:boolean;deletedAt?:string;trashBatch?:string}
export interface VaultRecord {
  document:DocumentFile; folderId:string|null; pinned:boolean; deletedAt?:string;folderTrashBatch?:string;
  history:{capturedAt:string; document:DocumentFile}[];
}
export interface VaultData {format:'WritelyVault'; version:1|2; folders:VaultFolder[]; documents:VaultRecord[]; templates?:{id:string;name:string;document:DocumentFile;kind:string}[]}
export function validateVault(value: unknown): VaultData {
  const v = value as VaultData;
  if (!v || v.format !== 'WritelyVault' || ![1,2].includes(v.version) || !Array.isArray(v.folders) || !Array.isArray(v.documents) || v.folders.length > 1000 || v.documents.length > 1000)
    throw new Error('Der Tresor enthält keine unterstützte Bibliothek.');
  if(v.templates!==undefined){if(!Array.isArray(v.templates)||v.templates.length>200)throw new Error('Die Vorlagenliste ist ungültig.');for(const t of v.templates){if(!t||typeof t.id!=='string'||typeof t.name!=='string'||!t.name.trim()||t.name.length>200||!['template-save','styles-save'].includes(t.kind))throw new Error('Eine Vorlage ist ungültig.');validateDocument(t.document);}}
  validateFolders(v.folders);validateFolderTrash(v);
  const ids = new Set<string>();
  for (const f of v.folders) {
    if (!f || typeof f.id !== 'string' || !f.id || ids.has(f.id) || typeof f.name !== 'string' || !f.name.trim() || f.name.length > 200 || !(f.parentId === null || typeof f.parentId === 'string')) throw new Error('Die Tresor-Ordner sind ungültig.');
    ids.add(f.id);
  }
  for (const f of v.folders) {
    const seen = new Set([f.id]); let id = f.parentId;
    while (id !== null) {
      if (seen.has(id) || !ids.has(id)) throw new Error('Die Tresor-Ordner enthalten einen Kreis oder fehlen.');
      seen.add(id); id = v.folders.find(folder => folder.id === id)!.parentId;
    }
  }
  const docs = new Set<string>();
  for (const r of v.documents) {
    if (!r || (r.folderId !== null && !ids.has(r.folderId)) || typeof r.pinned !== 'boolean' || !Array.isArray(r.history) || r.history.length > 10 ||
      (r.deletedAt !== undefined && !Number.isFinite(Date.parse(r.deletedAt)))) throw new Error('Ein Tresor-Dokument ist ungültig.');
    if(!r.deletedAt)activeFolder(v.folders,r.folderId);
    validateDocument(r.document);
    if (docs.has(r.document.id)) throw new Error('Ein Tresor-Dokument ist doppelt vorhanden.');
    docs.add(r.document.id);
    for (const h of r.history) {
      validateDocument(h.document);
      if (h.document.id !== r.document.id || !Number.isFinite(Date.parse(h.capturedAt))) throw new Error('Eine Tresor-Version ist ungültig.');
    }
  }
  return v;
}

/** One atomic encrypted transaction covers content, metadata, trash and history.
 * No calls into the legacy plaintext library/LocalStore are permitted here. */
export class Vault {
  private session: Unlocked | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private closing = false;
  constructor(private storage: SealedStorage) {}
  get unlocked() {return !!this.session && !this.closing;}
  data(): VaultData {
    if (!this.unlocked) throw new Error('Der Tresor ist gesperrt.');
    return structuredClone(this.session!.payload as VaultData);
  }
  private exclusive<T>(job: () => Promise<T>): Promise<T> {
    const pending = this.queue.then(job);
    this.queue = pending.catch(() => {});
    return pending;
  }
  async create(password:string) {
    return this.exclusive(async () => {
      if (this.session || await this.storage.read()) throw new Error('Ein Tresor existiert bereits. Entsperre ihn zuerst.');
      const s = await createSealed({format:'WritelyVault',version:2,folders:[],documents:[]}, password);
      try {await this.storage.write(JSON.stringify(s.envelope)); this.session = s; this.closing = false;}
      catch (error) {forget(s); throw error;}
    });
  }
  async unlock(password:string) {
    return this.exclusive(async () => {
      if (this.session) throw new Error('Der Tresor ist bereits geöffnet.');
      const text = await this.storage.read();
      if (!text) throw new Error('Es wurde noch kein Tresor erstellt.');
      const s = await unlockSealed(text,password);
      try {validateVault(s.payload); this.session = s; this.closing = false;}
      catch (e) {forget(s); throw e;}
    });
  }
  private transaction(action:(v:VaultData)=>void) {
    if (!this.unlocked) return Promise.reject(new Error('Der Tresor ist gesperrt.'));
    return this.exclusive(async () => {
      const s = this.session!;
      const v = structuredClone(s.payload) as VaultData;
      action(v);v.version=2; validateVault(v);
      const envelope = await updateSealed(s,v);
      await this.storage.write(JSON.stringify(envelope));
      s.envelope = envelope; s.payload = v;
    });
  }
  put(document:DocumentFile, folderId?:string|null) {
    validateDocument(document);
    const doc = structuredClone(validateDocument(migrateDocument(document))) as DocumentFile;
    return this.transaction(v => {
      const existing = v.documents.find(r => r.document.id === doc.id);
      const target=folderId===undefined?(existing?.folderId??null):folderId;activeFolder(v.folders,target);
      if (!existing) {v.documents.push({document:doc,folderId:target,pinned:false,history:[]}); return;}
      if (existing.deletedAt) throw new Error('Stelle das Dokument zuerst aus dem Papierkorb wieder her.');
      if (JSON.stringify(existing.document) !== JSON.stringify(doc)) {
        const now = new Date().toISOString();
        if (!existing.history.length || Date.now() - Date.parse(existing.history[0].capturedAt) >= 60000)
          existing.history.unshift({capturedAt:now,document:existing.document});
        existing.history = existing.history.slice(0,5);
      }
      existing.document = doc; existing.folderId = target;
    });
  }
  folder(name:string,parentId:string|null = null) {return this.saveFolder({name,parentId});}
  saveFolder(input:Partial<VaultFolder>&{name:string}) {
    const id=input.id||crypto.randomUUID();
    return this.transaction(v=>{v.folders=stageFolder(v.folders,input,id);}).then(()=>id);
  }
  trashFolder(id:string){return this.transaction(v=>trashFolderTree(v,id,crypto.randomUUID()));}
  restoreFolder(id:string){return this.transaction(v=>restoreFolderTree(v,id));}
  moveMany(ids:string[],folderId:string|null){return this.transaction(v=>moveDocuments(v,ids,folderId));}
  saveTemplate(kind:string,name:string,document:DocumentFile){return this.transaction(v=>{v.templates??=[];v.templates.push({id:crypto.randomUUID(),kind,name,document:kind==='styles-save'?{...structuredClone(document),content:{type:'doc',content:[{type:'paragraph'}]}}:structuredClone(document)});});}
  renameFolder(id:string,name:string){return this.transaction(v=>{v.folders=stageFolder(v.folders,{id,name},id);});}
  moveFolder(id:string,parentId:string|null){return this.transaction(v=>{v.folders=stageFolder(v.folders,{id,parentId},id);});}
  duplicate(id:string){return this.transaction(v=>{const r=structuredClone(this.record(v,id));r.document.id=crypto.randomUUID();r.document.title=(r.document.title+' – Kopie').slice(0,500);r.document.createdAt=r.document.updatedAt=new Date().toISOString();r.history=[];r.pinned=false;delete r.deletedAt;v.documents.push(r);});}
  move(id:string,folderId:string|null) {return this.moveMany([id],folderId);}
  pin(id:string) {return this.transaction(v => {const r = this.record(v,id); r.pinned = !r.pinned;});}
  trash(id:string) {return this.transaction(v => {this.record(v,id).deletedAt = new Date().toISOString();});}
  restore(id:string) {return this.transaction(v => {const r=this.record(v,id);activeFolder(v.folders,r.folderId);delete r.deletedAt;delete r.folderTrashBatch;});}
  purge(id:string,confirmed:boolean) {return this.transaction(v => {
    if (!confirmed || !this.record(v,id).deletedAt) throw new Error('Das endgültige Löschen muss ausdrücklich bestätigt werden.');
    v.documents = v.documents.filter(r => r.document.id !== id);
  });}
  restoreVersion(id:string,index:number) {return this.transaction(v => {
    const r = this.record(v,id), old = r.history[index];
    if (!old) throw new Error('Diese Version ist nicht vorhanden.');
    r.history = [{capturedAt:new Date().toISOString(),document:r.document}, ...r.history].slice(0,5);
    r.document = {...old.document,updatedAt:new Date().toISOString()};
  });}
  private record(v:VaultData,id:string) {
    const r = v.documents.find(r => r.document.id === id);
    if (!r) throw new Error('Das Tresor-Dokument wurde nicht gefunden.');
    return r;
  }
  search(query:string) {
    const q = query.trim().toLocaleLowerCase('de');
    if (!q) return [];
    return this.data().documents.filter(r => !r.deletedAt && `${r.document.title}\n${documentText(r.document.content)}`.toLocaleLowerCase('de').includes(q));
  }
  async backup() {await this.queue; const text = await this.storage.read(); if (!text) throw new Error('Kein Tresor vorhanden.'); return text;}
  /** Import merges after full validation; never replaces an existing library. */
  async importBackup(text:string,password:string) {
    const source = await unlockSealed(text,password);
    try {
      const data = structuredClone(validateVault(source.payload));
      const folders = new Map(data.folders.map(f => [f.id,crypto.randomUUID()]));
      const batches=new Map(data.folders.filter(f=>f.trashBatch).map(f=>[f.trashBatch,crypto.randomUUID()]));
      await this.transaction(v => {
        for(const t of data.templates||[]){v.templates??=[];v.templates.push({...t,id:crypto.randomUUID()});}
        for (const f of data.folders) v.folders.push({...f,id:folders.get(f.id)!,parentId:f.parentId ? folders.get(f.parentId)! : null,trashBatch:f.trashBatch?batches.get(f.trashBatch):undefined});
        for (const r of data.documents) {
          const id = crypto.randomUUID();
          r.document.id = id;
          for (const h of r.history) h.document.id = id;
          v.documents.push({...r,folderId:r.folderId ? folders.get(r.folderId)! : null,folderTrashBatch:r.folderTrashBatch?batches.get(r.folderTrashBatch):undefined});
        }
      });
    } finally {forget(source);}
  }
  async rekey(oldPassword:string,newPassword:string) {
    if (!this.unlocked) throw new Error('Der Tresor ist gesperrt.');
    return this.exclusive(async () => {
      const s = this.session!;
      const text = await changePassword(JSON.stringify(s.envelope),oldPassword,newPassword);
      await this.storage.write(text); s.envelope = parseEnvelope(text);
    });
  }
  async lock() {
    this.closing = true;
    await this.queue;
    if (this.session) forget(this.session);
    this.session = null;
  }
}
