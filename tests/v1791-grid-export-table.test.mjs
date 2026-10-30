import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/app.css',import.meta.url),'utf8');
const start=app.indexOf('function gridExportModal(){');
const end=app.indexOf('function ganttExportModal(){',start);
const modalCode=app.slice(start,end);
const projects=[
 {id:'p1',name:'EP 1 Strategi Penyelarasan dan Persetujuan',color:'#3f6276'},
 {id:'p2',name:'EP 2 Restrukturisasi Organisasi',color:'#3f6276'},
 {id:'p3',name:'EP 5 Standarisasi Pendidikan 1: Kurikulum dan Standar Pembelajaran',color:'#009b4c'}
];
const modal=new Function('S','selectedProjectIds','safe','safeColor','formField',modalCode+';return gridExportModal')(
 {projects},()=>null,x=>String(x),x=>x,()=>'<input type="text" />');

test('Export Grid selection renders aligned No / Pilih / Nama Project table',()=>{
 const markup=modal();
 assert.match(markup,/<table class="grid-export-project-table" aria-label="Daftar Project untuk ekspor">/);
 for(const header of ['No.','Pilih','Nama Project'])assert.ok(markup.includes('<th scope="col">'+header+'</th>'),header);
 assert.equal((markup.match(/<tbody>/g)||[]).length,1);
 assert.equal((markup.match(/<tr>/g)||[]).length,projects.length+2,'one heading row and one row per project plus Tanpa Project');
 assert.ok(markup.includes('>Tanpa Project</span>'));
 assert.ok(!markup.includes('grid-export-project-option'),'old two-column label layout removed');
});

test('Every Project checkbox keeps name and label association and export selectors',()=>{
 const markup=modal();
 for(const [i,p] of projects.entries()){
  const id='grid-export-project-'+i;
  assert.ok(markup.includes('id="'+id+'" type="checkbox" name="export_project_ids" value="'+p.id+'" checked'),id+' default selected');
  assert.ok(markup.includes('for="'+id+'"'),id+' label association');
  assert.ok(markup.includes(p.name),p.name);
 }
 assert.match(markup,/id="grid-export-unassigned" type="checkbox" name="export_unassigned"/);
 assert.match(markup,/for="grid-export-unassigned"/);
 assert.match(app,/querySelectorAll\('input\[name="export_project_ids"\]:checked'\)/,'existing exporter still reads checkbox values');
 assert.match(app,/case 'grid-export-select-all':case 'grid-export-clear'/,'bulk controls preserved');
});

test('Scoped table CSS overrides general .field input and label styles',()=>{
 assert.match(css,/\.grid-export-project-table\{[^}]*table-layout:fixed/);
 assert.match(css,/\.grid-export-project-table th\{[^}]*position:sticky/);
 assert.match(css,/\.field \.grid-export-project-table input\[type=checkbox\]\{[^}]*min-height:16px/);
 assert.match(css,/\.field \.grid-export-project-table \.grid-export-project-name\{[^}]*display:flex/);
 assert.match(css,/\.field \.grid-export-project-table \.grid-export-project-name\{[^}]*margin:0/);
 assert.match(css,/\.grid-export-project-list\{[^}]*overflow-y:auto/);
 assert.doesNotMatch(css,/\.grid-export-project-list\{display:grid/);
});
