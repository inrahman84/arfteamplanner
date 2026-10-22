import test from 'node:test';
import assert from 'node:assert/strict';

test('app boot, all 7 views render, task form opens (dependency-free browser DOM smoke)',async()=>{
  const db=new Map();const listeners={};
  globalThis.window={__WORKFLOW_CONFIG__:{supabaseUrl:'',supabaseAnonKey:''},scrollTo:()=>{},addEventListener:()=>{}};
  globalThis.location={search:''};
  globalThis.localStorage={getItem:k=>db.get(k)||null,setItem:(k,v)=>db.set(k,v),removeItem:k=>db.delete(k)};
  const appRoot={innerHTML:''},modalRoot={innerHTML:''};
  globalThis.document={
    getElementById:id=>id==='app'?appRoot:null,
    querySelector:q=>q==='#modal-root'?modalRoot:null,
    addEventListener:(type,cb)=>{listeners[type]=cb},
    createElement:()=>({remove:()=>{}}),body:{append:()=>{}}
  };
  await import('../public/app.js');
  await new Promise(r=>setTimeout(r,30));
  assert.match(appRoot.innerHTML,/Workspace Overview/);
  const nav=async view=>{const el={dataset:{action:'nav',view}};await listeners.click({target:{closest:()=>el}});};
  for(const [view,term] of [['Board','Kanban Board'],['Grid','Grid View'],['Gantt','Timeline / Gantt'],['Calendar','Calendar'],['Team','Team Members'],['Settings','Workspace Settings'],['Dashboard','Workspace Overview']]){
    await nav(view);assert.ok(appRoot.innerHTML.includes(term),`${view} should render`);
  }
  const create={dataset:{action:'new-task'}};
  await listeners.click({target:{closest:()=>create}});
  assert.match(modalRoot.innerHTML,/name="title"/);
  assert.match(modalRoot.innerHTML,/Key Stakeholders/);
  assert.match(modalRoot.innerHTML,/Due Date/);
});
