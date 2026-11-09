import {useEffect,useRef,useState,useDeferredValue,useMemo} from 'react';
import {EditorContent,useEditor} from '@tiptap/react';
import {Bold,Italic,Underline,Undo2,Redo2,List,ListOrdered,Table2,ImagePlus,Search,BookOpen,AlignLeft,AlignCenter,AlignRight} from 'lucide-react';
import {editorExtensions} from './editor-extensions';
import {documentStats,styleSheet} from '../core/document';
import type {DocumentFile} from '../core/types';
import MobileTools from './MobileTools';
import {closeHistory} from '@tiptap/pm/history';
import SearchPanel from './SearchPanel';

export default function SecureEditor({document,onChange,onSave}:{document:DocumentFile;onChange:(doc:DocumentFile)=>void;onSave:(kind:string,name:string,d:DocumentFile)=>Promise<void>}) {
  const doc=useRef(document);doc.current=document;
  const changed=useRef(onChange);changed.current=onChange;
  const [tools,setTools]=useState(false),[focus,setFocus]=useState(false);
  const [search,setSearch]=useState(false),[reading,setReading]=useState(false),[tick,setTick]=useState(0);
  const deferred=useDeferredValue(document.content),stats=useMemo(()=>documentStats(deferred),[deferred]);
  const image=useRef<HTMLInputElement>(null);
  const editor=useEditor({extensions:editorExtensions(),content:{...document.content,attrs:{...document.content.attrs,pageLayout:document.content.attrs?.pageLayout||document.page}},
    editorProps:{attributes:{class:'secure-prose',spellcheck:'false','aria-label':'Geschütztes Dokument bearbeiten',lang:'de'}},
    onUpdate:({editor})=>changed.current({...doc.current,schemaVersion:2,content:editor.getJSON(),page:editor.state.doc.attrs.pageLayout||doc.current.page,updatedAt:new Date().toISOString()}),
    onSelectionUpdate:()=>setTick(n=>n+1),shouldRerenderOnTransaction:false,
  });
  useEffect(()=>{const handle=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f'){e.preventDefault();setSearch(true);}};window.addEventListener('keydown',handle);return()=>window.removeEventListener('keydown',handle);},[]);
  if(!editor)return <p role="status">Editor wird vorbereitet …</p>;
  const tool=(label:string,Icon:typeof Bold,action:()=>void,active=false)=><button type="button" key={label} title={label} aria-label={label} aria-pressed={active} onMouseDown={e=>e.preventDefault()} onClick={action}><Icon size={19}/></button>;
  return <section className={`secure-editor ${focus?'secure-focus':''}`} data-selection={tick}>
    <style>{styleSheet(document.styles)}</style>
    <input className="secure-title" aria-label="Dokumenttitel" value={document.title} maxLength={500} onChange={e=>onChange({...document,title:e.target.value,updatedAt:new Date().toISOString()})}/>
    <div className="secure-tools" role="toolbar" aria-label="Text formatieren">
      {tool('Rückgängig',Undo2,()=>editor.chain().focus().undo().run())}{tool('Wiederholen',Redo2,()=>editor.chain().focus().redo().run())}
      {tool('Fett',Bold,()=>editor.chain().focus().toggleBold().run(),editor.isActive('bold'))}
      {tool('Kursiv',Italic,()=>editor.chain().focus().toggleItalic().run(),editor.isActive('italic'))}
      {tool('Unterstrichen',Underline,()=>editor.chain().focus().toggleUnderline().run(),editor.isActive('underline'))}
      <select aria-label="Absatzformat" value={editor.isActive('heading')?editor.getAttributes('heading').level:0} onChange={e=>Number(e.target.value)?editor.chain().focus().setHeading({level:Number(e.target.value) as 1}).run():editor.chain().focus().setParagraph().run()}><option value={0}>Normaltext</option>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>Überschrift {n}</option>)}</select>
      <select aria-label="Schriftart" onChange={e=>editor.chain().focus().setFontFamily(e.target.value).run()} defaultValue="Source Serif 4">{['Source Serif 4','Inter','serif','sans-serif','monospace'].map(f=><option key={f}>{f}</option>)}</select>
      <select aria-label="Schriftgröße" defaultValue="12" onChange={e=>editor.chain().focus().setFontSize(`${e.target.value}pt`).run()}>{[9,10,11,12,14,16,18,24,30,36,48].map(n=><option key={n}>{n}</option>)}</select>
      <label title="Textfarbe"><span className="sr-only">Textfarbe</span><input aria-label="Textfarbe" type="color" defaultValue="#34313c" onChange={e=>editor.chain().focus().setColor(e.target.value).run()}/></label>
      {tool('Aufzählung',List,()=>editor.chain().focus().toggleBulletList().run(),editor.isActive('bulletList'))}
      {tool('Nummerierung',ListOrdered,()=>editor.chain().focus().toggleOrderedList().run(),editor.isActive('orderedList'))}
      {tool('Linksbündig',AlignLeft,()=>editor.chain().focus().setTextAlign('left').run())}{tool('Zentriert',AlignCenter,()=>editor.chain().focus().setTextAlign('center').run())}{tool('Rechtsbündig',AlignRight,()=>editor.chain().focus().setTextAlign('right').run())}
      {tool('Erweiterte Werkzeuge',Table2,()=>setTools(v=>!v))}<button aria-label="Fokusmodus" aria-pressed={focus} onClick={()=>setFocus(v=>!v)}>Fokus</button>
      {tool('Bild einfügen',ImagePlus,()=>image.current?.click())}
      {tool('Suchen und Ersetzen',Search,()=>setSearch(v=>!v))}
      {tool('Lesemodus',BookOpen,()=>{editor.setEditable(reading);setReading(v=>!v);},reading)}
    </div>
    <input hidden ref={image} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>5*1024*1024){alert('Das Bild darf im Prototyp höchstens 5 MB groß sein.');return;}const r=new FileReader();r.onload=()=>editor.chain().focus().setImage({src:r.result as string,alt:f.name}).run();r.readAsDataURL(f);e.target.value='';}}/>
    {tools&&<MobileTools editor={editor} document={document} onClose={()=>setTools(false)} onSave={onSave} replace={next=>{editor.view.dispatch(closeHistory(editor.state.tr.setDocAttribute('pageLayout',next.page).replaceWith(0,editor.state.doc.content.size,editor.schema.nodeFromJSON(next.content).content)));changed.current({...next,content:editor.getJSON(),updatedAt:new Date().toISOString()});}}/>}
    <div className="secure-page"><EditorContent editor={editor}/></div>
    <footer>{stats.words} Wörter · {stats.characters} Zeichen · {stats.readingMinutes} Min. Lesezeit{reading?' · Lesemodus':''}</footer>
    {search&&<SearchPanel editor={editor} version={document.updatedAt} onClose={()=>setSearch(false)}/>}
  </section>;
}
