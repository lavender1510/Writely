export const paragraphRanges={spaceBeforePt:[0,300],spaceAfterPt:[0,300],indentLeftMm:[0,150],indentRightMm:[0,150],firstLineMm:[-100,100]};
export function validateParagraphStyle(s){
  for(const [key,[min,max]] of Object.entries(paragraphRanges))if(s[key]!==undefined&&(!Number.isFinite(s[key])||s[key]<min||s[key]>max))throw new Error(`Ungültige Absatzvorlage: ${key}.`);
  for(const k of ['keepWithNext','keepTogether','pageBreakBefore'])if(s[k]!==undefined&&typeof s[k]!=='boolean')throw new Error(`Ungültige Absatzvorlage: ${k}.`);
  if(s.alignment!==undefined&&!['left','right','center','justify'].includes(s.alignment))throw new Error('Ungültige Absatzausrichtung.');
  return s;
}
export function paragraphCSS(s){validateParagraphStyle(s);const parts=[];for(const [k,prop,unit] of [['spaceBeforePt','margin-top','pt'],['spaceAfterPt','margin-bottom','pt'],['indentLeftMm','margin-left','mm'],['indentRightMm','margin-right','mm'],['firstLineMm','text-indent','mm']])if(s[k]!==undefined)parts.push(`${prop}:${s[k]}${unit}`);if(s.alignment)parts.push(`text-align:${s.alignment}`);if(s.keepWithNext)parts.push('break-after:avoid');if(s.keepTogether)parts.push('break-inside:avoid');if(s.pageBreakBefore)parts.push('break-before:page');return parts.join(';');}
