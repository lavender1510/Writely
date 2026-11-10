import {useWritingViewport} from './useWritingViewport';
import {useEffect,useRef,useState,useDeferredValue,useMemo,type ReactNode} from 'react';
import {EditorContent,useEditor} from '@tiptap/react';
import {Bold,Italic,Underline,Undo2,Redo2,List,ListOrdered,Table2,ImagePlus,Search,BookOpen,AlignLeft,AlignCenter,AlignRight,ArrowLeft,MoreVertical,Strikethrough,Highlighter} from 'lucide-react';
import {editorExtensions} from './editor-extensions';
import {documentStats,styleSheet} from '../core/document';
import type {DocumentFile} from '../core/types';
import ImageTools from './ImageTools';
import MobileTools from './MobileTools';
import {closeHistory} from '@tiptap/pm/history';
import SearchPanel from './SearchPanel';

export default function SecureEditor({document,onChange,onSave,onBack,actions,status}:{document:DocumentFile;onChange:(doc:DocumentFile)=>void;onSave:(kind:string,name:string,d:DocumentFile)=>Promise<void>;onBack:()=>void;actions:ReactNode;status:string}) {
  const doc=useRef(document);doc.current=document;
  const changed=useRef(onChange);changed.current=onChange;
  const [imageOpen,setImageOpen]=useState(false),[notice,setNotice]=useState('');
  const [menu,setMenu]=useState(false),[info,setInfo]=useState(false);
  const [tools,setTools]=useState(false),[focus,setFocus]=useState(false);
  const [search,setSearch]=useState(false),[reading,setReading]=useState(false),[tick,setTick]=useState(0);
  const deferred=useDeferredValue(document.content),stats=useMemo(()=>documentStats(deferred),[deferred]);
  const image=useRef<HTMLInputElement>(null),titleInput=useRef<HTMLInputElement>(null);
  const editor=useEditor({extensions:editorExtensions(),content:{...document.content,attrs:{...document.content.attrs,pageLayout:document.content.attrs?.pageLayout||document.page}},
    editorProps:{attributes:{class:'secure-prose',spellcheck:'false','aria-label':'Geschütztes Dokument bearbeiten',lang:'de'}},
    onUpdate:({editor})=>changed.current({...doc.current,schemaVersion:2,content:editor.getJSON(),page:editor.state.doc.attrs.pageLayout||doc.current.page,updatedAt:new Date().toISOString()}),
    onTransaction:({transaction})=>{if(transaction.selectionSet||transaction.storedMarksSet)setTick(n=>n+1);},shouldRerenderOnTransaction:false,
  });
  useWritingViewport(editor);
  useEffect(()=>{const close=(e:Event)=>{if(menu||info||tools||search||imageOpen||focus){e.preventDefault();setMenu(false);setFocus(false);setInfo(false);setImageOpen(false);setTools(false);setSearch(false);}};window.addEventListener('writely:back',close);const key=(e:KeyboardEvent)=>{if(e.key==='Escape')close(e);};window.addEventListener('keydown',key);return()=>{window.removeEventListener('writely:back',close);window.removeEventListener('keydown',key);};},[menu,info,tools,search,imageOpen,focus]);
  useEffect(()=>{const handle=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f'){e.preventDefault();setSearch(true);}};window.addEventListener('keydown',handle);return()=>window.removeEventListener('keydown',handle);},[]);
  if(!editor)return <p role="status">Editor wird vorbereitet …</p>;
  const tool=(label:string,Icon:typeof Bold,action:()=>void,active=false)=><button type="button" key={label} title={label} aria-label={label} aria-pressed={active} onPointerDown={e=>e.preventDefault()} onClick={action}><Icon size={19}/></button>;
  return <section className={`secure-editor ${focus?'secure-focus':''}`} data-selection={tick}>
    <style>{styleSheet(document.styles)}</style>
    <header className="writing-header"><button aria-label="Zur Bibliothek" onClick={onBack}><ArrowLeft size={21}/></button>    <input ref={titleInput} className="secure-title" aria-label="Dokumenttitel" value={document.title} readOnly={reading} maxLength={500} onChange={e=>onChange({...document,title:e.target.value,updatedAt:new Date().toISOString()})}/>
{focus&&<button aria-label="Fokus beenden" onClick={()=>setFocus(false)}>×</button>}<button aria-label="Lesemodus" aria-pressed={reading} onClick={()=>{editor.setEditable(reading);if(!reading){setTools(false);setSearch(false);}setReading(v=>!v);}}><BookOpen size={21}/></button><button aria-label="Dokumentaktionen" aria-expanded={menu} onClick={()=>setMenu(v=>!v)}><MoreVertical size={21}/></button></header>
    {menu&&<section className="writing-menu" aria-label="Dokumentaktionen">{actions}<button onClick={()=>{setMenu(false);setReading(false);editor.setEditable(true);requestAnimationFrame(()=>{titleInput.current?.focus();titleInput.current?.select();});}}>Umbenennen</button><button onClick={()=>{setInfo(v=>!v);setMenu(false);}}>Dokumentinformationen</button><p>PDF/Drucken, Handschrift und individuelle Kennwortbereiche sind noch nicht verfügbar. Der gesamte Tresor bleibt geschützt.</p></section>}
    {info&&<section className="writing-info" aria-label="Dokumentinformationen"><button onClick={()=>setInfo(false)}>Schließen</button><p>{stats.words} Wörter · {stats.characters} Zeichen · {stats.paragraphs} Absätze</p><p>Kontinuierliche Ansicht. Automatische Druckseiten werden hier noch nicht berechnet.</p></section>}
    <div className="secure-tools" hidden={reading} role="toolbar" aria-label="Text formatieren">
      {tool('Rückgängig',Undo2,()=>editor.chain().focus().undo().run())}{tool('Wiederholen',Redo2,()=>editor.chain().focus().redo().run())}
      {tool('Fett',Bold,()=>editor.chain().focus().toggleBold().run(),editor.isActive('bold'))}
      {tool('Kursiv',Italic,()=>editor.chain().focus().toggleItalic().run(),editor.isActive('italic'))}
      {tool('Unterstrichen',Underline,()=>editor.chain().focus().toggleUnderline().run(),editor.isActive('underline'))}{tool('Durchgestrichen',Strikethrough,()=>editor.chain().focus().toggleStrike().run(),editor.isActive('strike'))}{tool('Textmarker',Highlighter,()=>editor.chain().focus().toggleHighlight({color:'#b39ad8'}).run(),editor.isActive('highlight'))}
      <select aria-label="Absatzformat" value={editor.isActive('heading')?editor.getAttributes('heading').level:0} onChange={e=>Number(e.target.value)?editor.chain().focus().setHeading({level:Number(e.target.value) as 1}).run():editor.chain().focus().setParagraph().run()}><option value={0}>Normaltext</option>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>Überschrift {n}</option>)}</select>
      <select aria-label="Schriftart" onChange={e=>editor.chain().focus().setFontFamily(e.target.value).run()} value={editor.getAttributes('textStyle').fontFamily||'Source Serif 4'}>{[...new Set(['Source Serif 4','Inter','serif','sans-serif','monospace',editor.getAttributes('textStyle').fontFamily].filter(Boolean))].map(f=><option key={f}>{f}</option>)}</select>
      <select aria-label="Schriftgröße" value={parseFloat(editor.getAttributes('textStyle').fontSize)||12} onChange={e=>editor.chain().focus().setFontSize(`${e.target.value}pt`).run()}>{[9,10,11,12,14,16,18,24,30,36,48].map(n=><option key={n}>{n}</option>)}</select>
      <label title="Textfarbe"><span className="sr-only">Textfarbe</span><input aria-label="Textfarbe" type="color" defaultValue="#34313c" onChange={e=>editor.chain().focus().setColor(e.target.value).run()}/></label>
      {tool('Aufzählung',List,()=>editor.chain().focus().toggleBulletList().run(),editor.isActive('bulletList'))}
      {tool('Nummerierung',ListOrdered,()=>editor.chain().focus().toggleOrderedList().run(),editor.isActive('orderedList'))}
      {tool('Linksbündig',AlignLeft,()=>editor.chain().focus().setTextAlign('left').run())}{tool('Zentriert',AlignCenter,()=>editor.chain().focus().setTextAlign('center').run())}{tool('Rechtsbündig',AlignRight,()=>editor.chain().focus().setTextAlign('right').run())}
      {tool('Erweiterte Werkzeuge',Table2,()=>setTools(v=>!v))}<button aria-label="Fokusmodus" aria-pressed={focus} onClick={()=>setFocus(v=>!v)}>Fokus</button>
      {tool('Bild einfügen',ImagePlus,()=>image.current?.click())}
      {tool('Suchen und Ersetzen',Search,()=>setSearch(v=>!v))}{editor.isActive('table')&&<>{tool('Zeile hinzufügen',Table2,()=>editor.chain().focus().addRowAfter().run())}{tool('Spalte hinzufügen',Table2,()=>editor.chain().focus().addColumnAfter().run())}</>}{editor.isActive('image')&&tool('Bild bearbeiten',ImagePlus,()=>setImageOpen(true))}
    </div>
    <input hidden ref={image} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>5*1024*1024){alert('Das Bild darf im Prototyp höchstens 5 MB groß sein.');return;}const r=new FileReader();r.onload=()=>editor.chain().focus().setImage({src:r.result as string,alt:f.name}).run();r.readAsDataURL(f);e.target.value='';}}/>
    {tools&&<MobileTools editor={editor} document={document} onClose={()=>setTools(false)} onSave={onSave} replace={next=>{editor.view.dispatch(closeHistory(editor.state.tr.setDocAttribute('pageLayout',next.page).replaceWith(0,editor.state.doc.content.size,editor.schema.nodeFromJSON(next.content).content)));changed.current({...next,content:editor.getJSON(),updatedAt:new Date().toISOString()});}}/>}
    {imageOpen&&<ImageTools editor={editor} onClose={()=>setImageOpen(false)} notify={setNotice}/>}{notice&&<p role="alert" className="secure-error">{notice}<button onClick={()=>setNotice('')}>Schließen</button></p>}
    <div className="secure-page"><EditorContent editor={editor}/></div>
    <footer role="status"><span>{stats.words} Wörter · {stats.characters} Zeichen · {stats.readingMinutes} Min.{reading?' · Lesemodus':''}</span><span>{status}</span></footer>
    {search&&<SearchPanel editor={editor} version={document.updatedAt} onClose={()=>setSearch(false)}/>}
  </section>;
}
