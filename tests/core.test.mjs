import test from 'node:test';
import assert from 'node:assert/strict';
import {metrics,dayDiff,plusDays,overdue,safe,safeColor,csvExport,today} from '../public/core.js';
test('HTML input is always escaped',()=>{assert.equal(safe('<img src=x onerror="oops">'),'&lt;img src=x onerror=&quot;oops&quot;&gt;');assert.equal(safe("Tom & Alice"),'Tom &amp; Alice');});
test('CSS colors restricted to hex',()=>{assert.equal(safeColor('#073b2d'),'#073b2d');assert.equal(safeColor('red;position:fixed'),'#3f6276');});
test('date calculations handle boundaries',()=>{assert.equal(dayDiff('2026-12-31','2027-01-02'),2);assert.equal(plusDays('2026-12-31',2),'2027-01-02');assert.equal(dayDiff('2026-11-01','2026-11-01'),0);});
test('overdue ignores completed tasks',()=>{assert.equal(overdue({due_date:'2026-01-01',status:'Completed'},'2026-02-01'),false);assert.equal(overdue({due_date:'2026-01-01',status:'In Progress'},'2026-02-01'),true);});
test('dashboard metrics',()=>{const tasks=[{status:'Not Started',due_date:'2026-10-18'},{status:'In Progress',due_date:'2026-10-28'},{status:'Completed',due_date:'2026-10-01'}];assert.deepEqual(metrics(tasks,'2026-10-21'),{total:3,notStarted:1,inProgress:1,onHold:0,completed:1,pending:0,late:1,upcoming:1,percent:33});});
test('CSV correctly escapes commas, quotes, newlines',()=>{const csv=csvExport([{title:'Foo, "Bar"',status:'In Progress',priority:'High',notes:'Line1\nLine2'}],[],[],[]);assert.match(csv,/"Foo, ""Bar"""/);assert.match(csv,/"Line1\nLine2"/);assert.ok(csv.startsWith('\uFEFF'));});
