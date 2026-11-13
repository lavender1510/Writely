import {BookRepository} from './book-repository';
import {validateBookReference} from './book-model';
import {parseVaultTransfer,MAX_BUNDLE_BYTES} from './book-bundle';
import type {BookReference,BookBlockStorage,BookMetadata} from './book-types';
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
export interface VaultData {format:'WritelyVault'; version:1|2|3;books?:BookReference[]; folders:VaultFolder[]; documents:VaultRecord[]; templates?:{id:string;name:string;document:DocumentFile;kind:string}[]}
export function validateVault(value: unknown): VaultData {
  const v = value as VaultData;
  if (!v || v.format !== 'WritelyVault' || ![1,2,3].includes(v.version) || !Array.isArray(v.folders) || !Array.isArray(v.documents) || v.folders.length > 1000 || v.documents.length > 1000)
    throw new Error('Der Tresor enthält keine unterstützte Bibliothek.');
  if(v.version===3&&Object.keys(v).some(k=>!['format','version','folders','documents','templates','books'].includes(k)))throw new Error('Der Tresor enthält unbekannte Projektfelder. Öffne ihn mit einer neueren Writely-Version.');
  if(v.books!==undefined){if(v.version!==3||!Array.isArray(v.books)||v.books.length>100)throw new Error('Die Buchprojektliste ist ungültig.');const books=new Set<string>();for(const r of v.books){validateBookReference(r);if(books.has(r.id))throw new Error('Ein Buchprojekt ist doppelt vorhanden.');books.add(r.id);}}
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
  private bookSessions=new Map<string,BookRepository>();private externalBookWork=0;
  constructor(private storage: SealedStorage,private blocks?:BookBlockStorage) {}
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
  private persist(text:string,expected:string|null){return this.storage.compareAndSwap?this.storage.compareAndSwap(text,expected):this.storage.write(text);}
  async create(password:string) {
    return this.exclusive(async () => {
      if (this.session || await this.storage.read()) throw new Error('Ein Tresor existiert bereits. Entsperre ihn zuerst.');
      const s = await createSealed({format:'WritelyVault',version:2,folders:[],documents:[]}, password);
      try {await this.persist(JSON.stringify(s.envelope),null); this.session = s; this.closing = false;}
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
      action(v);v.version=v.books?3:2; validateVault(v);
      const envelope = await updateSealed(s,v);
      await this.persist(JSON.stringify(envelope),JSON.stringify(s.envelope));
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
  async backup() {
    if(!this.unlocked)throw new Error('Entsperre den Tresor vor dem vollständigen Bibliotheksbackup.');
    return this.exclusive(async()=>{const data=this.session!.payload as VaultData,text=JSON.stringify(this.session!.envelope);if(!data.books?.length)return text;
      if(!this.blocks)throw new Error('Der Buchspeicher ist auf dieser Plattform nicht verfügbar.');
      const blocks:{projectId:string;id:string;text:string}[]=[];let bytes=text.length+1024;
      for(const ref of data.books){const cached=this.bookSessions.get(ref.id),repo=cached||await BookRepository.open(this.blocks,ref);try{const snapshot=await repo.snapshot();for(const b of snapshot.blocks){bytes+=b.text.length+256;if(bytes>MAX_BUNDLE_BYTES)throw new Error('Das vollständige Backup ist größer als 90 MB. Es wurde kein unvollständiges Backup erzeugt.');blocks.push({projectId:ref.id,...b});}}finally{if(!cached)await repo.close();}}
      const bundle=JSON.stringify({format:'WritelyVaultBundle',version:1,vault:text,blocks});if(bundle.length>MAX_BUNDLE_BYTES)throw new Error('Das vollständige Backup ist größer als 90 MB.');return bundle;
    });
  }
  async collectBookGarbage(){
    if(!this.unlocked)throw new Error('Der Tresor ist gesperrt.');if(!this.blocks?.projects||!this.blocks.removeProject||this.externalBookWork)return 0;
    const keep=new Set(((this.session!.payload as VaultData).books||[]).map(r=>r.id)),expected=JSON.stringify(this.session!.envelope),cutoff=Date.now()-86400000;
    // Do not hold decrypted content/keys in a root transaction during filesystem cleanup.
    // A fresh root fence and 24h age exclude newly staged/registered namespaces.
    const current=await this.storage.read();if(!this.unlocked||current===null||JSON.stringify(parseEnvelope(current))!==expected)return 0;
    let removed=0;for(const p of await this.blocks.projects()){if(!this.unlocked||this.externalBookWork)break;if(!keep.has(p.id)&&p.modifiedAt<cutoff&&removed<3){await this.blocks.removeProject(p.id);removed++;}}return removed;
  }
  createBook(title:string,metadata:Partial<BookMetadata>={},cover?:{src:string;alt:string}) {
    if(!this.unlocked||!this.blocks)return Promise.reject(new Error('Entsperre zuerst einen Tresor mit lokalem Buchspeicher.'));
    return this.exclusive(async()=>{if(((this.session!.payload as VaultData).books||[]).length>=100)throw new Error('Dieser Tresor unterstützt höchstens 100 Buchprojekte einschließlich Papierkorb.');const repo=await BookRepository.create(this.blocks!,title);try{if(Object.keys(metadata).length||cover)await repo.updateMetadata(metadata,cover);const s=this.session!,v=structuredClone(s.payload) as VaultData,ref=repo.reference();v.books??=[];v.books.push(ref);v.version=3;validateVault(v);const envelope=await updateSealed(s,v);await this.persist(JSON.stringify(envelope),JSON.stringify(s.envelope));s.envelope=envelope;s.payload=v;this.bookSessions.set(ref.id,repo);return ref.id;}catch(e){await repo.discard().catch(()=>{});throw e;}});
  }
  openBook(id:string){
    if(!this.unlocked||!this.blocks)return Promise.reject(new Error('Der Buchspeicher ist gesperrt oder nicht verfügbar.'));
    return this.exclusive(async()=>{const ref=(this.session!.payload as VaultData).books?.find(r=>r.id===id);if(!ref||ref.deletedAt)throw new Error('Das Buchprojekt fehlt oder liegt im Papierkorb.');let repo=this.bookSessions.get(id);if(!repo){repo=await BookRepository.open(this.blocks!,ref);this.bookSessions.set(id,repo);}return repo;});
  }
  closeBook(id:string){return this.exclusive(async()=>{const repo=this.bookSessions.get(id);if(repo){await repo.close();this.bookSessions.delete(id);}});}
  trashBook(id:string){return this.transaction(v=>{const ref=v.books?.find(r=>r.id===id);if(!ref)throw new Error('Das Buchprojekt fehlt.');ref.deletedAt=new Date().toISOString();}).then(()=>this.closeBook(id));}
  restoreBook(id:string){return this.transaction(v=>{const ref=v.books?.find(r=>r.id===id);if(!ref)throw new Error('Das Buchprojekt fehlt.');delete ref.deletedAt;});}
  renameBook(id:string,title:string,color?:string){return this.transaction(v=>{const ref=v.books?.find(r=>r.id===id);if(!ref)throw new Error('Das Buchprojekt fehlt.');ref.title=title;if(color!==undefined)ref.color=color;});}
  /** Import merges after full validation; never replaces an existing library. */
  async importBackup(text:string,password:string) {
    if(!this.unlocked)throw new Error('Entsperre den Tresor vor dem Import.');
    const transfer=parseVaultTransfer(text),source = await unlockSealed(transfer.vault,password),stagedBooks:BookRepository[]=[];let committed=false;this.externalBookWork++;
    try {
      const data = structuredClone(validateVault(source.payload));
      const sourceIds=new Set((data.books||[]).map(r=>r.id));if(transfer.blocks.some(b=>!sourceIds.has(b.projectId)))throw new Error('Das Backup enthält fremde Buchblöcke.');
      if(data.books?.length&&!this.blocks)throw new Error('Der lokale Buchspeicher fehlt. Das Backup wurde nicht teilweise importiert.');
      for(const reference of data.books||[]){const blocks=transfer.blocks.filter(b=>b.projectId===reference.id).map(({id,text})=>({id,text}));stagedBooks.push(await BookRepository.importArchive(this.blocks!,{reference,blocks}));}
      const folders = new Map(data.folders.map(f => [f.id,crypto.randomUUID()]));
      const batches=new Map(data.folders.filter(f=>f.trashBatch).map(f=>[f.trashBatch,crypto.randomUUID()]));
      await this.transaction(v => {
        if(stagedBooks.length){v.books??=[];stagedBooks.forEach((repo,i)=>v.books!.push({...repo.reference(),...(data.books![i].deletedAt?{deletedAt:data.books![i].deletedAt}:{})}));}
        for(const t of data.templates||[]){v.templates??=[];v.templates.push({...t,id:crypto.randomUUID()});}
        for (const f of data.folders) v.folders.push({...f,id:folders.get(f.id)!,parentId:f.parentId ? folders.get(f.parentId)! : null,trashBatch:f.trashBatch?batches.get(f.trashBatch):undefined});
        for (const r of data.documents) {
          const id = crypto.randomUUID();
          r.document.id = id;
          for (const h of r.history) h.document.id = id;
          v.documents.push({...r,folderId:r.folderId ? folders.get(r.folderId)! : null,folderTrashBatch:r.folderTrashBatch?batches.get(r.folderTrashBatch):undefined});
        }
      });
      committed=true;
    } finally {for(const repo of stagedBooks){if(committed)await repo.close();else await repo.discard().catch(()=>{});}forget(source);this.externalBookWork--;}
  }
  async rekey(oldPassword:string,newPassword:string) {
    if (!this.unlocked) throw new Error('Der Tresor ist gesperrt.');
    return this.exclusive(async () => {
      const s = this.session!;
      const text = await changePassword(JSON.stringify(s.envelope),oldPassword,newPassword);
      await this.persist(text,JSON.stringify(s.envelope)); s.envelope = parseEnvelope(text);
    });
  }
  async lock() {
    this.closing = true;
    await this.queue;
    for(const repo of this.bookSessions.values())await repo.close();this.bookSessions.clear();
    if (this.session) forget(this.session);
    this.session = null;
  }
}
