import test from 'node:test';
import assert from 'node:assert/strict';
import {createMediaPerformanceXlsx} from '../public/media-export.js';

function unpackStoreZip(bytes){
 const buffer=Buffer.from(bytes),files=new Map();let offset=0;
 while(offset+30<=buffer.length&&buffer.readUInt32LE(offset)===0x04034b50){
  const length=buffer.readUInt16LE(offset+26),extra=buffer.readUInt16LE(offset+28),size=buffer.readUInt32LE(offset+18);
  const filename=buffer.subarray(offset+30,offset+30+length).toString('utf8');
  const content=buffer.subarray(offset+30+length+extra,offset+30+length+extra+size).toString('utf8');
  files.set(filename,content);offset+=30+length+extra+size;
 }
 return files;
}
test('Media XLSX is a complete Office workbook with styles and data instead of invalid styled cells',()=>{
 const rows=[
 {school:{name:'SDS Pendidikan & Pembelajaran',regional:'R1'},ig:2,quotaIG:2,tt:1,quotaTT:2,pending:1,eligible:true,score:75},
 {school:{name:'TK Learning',regional:'R2'},ig:0,quotaIG:0,tt:0,quotaTT:0,pending:0,eligible:false,score:null}
 ];
 const bytes=createMediaPerformanceXlsx(rows,'2026-11-23');
 assert.ok(bytes.length>2000);
 const parts=unpackStoreZip(bytes);
 for(const path of ['[Content_Types].xml','_rels/.rels','xl/workbook.xml','xl/_rels/workbook.xml.rels','xl/styles.xml','xl/worksheets/sheet1.xml']){
  assert.ok(parts.has(path),'Missing OOXML part '+path);
 }
 const sheet=parts.get('xl/worksheets/sheet1.xml');
 const styles=parts.get('xl/styles.xml');
 assert.ok(sheet.includes('SDS Pendidikan &amp; Pembelajaran'));
 assert.ok(sheet.includes('Media Performance')===false);
 assert.ok(sheet.includes('Minggu WIB'));
 assert.ok(sheet.includes('2026-11-23'));
 assert.ok(sheet.includes('N/A'));
 assert.ok(sheet.includes('75'));
 assert.ok(sheet.includes('A1'));
 assert.match(styles,/<cellXfs count="2">/);
 assert.match(parts.get('xl/_rels/workbook.xml.rels'),/Target="styles.xml"/);
 assert.match(parts.get('[Content_Types].xml'),/xl\/styles.xml/);
 assert.match(parts.get('xl/workbook.xml'),/Media Performance/);
});
test('Media XLSX allows empty school report without malformed ZIP',()=>{
 const parts=unpackStoreZip(createMediaPerformanceXlsx([],'2026-11-23'));
 const sheet=parts.get('xl/worksheets/sheet1.xml');
 assert.ok(sheet.includes('<row r="1">'));
 assert.ok(!sheet.includes('<row r="2">'));
});
