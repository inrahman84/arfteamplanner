import {metrics,dateLabel,safe,today,projectIds} from './core.js';

// Self-contained, printable report that can be downloaded and retained offline.
// No external scripts, dependencies, or credentials are included.
export function buildReportHTML(tasks,people,categories,projects,workspaceName) {
 const nameById=new Map(people.map(p=>[p.id,p.full_name]));
 const catById=new Map(categories.map(c=>[c.id,c.name]));
 const projectById=new Map(projects.map(p=>[p.id,p.name]));
 const summary=metrics(tasks);
 const counts=[['Total Work Items',summary.total],['Not Started',summary.notStarted],['In Progress',summary.inProgress],['On Hold',summary.onHold],['Completed',summary.completed],['Overdue',summary.late]];
 const rows=tasks.slice().sort((a,b)=>String(a.due_date||'9999').localeCompare(String(b.due_date||'9999'))).map((t,i)=>
   `<tr><td>${i+1}</td><td><b>${safe(t.title)}</b><small>${safe(projectIds(t).map(id=>projectById.get(id)).filter(Boolean).join(', ')||'')}</small></td><td>${safe(nameById.get(t.assigned_to)||'Unassigned')}</td><td>${safe(catById.get(t.category_id)||'—')}</td><td>${safe(t.status)}</td><td>${safe(t.priority)}</td><td>${safe(dateLabel(t.start_date))}</td><td>${safe(dateLabel(t.due_date))}</td><td>${safe(t.notes||'')}</td></tr>`).join('');
 return `<!doctype html><html lang="id"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Laporan WorkFlow Planner - ${safe(workspaceName)}</title><style>
 :root{font-family:Arial,Helvetica,sans-serif;color:#073b2d}*{box-sizing:border-box}body{margin:32px;color:#173f33}h1{margin:0 0 5px;font-size:24px}.sub{color:#60736c;font-size:12px;margin-bottom:24px}.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:9px;margin:20px 0}.kpi{padding:12px;background:#f6f3ec;border:1px solid #e5e8e2;border-radius:8px}.kpi b{font-size:20px;display:block}.kpi span{font-size:10px}table{width:100%;border-collapse:collapse;font-size:10px;table-layout:fixed}th,td{border-bottom:1px solid #ddd;padding:8px 5px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#073b2d;color:white}td small{display:block;color:#666;margin-top:3px}.print{padding:10px 14px;background:#073b2d;color:white;border:0;border-radius:6px;cursor:pointer;margin:15px 0}.footer{margin-top:20px;font-size:10px;color:#666}@page{size:A4 landscape;margin:12mm}@media print{body{margin:0}.print{display:none}.kpi{-webkit-print-color-adjust:exact;print-color-adjust:exact}thead{display:table-header-group}tr{break-inside:avoid}th{background:#073b2d!important;color:white!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
 </style></head><body><h1>Laporan Pekerjaan · ${safe(workspaceName)}</h1><div class="sub">WorkFlow Planner · Dicetak ${safe(dateLabel(today()))} · ${tasks.length} work items sesuai filter aktif</div><div class="kpis">${counts.map(([k,v])=>`<div class="kpi"><b>${v}</b><span>${safe(k)}</span></div>`).join('')}</div><button class="print" onclick="window.print()">Cetak / Simpan sebagai PDF</button><table><thead><tr><th>No</th><th>Work Item / Project</th><th>Assigned To</th><th>Category</th><th>Status</th><th>Priority</th><th>Start Date</th><th>Due Date</th><th>Notes</th></tr></thead><tbody>${rows||'<tr><td colspan="9">Belum ada pekerjaan sesuai filter.</td></tr>'}</tbody></table><div class="footer">Laporan dibuat otomatis oleh WorkFlow Planner. Status pekerjaan mengikuti data ketika laporan dibuat.</div></body></html>`;
}
export function downloadHTMLReport(html,filename='workflow-report.html'){
 const link=document.createElement('a'),url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
 link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
