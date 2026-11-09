import test from 'node:test';
import assert from 'node:assert/strict';
import {planPages,pageAtPosition} from '../core/page-plan';
import {createDocument,styleSheet} from '../core/document';
import {validateDocument} from '../core/validation.mjs';
import {exportDocx} from '../core/office-export.mjs';
import {exportOdt} from '../core/odt-export.mjs';
import {openZip} from '../core/zip-roundtrip.mjs';
test('measured fragments produce deterministic 50/100-page plans without mutating input',()=>{
  for(const count of [50,100,500]){const input=Array.from({length:count*10},(_,i)=>({from:i*10,to:i*10+10,height:10}));const before=JSON.stringify(input);const pages=planPages(input,100);assert.equal(pages.length,count);assert.equal(pageAtPosition(pages,100),1);assert.equal(pageAtPosition(pages,count*100),count-1);assert.equal(pageAtPosition(pages,-1),null);assert.equal(JSON.stringify(input),before);}
});
test('mixed section capacities, explicit breaks and oversized fragments never truncate or loop',()=>{
  const p=planPages([{from:0,to:10,height:20,breakBefore:true},{from:10,to:20,height:90,capacity:80},{from:20,to:30,height:10}],100);assert.equal(p.length,3);assert.equal(p[1].overflow,true);assert.equal(p.flatMap(p=>p.fragments).length,3);assert.deepEqual(planPages([],100),[]);assert.throws(()=>planPages([{from:2,to:1,height:0}],100),/ungültig/);
});
test('paragraph style inheritance renders centrally and exports real DOCX/ODT properties',async()=>{
  const d=createDocument('blank');d.styles.normal={...d.styles.normal,spaceBeforePt:12,spaceAfterPt:18,indentLeftMm:10,firstLineMm:-5,keepWithNext:true};d.styles.custom={name:'Geerbt',basedOn:'normal'};d.content.content![0].attrs={styleId:'custom'};validateDocument(d);assert.match(styleSheet(d.styles),/margin-top:12pt/);assert.match(styleSheet(d.styles),/text-indent:-5mm/);
  const word=await openZip(await exportDocx(d));assert.match(await word.file('word/styles.xml')!.async('string'),/w:before="240"/);assert.match(await word.file('word/styles.xml')!.async('string'),/w:hanging="283"/);
  const odt=await openZip(await exportOdt(d));assert.match(await odt.file('content.xml')!.async('string'),/fo:margin-top="12pt"/);assert.match(await odt.file('content.xml')!.async('string'),/fo:keep-with-next="always"/);
  d.styles.normal.indentLeftMm=-1;assert.throws(()=>validateDocument(d),/Absatzvorlage/);
});
