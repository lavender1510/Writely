import {useNativeBack} from './useNativeBack';
import {bookStorage} from './book-storage';
import {TargetFolder,Breadcrumbs,FolderCards,FolderDialog,BulkMove,draggedDocuments,type FolderInfo} from './FolderControls';
import {folderTrail} from '../core/folders.mjs';
import {notesHTML} from '../core/document-schema.mjs';
import {exportOffice,importOffice} from './portable-office';
import {generateHTML} from '@tiptap/core';
import {editorExtensions} from './editor-extensions';
import {useCallback,useEffect,useRef,useState,lazy,Suspense} from 'react';
import {App as NativeApp} from '@capacitor/app';
import {LockKeyhole,LockKeyholeOpen,Plus,FolderPlus,Search,FileText,Download,Upload,ShieldCheck,ArrowLeft,Settings,Trash2,Pin} from 'lucide-react';
import {Vault,type VaultData,type VaultRecord} from '../core/vault';
import {createDocument,documentText} from '../core/document';
import type {DocumentFile} from '../core/types';
import {sealedStorage,secureFiles,isAndroid,saveBinary} from './secure-platform';
import {enableCryptoWorker,stopCryptoWorker} from './crypto-worker-client';
import {importPortable} from './secure-import';
import {TEMPLATE_NAMES,fromTemplate} from './catalog';
import PasswordDialog from './PasswordDialog';
import './secure.css';
import './books.css';
const SecureEditor=lazy(()=>import('./SecureEditor'));
const BookShelf=lazy(()=>import('./BookShelf'));
const BookWorkspace=lazy(()=>import('./BookWorkspace'));
type PasswordRequest={title:string;creating?:boolean;changing?:boolean;submit:(password:string,next?:string)=>Promise<void>};
const empty:VaultData={format:'WritelyVault',version:1,folders:[],documents:[]};
const vault=new Vault(sealedStorage,bookStorage);
enableCryptoWorker();

export default function SecureWorkspace({onExit,initialView='folder'}:{onExit?:()=>void;initialView?:string}) {
  const [data,setData]=useState<VaultData|null>(null),[exists,setExists]=useState<boolean|null>(null),[password,setPassword]=useState<PasswordRequest|null>(null);
  const [bookId,setBookId]=useState<string|null>(null),bookFlush=useRef<(()=>Promise<void>)|null>(null);
  const registerBookFlush=useCallback((fn:(()=>Promise<void>)|null)=>{bookFlush.current=fn;},[]);
  const [doc,setDoc]=useState<DocumentFile|null>(null),[tabs,setTabs]=useState<string[]>([]),[folder,setFolder]=useState<string|null>(null),[trash,setTrash]=useState(false);
  const [folderEdit,setFolderEdit]=useState<Partial<FolderInfo>|null>(null),[picked,setPicked]=useState<string[]>([]),[destination,setDestination]=useState<string|null|undefined>();
  const creationFolder=destination===undefined?folder:destination;useEffect(()=>{setDestination(undefined);setPicked([]);},[folder]);
  const [versionIndex,setVersionIndex]=useState(0);
  const [exportFormat,setExportFormat]=useState('writely');
  const [view,setView]=useState(initialView),[sort,setSort]=useState('updatedAt');
  useEffect(()=>setPicked([]),[view,trash]);
  const [query,setQuery]=useState(''),[error,setError]=useState(''),[status,setStatus]=useState('Lokal und verschlüsselt'),[busy,setBusy]=useState(false),[settings,setSettings]=useState(false),[revision,setRevision]=useState(0);
  const [idle,setIdle]=useState(()=>Number(localStorage.getItem('writely.sealed.idle')??5));
  const [background,setBackground]=useState(()=>localStorage.getItem('writely.sealed.background')!=='false');
  const [theme,setTheme]=useState(()=>localStorage.getItem('writely.sealed.theme')||'dark');
  const passwordBusy=useRef(false);
  useNativeBack(400,()=>{if(password){if(!passwordBusy.current)setPassword(null);return true;}if(settings){setSettings(false);return true;}return false;},true);
  const opening=useRef(false),epoch=useRef(0);
  const current=useRef<DocumentFile|null>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),locking=useRef(false),lastActivity=useRef(Date.now());
  const reload=()=>{if(vault.unlocked&&!locking.current)setData(vault.data());};
  const flush=useCallback(async()=>{clearTimeout(timer.current);const snapshot=current.current,saveBook=bookFlush.current;if(snapshot&&vault.unlocked){await vault.put(snapshot);}await saveBook?.();},[]);
  const lock=useCallback(async()=>{
    if(locking.current||(!vault.unlocked&&!opening.current))return;
    epoch.current++;locking.current=true;
    const save=flush();
    current.current=null;setDoc(null);setBookId(null);setData(null);setTabs([]);setFolderEdit(null);setPicked([]);setDestination(undefined);setFolder(null);setQuery('');setPassword(null);setSettings(false);setError('');
    try{await save;}catch{setError('Der letzte Arbeitsstand konnte nicht gespeichert werden. Der letzte erfolgreiche Speicherstand bleibt erhalten.');}
    finally{await vault.lock();stopCryptoWorker();locking.current=false;setStatus('Tresor gesperrt');}
  },[flush]);
  useEffect(()=>{if(!data)return;const cleanup=setTimeout(()=>{if(vault.unlocked&&!locking.current)void vault.collectBookGarbage().catch(()=>{if(vault.unlocked&&!locking.current)setError('Unbenutzte Buchdateien konnten noch nicht bereinigt werden. Aktuelle Projekte bleiben erhalten.');});},3000);return()=>clearTimeout(cleanup);},[!!data]);
  useEffect(()=>{let live=true;sealedStorage.read().then(t=>{if(live)setExists(!!t);}).catch(()=>{if(live)setError('Der Tresor konnte nicht gelesen werden. Er wird nicht überschrieben.');});return()=>{live=false;};},[]);
  useEffect(()=>{
    document.documentElement.dataset.surface=theme;document.documentElement.dataset.theme=theme==='amoled'?'dark':theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):theme;
    localStorage.setItem('writely.sealed.theme',theme);
    const media=matchMedia('(prefers-color-scheme: dark)'),change=()=>{if(theme==='system')document.documentElement.dataset.theme=media.matches?'dark':'light';};media.addEventListener('change',change);return()=>media.removeEventListener('change',change);
  },[theme]);
  useEffect(()=>{
    localStorage.setItem('writely.sealed.idle',String(idle));localStorage.setItem('writely.sealed.background',String(background));
    const activity=()=>{lastActivity.current=Date.now();};
    for(const name of ['pointerdown','keydown','input','touchstart'])window.addEventListener(name,activity,{passive:true});
    const interval=setInterval(()=>{if(idle>0&&Date.now()-lastActivity.current>=idle*60000)void lock();},1000);
    const visibility=()=>{if(document.hidden&&background)void lock();};document.addEventListener('visibilitychange',visibility);
    const blur=()=>{if(background&&!isAndroid)void lock();};window.addEventListener('blur',blur);
    const native=isAndroid?NativeApp.addListener('appStateChange',({isActive})=>{if(!isActive&&background)void lock();}):null;
    return()=>{clearInterval(interval);for(const name of ['pointerdown','keydown','input','touchstart'])window.removeEventListener(name,activity);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',blur);void native?.then(handle=>handle.remove());};
  },[idle,background,lock]);
  useEffect(()=>{
    const hotkey=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='l'){e.preventDefault();void lock();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();void flush().then(()=>setStatus('Verschlüsselt gespeichert')).catch(()=>setError('Speichern fehlgeschlagen.'));}};
    window.addEventListener('keydown',hotkey);return()=>window.removeEventListener('keydown',hotkey);
  },[lock,flush]);
  useEffect(()=>window.writely?.onSecureFlush?.(async()=>{await flush();}),[flush]);
  // Browser unload remains best-effort; desktop uses the awaited handshake above.
  useEffect(()=>{if(window.writely)return;const before=()=>{void flush();};window.addEventListener('beforeunload',before);return()=>window.removeEventListener('beforeunload',before);},[flush]);
  useEffect(()=>{if(!isAndroid)return;const handle=NativeApp.addListener('backButton',()=>{if(!window.dispatchEvent(new Event('writely:back',{cancelable:true})))return;if(password){setPassword(null);return;}if(settings){setSettings(false);return;}if(current.current){void flush().then(()=>{current.current=null;setDoc(null);reload();}).catch(()=>setError('Speichern fehlgeschlagen. Die Ansicht bleibt geöffnet.'));return;}void lock().then(()=>NativeApp.exitApp());});return()=>{void handle.then(h=>h.remove());};},[password,settings,flush,lock]);
  const run=async(job:()=>Promise<void>)=>{setBusy(true);setError('');try{await job();reload();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
  const select=async(record:VaultRecord)=>{
    await flush();
    const latest=vault.data().documents.find(r=>r.document.id===record.document.id)!;
    current.current=latest.document;setDoc(latest.document);setTabs(t=>t.includes(latest.document.id)?t:[...t,latest.document.id]);setRevision(r=>r+1);setStatus('Verschlüsselt gespeichert');reload();
  };
  const changed=(document:DocumentFile)=>{
    current.current=document;setDoc(document);setStatus('Wird verschlüsselt gesichert …');clearTimeout(timer.current);
    timer.current=setTimeout(()=>{void flush().then(()=>{if(!locking.current&&vault.unlocked){setStatus('Verschlüsselt gespeichert');reload();}}).catch(()=>setError('Speichern fehlgeschlagen. Prüfe den freien Speicherplatz. Dein letzter erfolgreicher Stand bleibt erhalten.'));},1000);
  };
  const unlockVault=async(p:string,create=false)=>{
    const ticket=epoch.current;opening.current=true;lastActivity.current=Date.now();enableCryptoWorker();
    try{if(create){await vault.create(p);setExists(true);}else await vault.unlock(p);if(ticket!==epoch.current||document.hidden){await vault.lock();throw new Error('Der Entsperrvorgang wurde durch eine Sperre unterbrochen.');}}finally{opening.current=false;}
  };
  const requestUnlock=()=>setPassword({title:exists?'Tresor entsperren':'Verschlüsselten Tresor erstellen',creating:!exists,submit:async p=>{
    await unlockVault(p,!exists);setExists(true);lastActivity.current=Date.now();setData(vault.data());setStatus('Lokal und verschlüsselt');
  }});
  const importFile=()=>run(async()=>{
    await flush();const file=await secureFiles.open();if(!file)return;
    if(!vault.unlocked){setPassword({title:'Tresor für den Import entsperren',submit:async p=>{await unlockVault(p);await importPicked(file);reload();}});return;}
    await importPicked(file);
  });
  const importPicked=async(file:{name:string;text:string;base64?:string})=>{
    if(file.base64){const imported=await importOffice(file.name,file.base64);imported.id=crypto.randomUUID();await vault.put(imported,creationFolder);reload();if(imported.importWarnings?.length)setError(imported.importWarnings.join(' '));return;}
    let sealed=false;try{sealed=['WritelySealed','WritelyVaultBundle'].includes(JSON.parse(file.text)?.format);}catch{}
    if(sealed){setPassword({title:'Kennwort der Importdatei',submit:async p=>{await vault.importBackup(file.text,p);reload();}});return;}
    const imported=importPortable(file.name,file.text);imported.id=crypto.randomUUID();
    await vault.put(imported,creationFolder);reload();
    if(imported.importWarnings?.length)setError(imported.importWarnings.join(' '));
    // Original source belongs to the user and is intentionally never deleted.
    setStatus('Verschlüsselt importiert. Die Quelldatei bleibt unverändert und behält ihren bisherigen Schutz.');
  };
  const backup=()=>run(async()=>{await flush();const text=await vault.backup();await secureFiles.save('Writely-Tresor.writely',text,'application/json');});
  const exportPlain=()=>run(async()=>{
    await flush();const document=current.current;if(!document)return;
    if(!confirm('Unverschlüsselt exportieren? Der Kennwortschutz geht für diese Datei verloren. Jeder mit Dateizugriff kann Text, Bilder und Metadaten lesen.'))return;
    if(!vault.unlocked)throw new Error('Entsperre den Tresor erneut vor dem Export.');
    if(exportFormat==='docx'||exportFormat==='odt'){
      if(!confirm('Office-Ausgabe: Kommentare und komplexe Felder werden nicht vollständig unterstützt. DOCX-Inhaltsverzeichnisse sind anklickbare Momentaufnahmen; Seitenzahlen kommen aus dem Zielprogramm. Vollständige Writely-Daten bleiben als geprüfte Zusatzdaten enthalten. Fortfahren?'))return;
      const bytes=await exportOffice(document,exportFormat);await saveBinary('Writely-Dokument.'+exportFormat,bytes,exportFormat==='docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'application/vnd.oasis.opendocument.text');
    }else if(exportFormat==='txt'){
      if(!confirm('TXT enthält nur Text einschließlich Notentexten. Bilder, Tabellenlayout und Formatierungen entfallen. Fortfahren?'))return;
      await secureFiles.save('Writely-Dokument.txt',documentText(document.content),'text/plain');
    }else if(exportFormat==='html'){
      if(!confirm('HTML erhält grundlegende Formatierung, Tabellen und Bilder; Notentexte stehen im Anhang. Inhaltsverzeichnisse, eigene Absatzstyles, Schrifteinbettung, Druckseiten, Nummerierung und Abschnittsgeometrie werden nicht vollständig abgebildet. Fortfahren?'))return;
      const html='<!doctype html><html lang="de"><meta charset="utf-8"><body>'+generateHTML(document.content,editorExtensions())+notesHTML(document)+'</body></html>';
      await secureFiles.save('Writely-Dokument.html',html,'text/html');
    }else await secureFiles.save('Writely-Dokument.writely',JSON.stringify(document,null,2),'application/json');
  });
  const visible=(data||empty).documents.filter(r=>trash?!!r.deletedAt:!r.deletedAt&&(query.trim()||view!=='folder'||r.folderId===folder)&&(view!=='pinned'||r.pinned));
  const results=query.trim()?visible.filter(r=>`${r.document.title}\n${documentText(r.document.content)}`.toLocaleLowerCase('de').includes(query.toLocaleLowerCase('de'))):visible;
  const drop=(e:React.DragEvent,target:string)=>{e.preventDefault();e.stopPropagation();void run(async()=>{const id=e.dataTransfer.getData('application/x-writely-folder');if(id)await vault.moveFolder(id,target);else await vault.moveMany(draggedDocuments(e),target);setPicked([]);});};
  const returnHome=()=>run(async()=>{await flush();current.current=null;setDoc(null);reload();});
  return <div className="secure-shell">
    <header className="secure-header" hidden={!!doc||!!bookId}><div className="secure-brand"><img src="./writely.png" alt="Writely"/><span>Writely <small>{isAndroid?'Android · Vorschau':'Verschlüsselter Arbeitsbereich'}</small></span></div>
      <nav aria-label="Tresoraktionen">{doc&&<button aria-label="Zur Bibliothek" onClick={returnHome}><ArrowLeft size={19}/></button>}{data&&!doc&&!bookId&&<>{onExit&&<button aria-label="Zur Windows-Bibliothek" onClick={()=>void lock().then(onExit)}><ArrowLeft size={18}/></button>}<button aria-label="Datenschutz und Sicherheit" onClick={()=>setSettings(s=>!s)}><Settings size={19}/></button><button aria-label="Jetzt sperren" onClick={()=>void lock()}><LockKeyhole size={19}/></button></>}</nav>
    </header>
    {error&&<p className="secure-error" role="alert">{error}<button aria-label="Meldung schließen" onClick={()=>setError('')}>×</button></p>}
    {!data?<main className="secure-welcome"><div className="secure-lock"><LockKeyhole size={40}/></div><p className="secure-eyebrow">DEIN PRIVATER SCHREIBPLATZ</p><h1>Deine Gedanken.<br/>Sicher bei dir.</h1><p>Schreiben, ordnen und bewahren.<br/>Vollständig lokal. Mit echter Verschlüsselung.</p><button className="primary-button" disabled={exists===null||locking.current} onClick={requestUnlock}><LockKeyholeOpen size={18}/>{exists?'Tresor entsperren':'Tresor erstellen'}</button><small>Ohne Kennwort gibt es keine Wiederherstellung.</small><p className="secure-scope">Vorschau: Dieser Tresor ist ein eigener Arbeitsbereich. Die bestehende Windows-Bibliothek erhält dadurch keinen Kennwortschutz.</p>{onExit&&<button onClick={onExit}>Zur Windows-Bibliothek</button>}</main>
    :<>
      {settings&&<section className="secure-settings"><button onClick={()=>setSettings(false)}>Einstellungen schließen</button><h2>Datenschutz & Sicherheit</h2><label>Automatische Sperre<select aria-label="Automatische Sperre" value={idle} onChange={e=>setIdle(Number(e.target.value))}><option value={0}>Inaktivitätssperre deaktiviert</option>{[1,5,15,30].map(n=><option key={n} value={n}>Nach {n} Minute{n>1?'n':''}</option>)}</select></label><label><input type="checkbox" checked={background} onChange={e=>setBackground(e.target.checked)}/> Beim Wechsel in den Hintergrund sperren</label><p>Beim Beenden wird der Schlüssel verworfen. Nach einem Neustart wird immer ein Kennwort benötigt.</p><label>Darstellung<select aria-label="Darstellung" value={theme} onChange={e=>setTheme(e.target.value)}><option value="system">Systemstandard</option><option value="light">Hell</option><option value="dark">Dunkel</option><option value="amoled">AMOLED-Schwarz</option></select></label><button onClick={()=>setPassword({title:'Tresorkennwort ändern',changing:true,submit:async(p,next)=>{await flush();await vault.rekey(p,next!);setStatus('Kennwort sicher geändert');}})}>Kennwort ändern</button><button onClick={backup}>Verschlüsseltes Bibliotheks-Backup</button><p>Biometrie, einzelne Dokumentkennwörter und die Umstellung bestehender Windows-Ordner sind noch nicht verfügbar.</p></section>}
      {!bookId&&tabs.length>0&&<div className="secure-tabs" role="tablist" aria-label="Geöffnete Dokumente">{tabs.map(id=>{const r=data.documents.find(r=>r.document.id===id);return r&&!r.deletedAt?<button key={id} role="tab" aria-selected={doc?.id===id} onClick={()=>void run(()=>select(r))}>{r.document.title}</button>:null;})}</div>}
      {doc?<><Suspense fallback={<p>Editor wird geladen …</p>}><SecureEditor key={`${doc.id}-${revision}`} document={doc} onBack={()=>void returnHome()} status={busy?'Wird verarbeitet …':status} actions={<div className="secure-document-actions"><button onClick={()=>void run(async()=>{await flush();setStatus('Verschlüsselt gespeichert');})}>Speichern</button><button onClick={()=>void run(async()=>{await flush();await vault.duplicate(doc.id);setStatus('Dokument dupliziert');})}>Duplizieren</button><button aria-label="Datenschutz und Sicherheit" onClick={()=>setSettings(v=>!v)}>Datenschutz und Sicherheit</button><button aria-label="Jetzt sperren" onClick={()=>void lock()}>Jetzt sperren</button><button onClick={()=>void returnHome()}>Bibliothek</button><select aria-label="Exportformat" value={exportFormat} onChange={e=>setExportFormat(e.target.value)}>{['writely','docx','odt','txt','html'].map(f=><option key={f} value={f}>{f.toUpperCase()}</option>)}</select><button onClick={exportPlain}>Unverschlüsselt exportieren …</button><select aria-label="Versionshistorie" value={versionIndex} onChange={e=>setVersionIndex(Number(e.target.value))}>{(data.documents.find(r=>r.document.id===doc.id)?.history||[]).map((h,i)=><option key={i} value={i}>{new Date(h.capturedAt).toLocaleString('de-DE')} · {h.document.title}</option>)}</select><button onClick={()=>{const r=data.documents.find(r=>r.document.id===doc.id)!;if(!r.history.length){setStatus('Für dieses Dokument ist noch keine ältere Version vorhanden.');return;}const version=r.history[versionIndex];if(!version){setStatus('Wähle eine vorhandene Version aus.');return;}if(confirm(`Version vom ${new Date(version.capturedAt).toLocaleString('de-DE')} wiederherstellen? Der aktuelle Stand wird vorher gesichert.`))void run(async()=>{await flush();await vault.restoreVersion(doc.id,versionIndex);current.current=null;await select(vault.data().documents.find(r=>r.document.id===doc.id)!);});}}>Ausgewählte Version wiederherstellen</button></div> } onChange={changed} onSave={async(kind,name,d)=>{await vault.saveTemplate(kind,name,d);reload();}}/></Suspense></>
      :bookId?<Suspense fallback={<p role="status">Bücher werden vorbereitet …</p>}><BookWorkspace vault={vault} id={bookId} registerFlush={registerBookFlush} onExit={()=>{setBookId(null);setView('books');reload();}} onRootChanged={reload} onLock={()=>void lock()} onBackup={()=>void backup()}/></Suspense>
      :<main className="secure-library"><div className="secure-intro"><p className="secure-eyebrow"><ShieldCheck size={14}/> OFFLINE · VERSCHLÜSSELT</p><h1>Raum für deine Gedanken.</h1><p>Alles an einem Ort. Nur für dich.</p></div><div className="secure-primary-actions"><button className="primary-button" disabled={busy} onClick={()=>void run(async()=>{const d=createDocument('blank');await vault.put(d,creationFolder);await select(vault.data().documents.find(r=>r.document.id===d.id)!);})}><Plus size={18}/>Neues Dokument</button><button onClick={importFile}><Upload size={18}/>Importieren</button><button onClick={backup}><Download size={18}/>Backup</button><button onClick={()=>setFolderEdit({parentId:folder})}><FolderPlus size={18}/>Ordner</button><TargetFolder folders={data.folders} value={creationFolder} onChange={setDestination}/></div>
        <div className="secure-library-bar"><select aria-label="Bibliotheksansicht" value={view} onChange={e=>setView(e.target.value)}><option value="folder">Aktueller Ordner</option><option value="all">Alle Dokumente</option><option value="recent">Zuletzt bearbeitet</option><option value="pinned">Angeheftet</option><option value="templates">Vorlagen</option><option value="books">Bücher</option></select><select aria-label="Sortierung" value={sort} onChange={e=>setSort(e.target.value)}><option value="updatedAt">Änderungsdatum</option><option value="createdAt">Erstellungsdatum</option><option value="title">Name</option></select><button aria-pressed={!trash} onClick={()=>setTrash(false)}>Meine Dokumente</button><button aria-pressed={trash} onClick={()=>setTrash(true)}><Trash2 size={15}/>Papierkorb</button><label><Search size={17}/><input aria-label="Tresor durchsuchen" placeholder="Dokumente und Inhalte suchen" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
        {!trash&&view!=='books'&&<><Breadcrumbs folders={data.folders} current={folder} onSelect={id=>{setFolder(id);setView('folder');}}/>{folder&&<button className="secondary-button" onClick={()=>setFolderEdit(data.folders.find(f=>f.id===folder)!)}>Aktuellen Ordner bearbeiten</button>}<FolderCards folders={data.folders} current={folder} onSelect={id=>{setFolder(id);setView('folder');}} onEdit={setFolderEdit} onDrop={drop}/></>}
        {trash&&view!=='books'&&<div className="folder-trash-list">{data.folders.filter(f=>f.deletedAt).map(f=><article key={f.id}><strong>{f.name}</strong><button onClick={()=>void run(()=>vault.restoreFolder(f.id))}>Ordnerbaum wiederherstellen</button></article>)}</div>}
        <BulkMove folders={data.folders} ids={picked} onClear={()=>setPicked([])} onMove={async(ids,target)=>{await vault.moveMany(ids,target);reload();}}/>
        {view==='books'&&<Suspense fallback={<p role="status">Bücher werden geladen …</p>}><BookShelf vault={vault} books={data.books||[]} trash={trash} onChanged={reload} onOpen={id=>void run(async()=>{await flush();current.current=null;setDoc(null);setBookId(id);})}/></Suspense>}
        {view==='templates'&&<div className="secure-grid">{[...TEMPLATE_NAMES.map(name=>({name,document:fromTemplate(name),kind:'template-save'})),...(data.templates||[])].map((t,i)=><button className="secondary-button" key={i} onClick={()=>void run(async()=>{const d={...structuredClone(t.document),id:crypto.randomUUID(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};await vault.put(d,creationFolder);await select(vault.data().documents.find(r=>r.document.id===d.id)!);})}>{t.kind==='styles-save'?'Styles: ':''}{t.name}</button>)}</div>}
        <div className="secure-grid">{(view==='templates'||view==='books'?[]:results).sort((a,b)=>sort==='title'?a.document.title.localeCompare(b.document.title,'de'):b.document[sort as 'updatedAt'|'createdAt'].localeCompare(a.document[sort as 'updatedAt'|'createdAt'])).map(r=><article className="secure-card" key={r.document.id} draggable={!trash} onDragStart={e=>{e.dataTransfer.setData('text/plain',r.document.id);e.dataTransfer.setData('application/x-writely-documents',JSON.stringify(picked.includes(r.document.id)?picked:[r.document.id]));}}>{!trash&&<label className="selection-label"><input type="checkbox" aria-label={`${r.document.title} auswählen`} checked={picked.includes(r.document.id)} onChange={e=>setPicked(ids=>e.target.checked?[...ids,r.document.id]:ids.filter(id=>id!==r.document.id))}/>Auswählen</label>}<button className="secure-card-open" onClick={()=>!trash&&void run(()=>select(r))}><div className="secure-card-paper"><FileText size={20}/><strong>{r.document.title}</strong><p>{documentText(r.document.content).slice(0,160)}</p></div><strong><LockKeyhole size={13}/>{r.document.title}</strong><small>{new Date(r.document.updatedAt).toLocaleDateString('de-DE')}</small></button><div className="secure-card-actions">{trash?<><button onClick={()=>void run(()=>vault.restore(r.document.id))}>Wiederherstellen</button><button onClick={()=>{if(confirm('Dieses Dokument und seine Versionen endgültig aus dem Tresor löschen?'))void run(()=>vault.purge(r.document.id,true));}}>Endgültig löschen</button></>:<><button aria-label={`${r.document.title} anheften`} onClick={()=>void run(()=>vault.pin(r.document.id))}><Pin size={15}/></button><button aria-label={`${r.document.title} duplizieren`} onClick={()=>void run(()=>vault.duplicate(r.document.id))}>Kopie</button><select aria-label={`${r.document.title} verschieben`} value={r.folderId||''} onChange={e=>void run(()=>vault.move(r.document.id,e.target.value||null))}><option value="">Meine Dokumente</option>{data.folders.filter(f=>!f.deletedAt).map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select><button aria-label={`${r.document.title} löschen`} onClick={()=>void run(()=>vault.trash(r.document.id))}><Trash2 size={15}/></button></>}</div></article>)}</div>
        {view!=='books'&&results.length===0&&<p className="secure-empty">{query?'Keine passenden Dokumente.':trash?'Dein Papierkorb ist leer.':'Ein guter Gedanke beginnt mit einer leeren Seite.'}</p>}
        <p className="secure-scope">Geschützt wird der gesamte Tresor einschließlich aller Unterordner, Versionen und Backups. Alte Windows-Dateien bleiben in ihrer bisherigen Bibliothek.</p>
      </main>}
      <div className="secure-status" role="status" hidden={!!doc||!!bookId}><ShieldCheck size={13}/>{busy?'Wird verarbeitet …':status}</div>
    </>}
    {data&&folderEdit&&<FolderDialog folders={data.folders} initial={folderEdit} onClose={()=>setFolderEdit(null)} onSave={async value=>{await vault.saveFolder(value);reload();}} onTrash={async id=>{await vault.trashFolder(id);if(folderTrail(data.folders,folder).some((f:FolderInfo)=>f.id===id))setFolder(folderEdit.parentId??null);setPicked([]);reload();}}/>}
    {password&&<PasswordDialog title={password.title} creating={password.creating} changing={password.changing} onSubmit={async(p,next)=>{passwordBusy.current=true;try{await password.submit(p,next);}finally{passwordBusy.current=false;}}} onClose={()=>setPassword(request=>request===password?null:request)}/>}
  </div>;
}
