import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mediaUsersForScope} from '../public/media-utils.js';

const people=[
 {id:'arf-manager',full_name:'Manager ARF'},
 {id:'arf-coordinator',full_name:'Koordinator ARF'},
 {id:'school-a',full_name:'Koordinator Sekolah A'},
 {id:'school-b',full_name:'Koordinator Sekolah B'},
 {id:'legacy-arf',full_name:'Pembuat ARF lama'},
 {id:'legacy-school',full_name:'PIC Sekolah lama'},
 {id:'planner-only',full_name:'Pengguna Planner'},
 {id:'inactive-school',full_name:'Koordinator Sekolah Nonaktif'}
];
const members=[
 {user_id:'arf-manager',role:'ARF_MANAGER',school_id:null,active:true},
 {user_id:'arf-coordinator',role:'ARF_MEDIA_COORDINATOR',school_id:null,active:true},
 {user_id:'school-a',role:'SCHOOL_MEDIA_COORDINATOR',school_id:'A',active:true},
 {user_id:'school-b',role:'SCHOOL_MEDIA_COORDINATOR',school_id:'B',active:true},
 {user_id:'inactive-school',role:'SCHOOL_MEDIA_COORDINATOR',school_id:'A',active:false}
];
const contents=[
 {scope:'ARF',school_id:null,created_by:'arf-coordinator',assigned_to:'legacy-arf'},
 {scope:'SCHOOL',school_id:'A',created_by:'arf-coordinator',assigned_to:'school-a'},
 {scope:'SCHOOL',school_id:'A',created_by:'school-a',assigned_to:'legacy-school'},
 {scope:'SCHOOL',school_id:'B',created_by:'school-b',assigned_to:'arf-manager'},
 {scope:'ARF',school_id:null,created_by:'school-b',assigned_to:'arf-manager'},
 {scope:'ARF',school_id:null,created_by:'planner-only',assigned_to:'arf-manager',archived_at:'2026-01-01'}
];
const ids=(scope,schoolId='')=>mediaUsersForScope(people,members,contents,scope,schoolId).map(p=>p.id);

test('ALL includes ARF and all school members, plus participants of active content, but not unrelated Planner accounts',()=>{
 assert.deepEqual(ids('ALL'),[
 'arf-manager','arf-coordinator','school-a','school-b','legacy-arf','legacy-school'
 ]);
});

test('ARF includes only Foundation-affiliated users and ARF-only legacy participants',()=>{
 assert.deepEqual(ids('ARF'),['arf-manager','arf-coordinator','legacy-arf']);
 assert.ok(!ids('ARF').includes('school-b'),'A school member editing ARF content does not become ARF member');
});

test('SCHOOL includes coordinators across every school, without ARF-only users',()=>{
 assert.deepEqual(ids('SCHOOL'),['school-a','school-b','legacy-school']);
 assert.ok(!ids('SCHOOL').includes('arf-coordinator'),'An ARF author of school content remains ARF-scoped');
});

test('Selecting a particular institution narrows both SCHOOL and ALL user dropdowns to that school',()=>{
 assert.deepEqual(ids('SCHOOL','A'),['school-a','legacy-school']);
 assert.deepEqual(ids('ALL','A'),['school-a','legacy-school']);
 assert.deepEqual(ids('SCHOOL','B'),['school-b']);
 assert.deepEqual(ids('ALL','B'),['school-b']);
});

test('Users with no content remain selectable based on membership; inactive users with no content are excluded',()=>{
 assert.deepEqual(mediaUsersForScope(people,members,[], 'ARF').map(x=>x.id),['arf-manager','arf-coordinator']);
 assert.deepEqual(mediaUsersForScope(people,members,[], 'SCHOOL').map(x=>x.id),['school-a','school-b']);
 assert.throws(()=>mediaUsersForScope(people,members,[], 'UNKNOWN'));
});

test('All five requested content views share the same scoped options and dependent resets',()=>{
 const source=readFileSync(new URL('../public/media-hub.js',import.meta.url),'utf8');
 for(const menu of ['Content Workspace','Content Calendar','Content Table','Published Content','Performance Analytics'])
  assert.ok(source.includes("'"+menu+"'"),menu);
 assert.ok(source.includes('const scopedFilterUsers=()=>mediaUsersForScope('));
 assert.match(source,/const availableUsers=isContent\?scopedFilterUsers\(\):\[\];/);
 assert.match(source,/if\(n==='filter_school'\)\{M\.school=e\.target\.value;M\.userFilter='';render\(\);\}/);
 assert.match(source,/if\(n==='filter_scope'\)\{[\s\S]{0,310}M\.school='';M\.userFilter='';render\(\);/);
 assert.match(source,/if\(contentFiltered\(\)&&M\.userFilter&&!scopedFilterUsers\(\)\.some\(p=>p\.id===M\.userFilter\)\)/);
 assert.ok(source.includes('options(M.schools,M.school,'));
 assert.ok(source.includes("if(contentFiltered()&&M.scope==='ARF'&&c.scope!=='ARF')"));
 assert.ok(source.includes("if(contentFiltered()&&M.scope==='SCHOOL'&&c.scope!=='SCHOOL')"));
});
