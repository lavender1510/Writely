export const PAGE_SIZES={A4:[210,297],A5:[148,210],A3:[297,420],Letter:[215.9,279.4],Legal:[215.9,355.6],Tabloid:[279.4,431.8],Executive:[184.15,266.7]};
export const UNIT_MM={mm:1,cm:10,in:25.4,pt:25.4/72};
export function normalizeLayout(value={}){
 const p=value||{};const size=PAGE_SIZES[p.size]?p.size:p.size==='Custom'?'Custom':'A4';const preset=PAGE_SIZES[size]||[210,297];
 let width=p.size==='Custom'?Number(p.widthMm)||210:preset[0],height=p.size==='Custom'?Number(p.heightMm)||297:preset[1];
 if(p.orientation==='landscape')[width,height]=[Math.max(width,height),Math.min(width,height)];else [width,height]=[Math.min(width,height),Math.max(width,height)];
 const margin=Number.isFinite(p.marginMm)?p.marginMm:20;
 return {size,marginMm:margin,widthMm:width,heightMm:height,orientation:p.orientation==='landscape'?'landscape':'portrait',unit:UNIT_MM[p.unit]?p.unit:'mm',margins:{top:margin,right:margin,bottom:margin,left:margin,...p.margins},gutterMm:p.gutterMm??0,mirrored:!!p.mirrored,columns:p.columns??1,columnGapMm:p.columnGapMm??8,columnRule:!!p.columnRule,background:p.background||'#ffffff',...(p.backgroundRaster?{backgroundRaster:p.backgroundRaster}:{}),border:!!p.border,watermark:p.watermark||'',...(p.watermarkRaster?{watermarkRaster:p.watermarkRaster}:{}),header:p.header||'',footer:p.footer||'',numbering:{enabled:false,start:1,restart:false,position:'footer',format:'arabic',total:true,firstDifferent:false,...p.numbering}};
}
export function validateLayout(p){
 if(!p||!['Custom',...Object.keys(PAGE_SIZES)].includes(p.size)||!Number.isFinite(p.marginMm)||p.marginMm<0||p.marginMm>2000)throw new Error('Die Seiteneinstellungen sind ungültig.');
 const l=normalizeLayout(p);
 if(p.size==='Custom'&&(!Number.isFinite(p.widthMm)||!Number.isFinite(p.heightMm)||p.widthMm<20||p.heightMm<20))throw new Error('Die eigenen Seitenmaße sind ungültig.');
 if(l.backgroundRaster&&!/^data:image\/png;base64,[a-zA-Z0-9+/=]+$/.test(l.backgroundRaster))throw new Error('Das Seitenhintergrundbild ist ungültig.');
 if(l.watermarkRaster&&!/^data:image\/png;base64,[a-zA-Z0-9+/=]+$/.test(l.watermarkRaster))throw new Error('Das Wasserzeichenbild ist ungültig.');
 if(![l.widthMm,l.heightMm].every(n=>Number.isFinite(n)&&n>=20&&n<=2000)||!Object.values(l.margins).every(n=>Number.isFinite(n)&&n>=0)||!Number.isFinite(l.gutterMm)||l.gutterMm<0||l.margins.left+l.margins.right+l.gutterMm>=l.widthMm||l.margins.top+l.margins.bottom>=l.heightMm)throw new Error('Die Seitenränder lassen keinen Platz für den Inhalt.');
 if(!Number.isInteger(l.columns)||l.columns<1||l.columns>12||!Number.isFinite(l.columnGapMm)||l.columnGapMm<0||(l.columns-1)*l.columnGapMm>=l.widthMm-l.margins.left-l.margins.right-l.gutterMm)throw new Error('Die Spalten passen nicht in den verfügbaren Seitenbereich.');
 if(!/^#[0-9a-f]{6}$/i.test(l.background)||typeof l.watermark!=='string'||l.watermark.length>200||typeof l.header!=='string'||l.header.length>2000||typeof l.footer!=='string'||l.footer.length>2000||!['arabic','roman','letters'].includes(l.numbering.format)||!['header','footer'].includes(l.numbering.position)||!Number.isInteger(l.numbering.start)||l.numbering.start<1||l.numbering.start>100000)throw new Error('Die Seitengestaltung oder Seitennummerierung ist ungültig.');
 return l;
}
export function documentSections(document){let layout=normalizeLayout({...document.page,background:document.page.background||(document.theme==='Dunkel'?'#25212d':'#ffffff')});const sections=[];let blocks=[];for(const node of document.content.content||[]){if(node.type==='layoutBreak'&&node.attrs?.kind==='section'){sections.push({layout,blocks});layout=normalizeLayout(node.attrs.layout||layout);blocks=[];}else blocks.push(node);}sections.push({layout,blocks});return sections;}
export function numberLabel(n,format){if(format==='letters'){let out='';while(n>0){n--;out=String.fromCharCode(65+n%26)+out;n=Math.floor(n/26);}return out;}if(format==='roman'){let out='';for(const [v,s]of [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']])while(n>=v){out+=s;n-=v;}return out;}return String(n);}

export function tableWidths(node,layout){const l=normalizeLayout(layout),body=(l.widthMm-l.margins.left-l.margins.right-l.gutterMm-(l.columns-1)*l.columnGapMm)/l.columns;const first=node.content?.[0]?.content||[];const raw=first.flatMap(c=>c.attrs?.colwidth||Array(c.attrs?.colspan||1).fill(null));const known=raw.some(n=>Number.isFinite(n)&&n>0);if(!known)return [];let widths=raw.map(n=>Number.isFinite(n)&&n>0?n/96*25.4:body/Math.max(1,raw.length));const total=widths.reduce((s,n)=>s+n,0);return widths.map(n=>n*Math.min(1,body/total));}
