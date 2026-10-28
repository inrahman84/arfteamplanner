import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseUserColor,colorToRGB} from '../public/core.js';
import {normalizeGanttRange,ganttBuckets,buildGanttRows,buildGanttExportData,createGanttXlsx,downloadGanttPDF} from '../public/gantt-export.js';

test('Project/Category color picker supports HEX, RGB, shorthand and rejects invalid channels',()=>{
 assert.equal(parseUserColor('#3F6276'),'#3f6276');
 assert.equal(parseUserColor('3f6276'),'#3f6276');
 assert.equal(parseUserColor('#abc'),'#aabbcc');
 assert.equal(parseUserColor('rgb(63, 98, 118)'),'#3f6276');
 assert.equal(parseUserColor('63, 98, 118'),'#3f6276');
 assert.equal(parseUserColor('0, 155, 76'),'#009b4c');
 assert.equal(colorToRGB('#3f6276'),'63, 98, 118');
 assert.throws(()=>parseUserColor('256, 0, 0'),/0–255/);
 assert.throws(()=>parseUserColor('javascript:alert(1)'),/HEX/);
});

const projects=[{id:'p1',name:'Programme A',color:'#073b2d'},{id:'p2',name:'Programme B',color:'#c89b55'}];
const tasks=[
 {id:'t1',project_id:'p1',project_ids:['p1','p2'],title:'SOP Pengadaan',start_date:'2026-10-20',due_date:'2026-11-10',status:'In Progress'},
 {id:'t2',project_id:'p1',project_ids:['p1'],title:'Review Strategy',start_date:'2026-10-25',due_date:'2026-10-30',status:'Completed'},
 {id:'t3',project_id:'p2',project_ids:['p2'],title:'2027 Roadmap',start_date:'2027-01-01',due_date:'2027-12-31',status:'On Hold'},
 {id:'t4',project_id:null,project_ids:[],title:'Unassigned',start_date:'2026-10-22',due_date:'2026-10-25',status:'Not Started'}
];

test('Gantt export supports exact date ranges, inclusive full years, project filter and overlapping tasks',()=>{
 const date=normalizeGanttRange({startDate:'2026-10-22',endDate:'2026-11-03'});
 assert.deepEqual([date.startDate,date.endDate,date.days],['2026-10-22','2026-11-03',13]);
 assert.equal(ganttBuckets(date).unit,'day');
 const yr=normalizeGanttRange({rangeType:'years',startYear:'2026',endYear:'2027'});
 assert.equal(yr.startDate,'2026-01-01');assert.equal(yr.endDate,'2027-12-31');
 assert.equal(ganttBuckets(yr).unit,'week');
 assert.throws(()=>normalizeGanttRange({startDate:'2026-11-02',endDate:'2026-10-01'}),/valid/);
 assert.throws(()=>normalizeGanttRange({startDate:'2026-02-30',endDate:'2026-03-01'}),/valid/);
 assert.throws(()=>normalizeGanttRange({rangeType:'years',startYear:2026,endYear:2037}),/10 tahun/);
 const report=buildGanttExportData({tasks,projects,startDate:'2026-10-22',endDate:'2026-11-03'});
 assert.equal(report.uniqueTasks,3,'multi-linked tasks are unique in report count');
 assert.deepEqual(report.rows.filter(x=>x.type==='project').map(x=>x.name),['Programme A','Programme B','Tanpa Project']);
 const one=buildGanttExportData({tasks,projects,startDate:'2026-10-22',endDate:'2026-11-03',projectId:'p2'});
 assert.deepEqual(one.rows.filter(x=>x.type==='task').map(x=>x.task.id),['t1']);
 const ordered=buildGanttRows(tasks,projects,date,[{project_id:'p1',task_id:'t2',sort_order:0},{project_id:'p1',task_id:'t1',sort_order:1}],['p2','p1']);
 assert.equal(ordered[0].projectId,'p2');
 assert.deepEqual(ordered.filter(x=>x.type==='task'&&x.projectId==='p1').map(x=>x.task.id),['t2','t1']);
});

function zipTextEntries(binary){
 const buffer=Buffer.from(binary),map=new Map();
 let offset=0;
 while(offset+30<=buffer.length&&buffer.readUInt32LE(offset)===0x04034b50){
  const length=buffer.readUInt16LE(offset+26),extra=buffer.readUInt16LE(offset+28),compressed=buffer.readUInt32LE(offset+18);
  const name=buffer.subarray(offset+30,offset+30+length).toString('utf8');
  const start=offset+30+length+extra;
  map.set(name,buffer.subarray(start,start+compressed).toString('utf8'));
  offset=start+compressed;
 }
 return map;
}

test('XLSX creates valid ZIP Office file parts with real timeline headers and styled status bars',()=>{
 const report=buildGanttExportData({tasks,projects,startDate:'2026-10-01',endDate:'2026-11-30'});
 const bytes=createGanttXlsx(report,'ARF Management');
 assert.ok(bytes instanceof Uint8Array&&bytes.length>3000);
 const parts=zipTextEntries(bytes);
 for(const name of ['[Content_Types].xml','_rels/.rels','xl/workbook.xml','xl/_rels/workbook.xml.rels','xl/styles.xml','xl/worksheets/sheet1.xml'])assert.ok(parts.has(name),name);
 const sheet=parts.get('xl/worksheets/sheet1.xml');
 assert.ok(sheet.includes('SOP Pengadaan'));
 assert.ok(sheet.includes('Programme A'));
 assert.ok(sheet.includes('Completed'));
 assert.ok(sheet.includes('10/2026'));
 assert.ok(sheet.includes('mergeCell'));
 assert.ok(sheet.includes('s="6"'),'in-progress timeline cells styled');
 assert.ok(parts.get('xl/styles.xml').includes('FF009B4C'),'status colors retained in XLSX styles');
 const months=buildGanttExportData({tasks,projects,rangeType:'years',startYear:2026,endYear:2033});
 assert.equal(months.unit,'month');
 assert.ok(createGanttXlsx(months).length>3000);
});

test('PDF writer creates a landscape Gantt with row groups and status bars',async()=>{
 const calls=[];
 class FakePDF{
  constructor(){this.pages=1;}
  addPage(){this.pages++;}
  setFillColor(...x){calls.push(['fill',...x]);}
  rect(...x){calls.push(['rect',...x]);}
  setTextColor(){}
  setFont(){}
  setFontSize(){}
  text(value){calls.push(['text',value]);}
  setDrawColor(){}
  line(){}
  roundedRect(...x){calls.push(['bar',...x]);}
  save(name){this.saved=name;}
 }
 globalThis.jspdf={jsPDF:FakePDF};
 const report=buildGanttExportData({tasks,projects,startDate:'2026-10-01',endDate:'2026-11-30'});
 const out=await downloadGanttPDF(report,'ARF Management');
 assert.ok(out.pages>1);
 assert.match(out.filename,/\.pdf$/);
 assert.ok(calls.some(x=>x[0]==='text'&&x[1].includes('TIMELINE / GANTT')));
 assert.ok(calls.some(x=>x[0]==='text'&&x[1].includes('Programme A')));
 assert.ok(calls.some(x=>x[0]==='bar'));
 delete globalThis.jspdf;
});

test('Forms expose HEX/RGB values, Gantt range mode and PDF/XLSX button; middle aligned circles and months',async()=>{
 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../public/app.css',import.meta.url),'utf8');
 for(const text of ['function colorPickerMarkup','data-color-hex','data-color-rgb','function formColor','ganttExportForm','data-change="gantt-export-period"','rangeType','startYear','endYear','export-gantt','downloadGanttPDF','downloadGanttXLSX','gantt-task-bullet'])assert.ok(app.includes(text),text);
 assert.match(css,/\.gantt-resizable \.gantt-task-row \.gantt-task-label\.gantt-task-child>\.gantt-task-bullet/);
 assert.match(css,/border-radius:50%!important/);
 assert.match(css,/\.gantt-resizable \.gantt-month-cell/);
 assert.match(css,/justify-content:center/);
 assert.match(css,/\.grid-column-layout \.data-table\.grid-resizable tbody tr:not\(\.project-group-row\)>td/);
});
