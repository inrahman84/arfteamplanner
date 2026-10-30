// Grid View report export: native XLSX workbook and client-side PDF.
 // All Work Item data remains in the browser.
import {projectIds,safeColor} from './core.js';
import {normalizeGanttRange,zipFiles,xmlCell} from './gantt-export.js';
import {loadJsPDF} from './pdf-report.js';

const xmlEscape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
const latin=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[\u2013\u2014]/g,'-').replace(/[^\x20-\x7E]/g,'?');
const colName=i=>{let s='';for(let n=i;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s};
const short=(value,max)=>{const str=latin(value);return str.length>max?str.slice(0,max-3)+'...':str};
const selectedTaskDates=task=>{
 const start=task.start_date||task.due_date,end=task.due_date||task.start_date;
 return start&&end?[start<=end?start:end,start<=end?end:start]:null;
};
export function taskInGridPeriod(task,from,to){
 const dates=selectedTaskDates(task);
 return Boolean(dates&&dates[0]<=to&&dates[1]>=from);
}
export function buildGridExportData({tasks=[],projects=[],people=[],categories=[],selectedProjectIds=[],includeUnassigned=false,projectOrder=[],...period}){
 const range=normalizeGanttRange(period);
 if(!['xlsx','pdf'].includes(period.format))throw Error('Pilih format XLSX atau PDF.');
 if(!Array.isArray(selectedProjectIds))throw Error('Pilih Project menggunakan checklist.');
 const projectMap=new Map(projects.map(p=>[p.id,p])),ids=[...new Set(selectedProjectIds)];
 if(ids.some(id=>!projectMap.has(id)))throw Error('Pilihan Project tidak valid. Muat ulang halaman.');
 if(!ids.length&&!includeUnassigned)throw Error('Centang setidaknya satu Project atau Tanpa Project.');
 const rank=new Map(projectOrder.map((id,i)=>[id,i]));
 const choices=ids.map(id=>projectMap.get(id)).sort((a,b)=>{
  const ra=rank.get(a.id),rb=rank.get(b.id);
  if(ra!==undefined||rb!==undefined)return (ra??999999)-(rb??999999);
  return a.name.localeCompare(b.name,'id');
 });
 const filtered=tasks.filter(t=>taskInGridPeriod(t,range.startDate,range.endDate));
 const peopleMap=new Map(people.map(p=>[p.id,p.full_name||p.name||'']));
 const categoryMap=new Map(categories.map(c=>[c.id,c.name||'']));
 const groups=[];
 const allNames=t=>projectIds(t).map(id=>projectMap.get(id)?.name).filter(Boolean).join(', ')||'Tanpa Project';
 const rowFor=t=>({
  id:t.id,title:String(t.title||''),assignedBy:peopleMap.get(t.assigned_by)||'—',
  assignedTo:peopleMap.get(t.assigned_to)||'—',category:categoryMap.get(t.category_id)||'—',
  status:t.status||'Not Started',priority:t.priority||'Medium',
  startDate:t.start_date||'',dueDate:t.due_date||'',
  allProjects:allNames(t),task:t
 });
 for(const project of choices){
  const rows=filtered.filter(t=>projectIds(t).includes(project.id)).map(rowFor);
  if(rows.length)groups.push({id:project.id,name:project.name,color:safeColor(project.color),rows});
 }
 if(includeUnassigned){
  const rows=filtered.filter(t=>!projectIds(t).length).map(rowFor);
  if(rows.length)groups.push({id:'__unassigned__',name:'Tanpa Project',color:'#5f5d5d',rows});
 }
 const taskCount=new Set(groups.flatMap(g=>g.rows.map(r=>r.id))).size;
 const rowCount=groups.reduce((n,g)=>n+g.rows.length,0);
 if(rowCount>25000)throw Error('Laporan terlalu besar. Persempit periode atau jumlah Project (maksimal 25.000 baris).');
 return {range,groups,taskCount,rowCount,projectCount:ids.length+(includeUnassigned?1:0),
  selectionNames:[...choices.map(p=>p.name),...(includeUnassigned?['Tanpa Project']:[])],
  headers:['Work Item','Assigned By','Assigned To','Category','Status','Priority','Start Date','Due Date','Project(s)']
 };
}
export function createGridXlsx(data,workspaceName='Workspace'){
 const rows=[],merges=[],lastColumn='I';
 const put=(n,cells)=>rows.push('<row r="'+n+'">'+cells.join('')+'</row>');
 put(1,[xmlCell('WORKFLOW PLANNER — GRID VIEW REPORT','A1',1)]);
 merges.push('A1:I1');
 put(2,[xmlCell('Workspace: '+workspaceName,'A2',0),xmlCell('Periode: '+data.range.startDate+' — '+data.range.endDate,'E2',0)]);
 merges.push('A2:D2','E2:I2');
 put(3,[xmlCell('Projects: '+data.selectionNames.join(', '),'A3',0)]);
 merges.push('A3:I3');
 put(4,[xmlCell('Unique Work Items: '+data.taskCount+' | Rows: '+data.rowCount,'A4',0)]);
 merges.push('A4:I4');
 put(5,[xmlCell('Multi-Project Work Items may appear under more than one Project; unique count excludes duplicates.','A5',0)]);
 merges.push('A5:I5');
 put(7,data.headers.map((h,i)=>xmlCell(h,colName(i+1)+'7',2)));
 let n=7;
 for(const group of data.groups){
  n++;
  put(n,[xmlCell(group.name+' ('+group.rows.length+' Work Items)','A'+n,3)]);
  merges.push('A'+n+':I'+n);
  for(const item of group.rows){
   n++;
   const fields=[item.title,item.assignedBy,item.assignedTo,item.category,item.status,item.priority,item.startDate,item.dueDate,item.allProjects];
   const styles=fields.map((v,i)=>i===4?({'Completed':4,'In Progress':5,'On Hold':6,'Not Started':7}[v]||0):0);
   put(n,fields.map((v,i)=>xmlCell(v,colName(i+1)+n,styles[i])));
  }
 }
 if(!data.groups.length){n++;put(n,[xmlCell('No Work Items for this selection and period.','A'+n)]);merges.push('A'+n+':I'+n);}
 const widths=[49,24,24,21,18,16,16,16,42];
 const cols=widths.map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join('');
 const mergesXml='<mergeCells count="'+merges.length+'">'+merges.map(ref=>'<mergeCell ref="'+ref+'"/>').join('')+'</mergeCells>';
 const sheet='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:'+lastColumn+n+'"/><sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="7" topLeftCell="A8" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>'+cols+'</cols><sheetData>'+rows.join('')+'</sheetData>'+mergesXml+'</worksheet>';
 const colors=['073B2D','DAE9DF','F6F3EC','DFF4E7','E7F1F6','FFF0D9','F1F0ED'];
 const fills=['<fill><patternFill patternType="none"/></fill>','<fill><patternFill patternType="gray125"/></fill>',...colors.map(color=>'<fill><patternFill patternType="solid"><fgColor rgb="FF'+color+'"/><bgColor indexed="64"/></patternFill></fill>')];
 const stylesToFill=[0,2,3,4,5,6,7,8];
 const xfs=stylesToFill.map((fill,i)=>'<xf numFmtId="0" fontId="'+(i===1||i===2||i===3?1:0)+'" fillId="'+fill+'" borderId="0" xfId="0" applyFill="'+(fill?1:0)+'" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>');
 const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><name val="Calibri"/></font></fonts><fills count="'+fills.length+'">'+fills.join('')+'</fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="'+xfs.length+'">'+xfs.join('')+'</cellXfs></styleSheet>';
 const wb='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Grid View" sheetId="1" r:id="rId1"/></sheets></workbook>';
 const rel='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
 const rootRel='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
 const types='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';
 return zipFiles([['[Content_Types].xml',types],['_rels/.rels',rootRel],['xl/workbook.xml',wb],['xl/_rels/workbook.xml.rels',rel],['xl/styles.xml',styles],['xl/worksheets/sheet1.xml',sheet]]);
}
export function downloadGridXLSX(data,workspaceName='Workspace'){
 const bytes=createGridXlsx(data,workspaceName);
 const filename='workflow-grid-'+data.range.startDate+'-'+data.range.endDate+'.xlsx';
 const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
 return {filename,rows:data.rowCount,workItems:data.taskCount,bytes:bytes.length};
}
export async function downloadGridPDF(data,workspaceName='Workspace'){
 const JsPDF=await loadJsPDF();
 const doc=new JsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
 const left=10,pageWidth=297,right=287,columns=[69,28,28,26,24,17,24,24,37],heads=['Work Item','Assigned By','Assigned To','Category','Status','Priority','Start','Due','Projects'];
 const rgb=hex=>[1,3,5].map(i=>parseInt(safeColor(hex).slice(i,i+2),16));
 let page=0,y=0;
 function text(value,x,y,font=7){doc.setFontSize(font);doc.text(short(value,140),x,y);}
 function header(){
  page++;y=12;doc.setFillColor(7,59,45);doc.rect(left,9,right-left,14,'F');
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');text('WORKFLOW PLANNER  /  GRID REPORT',left+4,17,12);
  doc.setTextColor(7,59,45);doc.setFont('helvetica','normal');y=29;
  text('Workspace: '+short(workspaceName,45)+'    |    Periode: '+data.range.startDate+' to '+data.range.endDate,left,y,8);
  y+=5;doc.setFont('helvetica','bold');text('Project selection: '+short(data.selectionNames.join(', '),130),left,y,7.3);
  y+=5;doc.setFont('helvetica','normal');text('Unique Work Items: '+data.taskCount+'   |   Rows: '+data.rowCount+'   |   Page: '+page,left,y,7);
  y+=7;doc.setFillColor(224,235,228);doc.rect(left,y-4,right-left,8,'F');
  doc.setFont('helvetica','bold');doc.setTextColor(7,59,45);
  let x=left;heads.forEach((name,i)=>{text(name,x+2,y+1,6.6);x+=columns[i]});
  y+=8;
 }
 header();
 let rowIndex=0;
 for(const group of data.groups){
  if(y>190){doc.addPage();header()}
  doc.setFillColor(...rgb(group.color));doc.rect(left,y,right-left,7,'F');
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');
  text(short(group.name,75)+'  ('+group.rows.length+' Work Items)',left+2,y+4.8,7.5);y+=7;
  for(const item of group.rows){
   if(y>195){doc.addPage();header();doc.setFont('helvetica','bold');text(short(group.name,65)+' (continued)',left+2,y+4,7);y+=6;}
   if(rowIndex%2===0){doc.setFillColor(246,248,245);doc.rect(left,y,right-left,7,'F');}
   doc.setTextColor(37,58,45);doc.setFont('helvetica','normal');
   const vals=[short(item.title,44),short(item.assignedBy,18),short(item.assignedTo,18),short(item.category,16),short(item.status,15),short(item.priority,11),item.startDate||'-',item.dueDate||'-',short(item.allProjects,25)];
   let x=left;vals.forEach((value,i)=>{text(value,x+2,y+4.7,6.3);x+=columns[i]});
   y+=7;rowIndex++;
  }
 }
 if(!data.groups.length){doc.setTextColor(95,93,93);text('No Work Items match the selected Projects and period.',left+3,y+5,9);}
 const filename='workflow-grid-'+data.range.startDate+'-'+data.range.endDate+'.pdf';
 doc.save(filename);
 return {filename,rows:data.rowCount,workItems:data.taskCount,pages:page};
}
