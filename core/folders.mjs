/** Shared library invariants. Mutators run only against a repository's staged copy. */
export const FOLDER_ICONS = ['folder', 'book', 'briefcase', 'star'];
export function validateFolders(folders) {
  const byId = new Map();
  if (!Array.isArray(folders) || folders.length > 10000) throw new Error('Die Ordnerliste ist ungültig.');
  for (const f of folders) {
    if (!f || typeof f.id !== 'string' || !f.id || f.id.length > 128 || byId.has(f.id) ||
        typeof f.name !== 'string' || !f.name.trim() || f.name.length > 200 ||
        !(f.parentId == null || typeof f.parentId === 'string') ||
        f.color !== undefined && !/^#[0-9a-f]{6}$/i.test(f.color) ||
        f.icon !== undefined && !FOLDER_ICONS.includes(f.icon) ||
        f.pinned !== undefined && typeof f.pinned !== 'boolean' ||
        f.deletedAt !== undefined && !Number.isFinite(Date.parse(f.deletedAt)) ||
        f.trashBatch !== undefined && (typeof f.trashBatch !== 'string' || !f.trashBatch))
      throw new Error('Die Ordnerdaten sind ungültig.');
    byId.set(f.id,f);
  }
  for (const f of folders) {
    const seen = new Set([f.id]);let parent = f.parentId;
    while (parent) {
      if (seen.has(parent) || !byId.has(parent)) throw new Error('Ordner enthalten einen Kreis: Ein Ordner kann nicht in sich selbst oder einen fehlenden Ordner verschoben werden.');
      seen.add(parent);const ancestor=byId.get(parent);
      if (!f.deletedAt && ancestor.deletedAt) throw new Error('Ein aktiver Ordner liegt im Papierkorb.');
      parent=ancestor.parentId;
    }
  }
}
export function activeFolder(folders,id) {
  if (id == null) return null;
  if (typeof id !== 'string') throw new Error('Der Zielordner ist ungültig.');
  const f=folders.find(f=>f.id===id);
  if (!f || f.deletedAt) throw new Error('Der Zielordner fehlt oder liegt im Papierkorb.');
  return f;
}
export function folderTrail(folders,id) {
  const trail=[],seen=new Set();
  while (id) {if(seen.has(id))throw new Error('Die Ordnerstruktur enthält einen Kreis.');seen.add(id);const f=folders.find(f=>f.id===id);if(!f)break;trail.unshift(f);id=f.parentId;}
  return trail;
}
export function descendants(folders,id) {
  if (!folders.some(f=>f.id===id)) throw new Error('Ordner nicht gefunden.');
  const ids=new Set([id]);let size=-1;
  while(size!==ids.size){size=ids.size;for(const f of folders)if(ids.has(f.parentId))ids.add(f.id);}
  return ids;
}
export function saveFolder(folders,input,newId) {
  const old=input.id ? activeFolder(folders,input.id) : null;
  const f={...old,id:old?.id||newId,name:String(input.name??old?.name??'').trim(),parentId:input.parentId===undefined?(old?.parentId??null):input.parentId,
    color:input.color??old?.color??'#8a64bc',icon:input.icon??old?.icon??'folder',pinned:input.pinned??old?.pinned??false};
  activeFolder(folders,f.parentId);
  const staged=folders.filter(x=>x.id!==f.id).concat(f);validateFolders(staged);
  return staged;
}
export function trashFolderTree(data,id,batch,now=new Date().toISOString()) {
  activeFolder(data.folders,id);const ids=descendants(data.folders,id);
  for(const f of data.folders)if(ids.has(f.id)&&!f.deletedAt){f.deletedAt=now;f.trashBatch=batch;}
  for(const d of data.documents)if(ids.has(d.folderId)&&!d.deletedAt){d.deletedAt=now;d.folderTrashBatch=batch;}
}
export function restoreFolderTree(data,id) {
  const f=data.folders.find(f=>f.id===id);
  if(!f?.deletedAt||!f.trashBatch)throw new Error('Dieser Ordner liegt nicht im Papierkorb.');
  const batch=f.trashBatch;
  // A single deletion is restored together; older separately trashed content stays trashed.
  for(const item of data.folders)if(item.trashBatch===batch){delete item.deletedAt;delete item.trashBatch;}
  for(const d of data.documents)if(d.folderTrashBatch===batch){delete d.deletedAt;delete d.folderTrashBatch;}
  validateFolders(data.folders);
}
export function moveDocuments(data,ids,folderId) {
  activeFolder(data.folders,folderId);
  if(!Array.isArray(ids)||!ids.length||ids.length>10000||new Set(ids).size!==ids.length)throw new Error('Wähle gültige Dokumente aus.');
  const records=ids.map(id=>data.documents.find(d=>(d.document?.id??d.id)===id));
  if(records.some(d=>!d||d.deletedAt))throw new Error('Ein ausgewähltes Dokument fehlt oder liegt im Papierkorb.');
  for(const d of records)d.folderId=folderId;
}

export function validateFolderTrash(data) {
  const batches=new Set(data.folders.filter(f=>f.deletedAt&&f.trashBatch).map(f=>f.trashBatch));
  for(const f of data.folders)if(f.trashBatch&&!f.deletedAt)throw new Error('Die Papierkorbzuordnung eines Ordners ist ungültig.');
  for(const d of data.documents)if(d.folderTrashBatch!==undefined&&(!d.deletedAt||typeof d.folderTrashBatch!=='string'||!batches.has(d.folderTrashBatch)))throw new Error('Die Papierkorbzuordnung eines Dokuments ist ungültig.');
}
