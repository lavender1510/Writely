import {Extension,Mark} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import {Table,TableRow,TableHeader,TableCell} from '@tiptap/extension-table';
import {TextStyle,Color,FontFamily,FontSize} from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import {HeadingAnchors,Note,DynamicTOC} from './references-editor';
import {SearchHighlights} from './search-editor';
import {ProofingHighlights} from './proofing-editor';
import {LayoutMetadata,LayoutBreak} from './layout-editor';
const NamedStyle = Extension.create({
  name: 'namedStyle',
  addGlobalAttributes() {
    return [{ types: ['paragraph', 'heading', 'blockquote'], attributes: {
      styleId: { default: null, parseHTML: el => el.getAttribute('data-style-id') || el.getAttribute('data-style'), renderHTML: a => a.styleId ? { 'data-style-id': a.styleId } : {} },
    } }];
  },
});
const SuperscriptMark = Mark.create({ name:'superscript', parseHTML:()=>[{tag:'sup'}], renderHTML:()=>['sup',{},0] });
const SubscriptMark = Mark.create({ name:'subscript', parseHTML:()=>[{tag:'sub'}], renderHTML:()=>['sub',{},0] });
const RichImage=Image.extend({addAttributes(){return {...this.parent?.(),drawing:{default:null,rendered:false},originalSrc:{default:null,rendered:false},imageEdit:{default:null,rendered:false},float:{default:'inline',parseHTML:element=>element.style.float||'inline',renderHTML:a=>a.float==='left'||a.float==='right'?{style:`float:${a.float};max-width:60%;margin:12px;`}:a.float==='center'?{style:'display:block;margin-left:auto;margin-right:auto'}:{}}};}});
const Cell=TableCell.extend({addAttributes(){return {...this.parent?.(),align:{default:null,parseHTML:el=>el.style.textAlign||null,renderHTML:a=>a.align?{style:`text-align:${a.align}`}:{ }},cellBorder:{default:null,renderHTML:a=>a.cellBorder?{style:`border:${a.cellBorder==='none'?'none':'1px solid '+a.cellBorder}`}:{ }},paddingMm:{default:null,renderHTML:a=>a.paddingMm!=null?{style:`padding:${a.paddingMm}mm`}:{}},background:{default:null,parseHTML:el=>el.style.backgroundColor||null,renderHTML:a=>a.background?{style:`background-color:${a.background}`}:{}}};}});
const HeaderCell=TableHeader.extend({addAttributes(){return {...this.parent?.(),align:{default:null,parseHTML:el=>el.style.textAlign||null,renderHTML:a=>a.align?{style:`text-align:${a.align}`}:{ }},cellBorder:{default:null,renderHTML:a=>a.cellBorder?{style:`border:${a.cellBorder==='none'?'none':'1px solid '+a.cellBorder}`}:{ }},paddingMm:{default:null,renderHTML:a=>a.paddingMm!=null?{style:`padding:${a.paddingMm}mm`}:{}},background:{default:null,parseHTML:el=>el.style.backgroundColor||null,renderHTML:a=>a.background?{style:`background-color:${a.background}`}:{}}};}});

export function editorExtensions() {return [StarterKit.configure({ link: { openOnClick: false, autolink: true } }), NamedStyle, HeadingAnchors, Note, DynamicTOC, SearchHighlights, ProofingHighlights, LayoutMetadata, LayoutBreak, SuperscriptMark, SubscriptMark, RichImage.configure({ allowBase64: true }), Table.configure({ resizable: true }), TableRow, HeaderCell, Cell, TextStyle, Color, FontFamily, FontSize, TextAlign.configure({ types: ['heading', 'paragraph'] }), Highlight.configure({ multicolor: true })];}
