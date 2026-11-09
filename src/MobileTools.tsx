import {useState} from 'react';
import type {Editor} from '@tiptap/react';
import {closeHistory} from '@tiptap/pm/history';
import LayoutPanel from './LayoutPanel';
import TableTools from './TableTools';
import ImageTools from './ImageTools';
import InsertPanel from './InsertPanel';
import Design from './Design';
import PageNavigator from './PageNavigator';
import {NoteDialog,NotesList} from './NotesPanel';
import {normalizeLayout} from '../core/layout.mjs';
import type {DocumentFile} from '../core/types';

export default function MobileTools({editor,document,replace,onSave,onClose}:{editor:Editor;document:DocumentFile;replace:(d:DocumentFile)=>void;onSave:(kind:string,name:string,d:DocumentFile)=>Promise<void>;onClose:()=>void}){
  const [tab,setTab]=useState('Text'),[dialog,setDialog]=useState(''),[message,setMessage]=useState('');
  const current=()=>{let layout=normalizeLayout(document.page),pos:number|null=null;editor.state.doc.forEach((node,p)=>{if(p<=editor.state.selection.from&&node.type.name==='layoutBreak'&&node.attrs.kind==='section'){layout=normalizeLayout(node.attrs.layout||layout);pos=p;}});return {layout,pos};};
  const apply=(layout:any,scope:string)=>{const section=current();editor.chain().focus().command(({tr})=>{closeHistory(tr);if(scope==='current'&&section.pos!==null){const node=tr.doc.nodeAt(section.pos)!;tr.setNodeMarkup(section.pos,undefined,{...node.attrs,layout});}else if(scope==='new'){const node=editor.schema.nodes.layoutBreak.create({kind:'section',id:crypto.randomUUID(),layout});tr.replaceSelectionWith(node);}else tr.setDocAttribute('pageLayout',layout);return true;}).run();};
  const styleId=editor.getAttributes(editor.isActive('heading')?'heading':'paragraph').styleId||(editor.isActive('heading')?'h'+editor.getAttributes('heading').level:'normal');
  const updateStyle=(changes:Record<string,unknown>)=>replace({...document,styles:{...document.styles,[styleId]:{...document.styles[styleId],name:document.styles[styleId]?.name||styleId,...changes}}});
  const button=(label:string,action:()=>unknown)=><button key={label} className="secondary-button" onClick={()=>{action();}}>{label}</button>;
  return <>
    <section className="mobile-toolbox" aria-label="Erweiterte Werkzeuge">
      <header><strong>Deine Schreibwerkzeuge</strong><button onClick={onClose}>Schließen</button></header>
      <nav aria-label="Werkzeugbereiche">{['Text','Absatz','Einfügen','Tabelle','Layout','Verweise','Gestalten'].map(t=><button key={t} aria-pressed={tab===t} onClick={()=>setTab(t)}>{t}</button>)}</nav>
      {message&&<p role="alert">{message}</p>}
      <div className="mobile-tool-content">
      {tab==='Text'&&<>{button('Durchgestrichen',()=>editor.chain().focus().toggleStrike().run())}{button('Hochgestellt',()=>editor.chain().focus().toggleMark('superscript').run())}{button('Tiefgestellt',()=>editor.chain().focus().toggleMark('subscript').run())}{button('Hervorheben',()=>editor.chain().focus().toggleHighlight({color:'#f5d982'}).run())}{button('Formatierung entfernen',()=>editor.chain().focus().unsetAllMarks().clearNodes().run())}{button('Alles auswählen',()=>editor.chain().focus().selectAll().run())}{button('Link einfügen / ändern',()=>{const href=prompt('Linkadresse (https://, mailto: oder #Anker)',editor.getAttributes('link').href||'https://');if(href===null)return;if(!href){editor.chain().focus().unsetLink().run();return;}if(!/^(https?:\/\/|mailto:|#)/i.test(href))return setMessage('Bitte verwende eine sichere Linkadresse.');editor.chain().focus().extendMarkRange('link').setLink({href}).run();})}<p>Ausschneiden, Kopieren und Einfügen über die native Android-Textauswahl oder Strg+X/C/V.</p></>}
      {tab==='Absatz'&&<>{button('Zitat',()=>editor.chain().focus().toggleBlockquote().run())}{button('Codeblock',()=>editor.chain().focus().toggleCodeBlock().run())}{button('Blocksatz',()=>editor.chain().focus().setTextAlign('justify').run())}{button('Liste einrücken',()=>{if(!editor.chain().focus().sinkListItem('listItem').run())setMessage('Wähle einen Listeneintrag aus.');})}{button('Liste ausrücken',()=>{if(!editor.chain().focus().liftListItem('listItem').run())setMessage('Wähle einen eingerückten Listeneintrag aus.');})}<label>Formatvorlage<select aria-label="Mobile Formatvorlage" onChange={e=>editor.chain().focus().updateAttributes(editor.isActive('heading')?'heading':'paragraph',{styleId:e.target.value}).run()}><option value="">Auswählen</option>{Object.entries(document.styles).map(([id,s])=><option key={id} value={id}>{s.name}</option>)}</select></label><label>Zeilenabstand der Formatvorlage<input aria-label="Zeilenabstand" type="number" min={1} max={3} step={.1} defaultValue={1.75} onChange={e=>{const id=styleId;const value=Number(e.target.value);if(value>=1&&value<=3)replace({...document,styles:{...document.styles,[id]:{...document.styles[id],name:document.styles[id]?.name||id,lineHeight:value}}});}}/></label><label>Vorlagenschrift<input aria-label="Vorlagenschrift" value={document.styles[styleId]?.fontFamily||''} maxLength={120} onChange={e=>{if(/^[\p{L}\p{N} _.,'"-]*$/u.test(e.target.value))updateStyle({fontFamily:e.target.value||undefined});}}/></label><label>Vorlagengröße<input aria-label="Vorlagengröße" type="number" min={6} max={120} value={document.styles[styleId]?.fontSize||12} onChange={e=>{const n=Number(e.target.value);if(n>=6&&n<=120)updateStyle({fontSize:n});}}/></label><label>Vorlagenfarbe<input type="color" aria-label="Vorlagenfarbe" value={document.styles[styleId]?.color||'#34313c'} onChange={e=>updateStyle({color:e.target.value})}/></label></>}
      {tab==='Einfügen'&&<>{button('Tabelle, Grafik und Sonderzeichen',()=>setDialog('insert'))}{button('Bild bearbeiten',()=>editor.isActive('image')?setDialog('image'):setMessage('Wähle zuerst ein Bild aus.'))}{button('Grafik erneut bearbeiten',()=>editor.isActive('image')&&editor.getAttributes('image').drawing?setDialog('insert'):setMessage('Wähle zuerst eine Writely-Grafik aus.'))}{button('Trennlinie',()=>editor.chain().focus().setHorizontalRule().run())}{['page','section','column'].map((kind,i)=>button(['Seitenumbruch','Abschnittsumbruch','Spaltenumbruch'][i],()=>editor.chain().focus().insertContent([{type:'layoutBreak',attrs:{kind,id:crypto.randomUUID(),layout:kind==='section'?current().layout:null}},{type:'paragraph'}]).run()))}</>}
      {tab==='Tabelle'&&<TableTools editor={editor} notify={setMessage}/>}
      {tab==='Layout'&&<>{button('Seite einrichten',()=>setDialog('layout'))}<PageNavigator editor={editor}/><p>Manuelle Seitenbereiche; keine automatische Druckpaginierung. Die mobile PDF-Ausgabe ist noch nicht freigegeben.</p></>}
      {tab==='Verweise'&&<>{button('Fußnote',()=>setDialog('footnote'))}{button('Endnote',()=>setDialog('endnote'))}{button('Inhaltsverzeichnis',()=>editor.chain().focus().insertContent({type:'toc',attrs:{id:crypto.randomUUID(),title:'Inhaltsverzeichnis',maxLevel:6}}).run())}<NotesList editor={editor} onEdit={kind=>setDialog(kind)}/><div>{(()=>{const items:{pos:number;text:string}[]=[];editor.state.doc.descendants((n,p)=>{if(n.type.name==='heading')items.push({pos:p,text:n.textContent});});return items.map(h=>button(h.text||'Ohne Titel',()=>editor.chain().setTextSelection(h.pos+1).focus().scrollIntoView().run()));})()}</div></>}
      {tab==='Gestalten'&&button('Styles, Themes und Cover',()=>setDialog('design'))}
      </div>
    </section>
    {dialog==='layout'&&<LayoutPanel value={current().layout} onApply={apply} onClose={()=>setDialog('')}/>}
    {dialog==='insert'&&<InsertPanel editor={editor} notify={setMessage} onClose={()=>setDialog('')}/>}
    {dialog==='image'&&<ImageTools editor={editor} notify={setMessage} onClose={()=>setDialog('')}/>}
    {['footnote','endnote'].includes(dialog)&&<NoteDialog editor={editor} kind={dialog as 'footnote'|'endnote'} onClose={()=>setDialog('')}/>}
    {dialog==='design'&&<Design document={document} onChange={replace} onSave={onSave} onClose={()=>setDialog('')}/>}
  </>;
}
