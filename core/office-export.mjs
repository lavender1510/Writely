import * as docx from 'docx';
import {Buffer} from 'buffer';
import {createSHA256} from 'hash-wasm';
import {references} from './document-schema.mjs';
import {documentSections,normalizeLayout,tableWidths} from './layout.mjs';
import {attach} from './zip-roundtrip.mjs';
function imageDimensions(data, type) {
  if (type === 'png' && data.length >= 24 && data.subarray(1, 4).toString() === 'PNG') return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  if (type === 'gif' && data.length >= 10 && data.subarray(0, 3).toString() === 'GIF') return { width: data.readUInt16LE(6), height: data.readUInt16LE(8) };
  if ((type === 'jpeg' || type === 'jpg') && data.length >= 4) {
    let offset = 2;
    while (offset + 8 < data.length) {
      if (data[offset] !== 0xff) break;
      const marker = data[offset + 1];
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) return { width: data.readUInt16BE(offset + 7), height: data.readUInt16BE(offset + 5) };
      const size = data.readUInt16BE(offset + 2);
      if (size < 2) break;
      offset += size + 2;
    }
  }
  return { width: 480, height: 300 };
}

function styleKey(node) {
  if (node.attrs?.styleId) return node.attrs.styleId;
  return node.type === 'heading' ? `h${Math.min(6, Math.max(1, Number(node.attrs?.level) || 1))}` : node.type === 'blockquote' ? 'quote' : node.type === 'codeBlock' ? 'code' : 'normal';
}
function resolveStyle(document, key, visited = new Set()) {
  if (visited.has(key) || visited.size > 12) return {};
  visited.add(key);
  const style = document?.styles?.[key] || {};
  return { ...(style.basedOn ? resolveStyle(document, style.basedOn, visited) : {}), ...style };
}
async function exportDocx(document) {
  const hasher=await createSHA256();
  const createHash=()=>({update(value){hasher.init().update(value);return this;},digest(){return hasher.digest('hex');}});
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, ExternalHyperlink, HeadingLevel, AlignmentType, WidthType, LevelFormat } = docx;
  const numbering = [];
  const referenceData=references(document);
  const bookmarkName=id=>'w_'+createHash('sha256').update(String(id)).digest('hex').slice(0,32);
  const footnotes=Object.fromEntries(referenceData.notes.filter(n=>n.kind==='footnote').map(n=>[n.number,{children:n.text.split('\n').map(line=>new Paragraph({children:[new TextRun({...runStyle(resolveStyle(document,'footnote')),text:line})]}))}]));
  const endnotes=Object.fromEntries(referenceData.notes.filter(n=>n.kind==='endnote').map(n=>[n.number,{children:n.text.split('\n').map(line=>new Paragraph({children:[new TextRun({...runStyle(resolveStyle(document,'footnote')),text:line})]}))}]));
  let coverSeparatorPending=!!document.styles?.coverTitle;
  const customIds = Object.fromEntries(Object.keys(document.styles || {}).map(key => [key, `Writely_${Buffer.from(key).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'')}`]));
  function runStyle(style) {
    const result = {};
    if (typeof style.fontFamily === 'string' && /^[\w\s,'"-]{1,120}$/u.test(style.fontFamily)) result.font = style.fontFamily.replace(/^['"]|['"]$/g, '');
    if (typeof style.fontSize === 'number' && style.fontSize >= 4 && style.fontSize <= 300) result.size = Math.round(style.fontSize * 2);
    if (typeof style.color === 'string' && /^#[0-9a-f]{6}$/i.test(style.color)) result.color = style.color.slice(1);
    if (typeof style.bold === 'boolean') result.bold = style.bold;
    if (typeof style.italic === 'boolean') result.italics = style.italic;
    return result;
  }
  function paragraphStyle(style) {
    const spacing={...(typeof style.lineHeight==='number'?{line:Math.round(style.lineHeight*240)}:{}),...(style.spaceBeforePt!==undefined?{before:Math.round(style.spaceBeforePt*20)}:{}),...(style.spaceAfterPt!==undefined?{after:Math.round(style.spaceAfterPt*20)}:{})};
    const mm=n=>Math.round(n/25.4*1440);
    return {spacing,indent:{...(style.indentLeftMm!==undefined?{left:mm(style.indentLeftMm)}:{}),...(style.indentRightMm!==undefined?{right:mm(style.indentRightMm)}:{}),...(style.firstLineMm!==undefined?(style.firstLineMm<0?{hanging:mm(-style.firstLineMm)}:{firstLine:mm(style.firstLineMm)}):{})},...(style.alignment?{alignment:style.alignment==='justify'?'both':style.alignment}:{}),keepNext:style.keepWithNext,keepLines:style.keepTogether,pageBreakBefore:style.pageBreakBefore};
  }
  function inline(nodes, inherited = {}) {
    return (nodes || []).flatMap(node => {
      if(node.type==='note'){const note=referenceData.notes.find(n=>n.id===node.attrs.id);return note?[note.kind==='footnote'?new docx.FootnoteReferenceRun(note.number):new docx.EndnoteReferenceRun(note.number)]:[];}
      if (node.type === 'hardBreak') return [new TextRun({ break: 1 })];
      if (node.type !== 'text') return inline(node.content, inherited);
      const options = { ...inherited, text: node.text || '' };
      let href;
      for (const mark of node.marks || []) {
        if (mark.type === 'bold') options.bold = true;
        if (mark.type === 'italic') options.italics = true;
        if (mark.type === 'underline') options.underline = {};
        if (mark.type === 'strike') options.strike = true;
        if (mark.type === 'subscript') options.subScript = true;
        if (mark.type === 'superscript') options.superScript = true;
        if (mark.type === 'code') options.font = 'Consolas';
        if (mark.type === 'link' && /^(https?:|mailto:)/i.test(mark.attrs?.href || '')) href = mark.attrs.href;
        if (mark.type === 'textStyle') {
          if (mark.attrs?.fontFamily) options.font = mark.attrs.fontFamily;
          if (mark.attrs?.color && /^#[0-9a-f]{6}$/i.test(mark.attrs.color)) options.color = mark.attrs.color.slice(1);
          const size = parseFloat(mark.attrs?.fontSize); if (size > 0 && size <= 300) options.size = Math.round(size * (String(mark.attrs.fontSize).endsWith('px') ? 1.5 : 2));
        }
      }
      const run = new TextRun(options);
      return [href ? new ExternalHyperlink({ children: [run], link: href }) : run];
    });
  }
  function blocks(nodes, list = null, level = 0) {
    return (nodes || []).flatMap(node => {
      const attrs = node.attrs || {};
      if (node.type === 'bulletList' || node.type === 'orderedList') {
        let config = { bullet: { level: Math.min(level, 8) } };
        if (node.type === 'orderedList') {
          const reference = `writely-list-${numbering.length}`;
          numbering.push({ reference, levels: Array.from({ length: 9 }, (_, i) => ({ level: i, format: LevelFormat.DECIMAL, text: `%${i + 1}.`, start: Math.max(1, Number(attrs.start) || 1), alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720 * (i + 1), hanging: 360 } } } })) });
          config = { numbering: { reference, level: Math.min(level, 8) } };
        }
        return (node.content || []).flatMap(item => blocks(item.content, config, level + 1));
      }
      if(node.type==='toc')return [new Paragraph({children:[new TextRun(node.attrs.title)]}),...referenceData.headings.filter(h=>h.level<=node.attrs.maxLevel).map(h=>new Paragraph({indent:{left:(h.level-1)*240},style:customIds.toc,children:[new docx.InternalHyperlink({anchor:bookmarkName(h.id),children:[new TextRun(h.text)]})]}))];
      if (node.type === 'table') return [new Table({...(tableWidths(node,activeLayout).length?{columnWidths:tableWidths(node,activeLayout).map(mm=>Math.round(mm/25.4*1440)),layout:docx.TableLayoutType.FIXED}:{}), width: { size: 100, type: WidthType.PERCENTAGE }, rows: (node.content || []).map((row,i) => new TableRow({tableHeader:i===0&&row.content?.some(c=>c.type==='tableHeader'), children: (row.content || []).map(cell => {
        const content = blocks(cell.content);
        return new TableCell({ children: content.length ? content : [new Paragraph('')], columnSpan: Number(cell.attrs?.colspan) || 1,rowSpan:Number(cell.attrs?.rowspan)||1, margins:{top:Math.round((cell.attrs?.paddingMm??1.5)/25.4*1440),bottom:Math.round((cell.attrs?.paddingMm??1.5)/25.4*1440),left:Math.round((cell.attrs?.paddingMm??1.5)/25.4*1440),right:Math.round((cell.attrs?.paddingMm??1.5)/25.4*1440)},...(cell.attrs?.cellBorder?{borders:Object.fromEntries(['top','bottom','left','right'].map(side=>[side,{style:cell.attrs.cellBorder==='none'?docx.BorderStyle.NONE:docx.BorderStyle.SINGLE,color:cell.attrs.cellBorder==='none'?'auto':cell.attrs.cellBorder.replace('#',''),size:6}]))}:{}), ...(cell.attrs?.background?{shading:{fill:cell.attrs.background.replace('#','')}}:cell.type === 'tableHeader' ? { shading: { fill: 'EEEAF8' } } : {}) });
      }) })) })];
      if (node.type === 'image') {
        const match = /^data:image\/(png|jpeg|jpg|gif);base64,([\s\S]+)$/.exec(attrs.src || '');
        if (!match) throw new Error('Dieses Bildformat kann noch nicht als DOCX exportiert werden. Verwende PNG, JPG oder GIF oder exportiere als PDF.');
        const data = Buffer.from(match[2], 'base64');
        const intrinsic = imageDimensions(data, match[1]);
        const desiredWidth = Number(attrs.width) || intrinsic.width;
        const desiredHeight = Number(attrs.height) || desiredWidth * intrinsic.height / Math.max(1, intrinsic.width);
        const scale = Math.min(1, 600 / Math.max(1, desiredWidth), 900 / Math.max(1, desiredHeight));
        const width = Math.max(1, Math.round(desiredWidth * scale));
        const height = Math.max(1, Math.round(desiredHeight * scale));
        return [new Paragraph({ ...(attrs.float==='center'?{alignment:AlignmentType.CENTER}:{}), children: [new ImageRun({ data, type: ['jpg', 'jpeg'].includes(match[1]) ? 'jpg' : match[1], ...(['left','right'].includes(attrs.float)?{floating:{horizontalPosition:{relative:docx.HorizontalPositionRelativeFrom.COLUMN,align:attrs.float},verticalPosition:{relative:docx.VerticalPositionRelativeFrom.PARAGRAPH,offset:0},wrap:{type:docx.TextWrappingType.SQUARE},allowOverlap:false}}:{}), transformation: { width, height }, altText: { title: attrs.alt || 'Bild', description: attrs.alt || 'Bild', name: attrs.alt || 'Bild' } })] })];
      }
      if (node.type === 'blockquote') return blocks(node.content).map(p => p instanceof Paragraph ? p : p);
      if (node.type === 'listItem') return blocks(node.content, list, level);
      if(node.type==='layoutBreak')return [new Paragraph({children:[attrs.kind==='column'?new docx.ColumnBreak():new docx.PageBreak()]})];
      if (node.type === 'horizontalRule' && coverSeparatorPending) {coverSeparatorPending=false;return [new Paragraph({children:[new docx.PageBreak()]})];}
      if (node.type === 'horizontalRule') return [new Paragraph({ border: { bottom: { color: 'AAAAAA', size: 6, style: 'single' } }, children: [] })];
      if (!['paragraph', 'heading', 'codeBlock'].includes(node.type)) return blocks(node.content, list, level);
      const alignment = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED }[attrs.textAlign];
      const key = styleKey(node);
      const resolved = resolveStyle(document, key);
      const headingLevel = Math.min(6, Math.max(1, Number(attrs.level) || 1));
      const isCustom = attrs.styleId && customIds[attrs.styleId] && !/^h[1-6]$/.test(attrs.styleId);
      const style = isCustom ? { style: customIds[attrs.styleId], ...(node.type === 'heading' ? { outlineLevel: headingLevel - 1 } : {}) } : node.type === 'heading' ? { heading: HeadingLevel[`HEADING_${headingLevel}`] } : {};
      const spacing = paragraphStyle(resolved).spacing || {};
      const result = new Paragraph({ ...style, ...(list || {}), ...(alignment ? { alignment } : {}), spacing: { after: 180, ...spacing }, children: node.type==='heading'?[new docx.Bookmark({id:bookmarkName(referenceData.headings.find(h=>h.node===node)?.id||attrs.anchorId),children:inline(node.content,runStyle(resolved))})]:inline(node.content, { ...runStyle(resolved), ...(node.type === 'codeBlock' ? { font: 'Consolas' } : {}) }) });
      // Number only the first paragraph in a list item, leaving subsequent blocks unnumbered.
      list = null;
      return [result];
    });
  }
  
  let activeLayout=normalizeLayout(document.page);
  const sectionOptions=documentSections(document).map((section,sectionIndex)=>{const l=normalizeLayout(section.layout);activeLayout=l;const twips=n=>Math.round(n/25.4*1440);const number=l.numbering;const fields=number.enabled?[new TextRun('Seite '),new TextRun({children:[docx.PageNumber.CURRENT]}),...(number.total?[new TextRun(' von '),new TextRun({children:[docx.PageNumber.TOTAL_PAGES]})]:[])]:[];
    const floating={horizontalPosition:{relative:docx.HorizontalPositionRelativeFrom.PAGE,align:'center'},verticalPosition:{relative:docx.VerticalPositionRelativeFrom.PAGE,align:'center'},behindDocument:true,allowOverlap:true,wrap:{type:docx.TextWrappingType.NONE}};
    const imageParagraph=(src,width,height)=>new Paragraph({children:[new ImageRun({data:Buffer.from(src.split(',')[1],'base64'),type:'png',transformation:{width,height},floating})]});
    const background=l.backgroundRaster?imageParagraph(l.backgroundRaster,Math.round(l.widthMm/25.4*96),Math.round(l.heightMm/25.4*96)):null;
    const watermark=l.watermarkRaster?imageParagraph(l.watermarkRaster,Math.min(600,l.widthMm/25.4*96*.8),Math.min(600,l.widthMm/25.4*96*.8)*.7):null;
    const hf=(text,showNumber,Type)=>new Type({children:[...(Type===docx.Header?[background,watermark].filter(Boolean):[]),new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun(text+(text&&showNumber?' · ':'')),...(showNumber?fields:[])]})]});
    const border={style:'single',size:6,color:'999999'};
    const sectionChildren=blocks(section.blocks);
    return {properties:{type:docx.SectionType.NEXT_PAGE,titlePage:number.firstDifferent,column:{count:l.columns,space:twips(l.columnGapMm),separate:l.columnRule},page:{size:{width:twips(Math.min(l.widthMm,l.heightMm)),height:twips(Math.max(l.widthMm,l.heightMm)),orientation:l.orientation==='landscape'?docx.PageOrientation.LANDSCAPE:docx.PageOrientation.PORTRAIT},margin:{top:twips(l.margins.top),bottom:twips(l.margins.bottom),left:twips(l.margins.left),right:twips(l.margins.right),gutter:twips(l.gutterMm)},pageNumbers:{...(sectionIndex===0||number.restart?{start:number.start}:{}),formatType:number.format==='roman'?docx.NumberFormat.UPPER_ROMAN:number.format==='letters'?docx.NumberFormat.UPPER_LETTER:docx.NumberFormat.DECIMAL},...(l.border?{borders:{pageBorderTop:border,pageBorderBottom:border,pageBorderLeft:border,pageBorderRight:border}}:{})}},headers:{default:hf(l.header,number.position==='header',docx.Header),first:hf(l.header,false,docx.Header)},footers:{default:hf(l.footer,number.position==='footer',docx.Footer),first:hf(l.footer,false,docx.Footer)},children:sectionChildren.length?sectionChildren:[new Paragraph('')]};
  });
  const semanticDefaults = Object.fromEntries(Array.from({ length: 6 }, (_, i) => i + 1).filter(level => document.styles?.[`h${level}`]).map(level => [`heading${level}`, { run: runStyle(resolveStyle(document, `h${level}`)), paragraph: paragraphStyle(resolveStyle(document, `h${level}`)) }]));
  const file = new Document({
    ...(document.theme==='Dunkel'?{background:{color:'25212d'}}:{}),
    creator: 'Writely', title: document.title || 'Unbenannt', description: 'Mit Writely erstellt',
    styles: {
      default: { document: { run: { font: 'Georgia', size: 24, ...runStyle(resolveStyle(document, 'normal')) }, paragraph: { ...paragraphStyle(resolveStyle(document, 'normal')), spacing: { line: 300, ...(paragraphStyle(resolveStyle(document, 'normal')).spacing || {}) } } }, ...semanticDefaults },
      paragraphStyles: Object.entries(document.styles || {}).map(([key, style]) => ({ id: customIds[key], name: String(style.name || key), basedOn: customIds[style.basedOn] || 'Normal', run: runStyle(resolveStyle(document, key)), paragraph: paragraphStyle(resolveStyle(document, key)) })),
    },
    numbering: { config: numbering },
    footnotes,endnotes,
    settings:{mirrorMargins:!!document.page.mirrored},
    sections: sectionOptions,
  });
  return attach(new Uint8Array(await Packer.toArrayBuffer(file)),document);
}


export {exportDocx,imageDimensions};
