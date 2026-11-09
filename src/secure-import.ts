import {generateJSON} from '@tiptap/core';
import {marked} from 'marked';
import {createDocument} from '../core/document';
import {validateDocument} from '../core/validation.mjs';
import {migrateDocument} from '../core/document-schema.mjs';
import {decodeDocument} from '../core/document-codec';
import {editorExtensions} from './editor-extensions';
import type {DocumentFile} from '../core/types';

export function importPortable(name:string,text:string):DocumentFile {
  const ext=name.split('.').pop()?.toLowerCase();
  if(ext==='writely')return structuredClone(decodeDocument(text));
  const d=createDocument('blank');d.title=name.replace(/\.[^.]+$/,'').slice(0,500);
  if(ext==='txt')d.content={type:'doc',content:text.split(/\r?\n/).map(line=>({type:'paragraph',content:line?[{type:'text',text:line}]:[]}))};
  else if(['md','html','htm'].includes(ext||'')) {
    const parsed=new DOMParser().parseFromString(ext==='md'?marked.parse(text,{async:false}):text,'text/html');
    parsed.querySelectorAll('script,style,iframe,object,embed,link,meta,form,input,svg,math,audio,video').forEach(el=>el.remove());
    for(const el of parsed.body.querySelectorAll('*')){
      for(const attr of [...el.attributes])if(!['href','src','alt','colspan','rowspan'].includes(attr.name))el.removeAttribute(attr.name);
      if(el.tagName==='A'&&!/^(https?:|mailto:|#)/i.test(el.getAttribute('href')||''))el.removeAttribute('href');
      if(el.tagName==='IMG'&&!/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(el.getAttribute('src')||''))el.remove();
    }
    d.content=generateJSON(parsed.body.innerHTML,editorExtensions());
    d.importWarnings=['HTML/Markdown übernehmen grundlegende Struktur. Nicht unterstützte Inhalte, externe Bilder und Layoutangaben werden entfernt.'];
  }else throw new Error('Android/Tresor unterstützt derzeit Writely, TXT, Markdown und HTML. Office- und PDF-Konverter stehen im Windows-Haupteditor zur Verfügung.');
  return validateDocument(d);
}
