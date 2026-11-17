import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as core from '../core.js';

const KEY='final-tracker-v1',RECOVERY_KEY=KEY+'-recovery';
const appSource=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const imports=appSource.match(/^import\s*\{([^}]+)\}/)[1];
const source=`const {${imports}}=__core;\n`+appSource.replace(/^import[^\n]+\r?\n/,'').replace(/\bboot\(\);\s*$/,'')+`
render=()=>{__renders.count++;};toast=(message,error=false)=>{__toasts.push({message,error});};
globalThis.audit={getSaved:()=>saved,getRecoveryCopies:()=>recoveryCopies,persist,recoveryNotice,exportRecovery,applyCatalog,saveTask,openTask,setHistory:value=>history=value};`;
const record=(id='1900A',extra={})=>core.validateTask({platform:'cf',id,name:id,rating:1800,ratingSource:'official',mode:'own',date:core.today(),tags:['trees'],...extra});
const body=tasks=>({app:'final-tracker',version:1,tasks,settings:core.DEFAULT_SETTINGS,year:2026});
const stored=shared=>JSON.parse(shared.get(KEY));

// Runs the actual app functions against a small DOM/storage double; it never opens a browser.
function app(shared=new Map(),{rejectRecovery=false,locks,storageHooks={}}={}){
 const elements=new Map(),listeners=new Map(),downloads=[],urls=new Map(),renders={count:0},toasts=[];
 const field=selector=>{if(!elements.has(selector))elements.set(selector,{value:'',hidden:false,textContent:'',innerHTML:'',files:[],classList:{toggle(){},add(){},remove(){}},addEventListener(type,fn){listeners.set(selector+':'+type,fn);},close(){this.open=false;},showModal(){this.open=true;},focus(){}});return elements.get(selector);};
 const topics=Object.keys(core.TOPICS).filter(k=>k!=='other').map(value=>({value,checked:false}));
 field('#task-form').elements={platform:{value:'cf'},mode:{value:'own'}};
 field('#task-form').reset=()=>{field('#task-form').elements.platform.value='cf';field('#task-form').elements.mode.value='own';for(const id of ['task-query','task-id','task-name','task-rating','task-date','task-minutes','task-notes'])field('#'+id).value='';topics.forEach(t=>t.checked=false);};
 class AppURL extends URL{static createObjectURL(blob){const url='blob:test-'+urls.size;urls.set(url,blob);return url;}static revokeObjectURL(url){urls.delete(url);}}
 const sandbox={__core:core,__renders:renders,__toasts:toasts,console,Date,JSON,Map,Blob,URL:AppURL,navigator:{locks},setTimeout:()=>0,clearTimeout(){},location:{hash:'#overview'},localStorage:{getItem:k=>{const value=shared.get(k)??null;storageHooks.onRead?.(k);return value;},setItem:(k,v)=>{if(rejectRecovery&&k===RECOVERY_KEY)throw Error('Quota');shared.set(k,String(v));}},document:{querySelector:field,querySelectorAll:selector=>selector==='input[name=topic]'?topics:selector==='input[name=topic]:checked'?topics.filter(t=>t.checked):[],addEventListener(type,fn){listeners.set('document:'+type,fn);},createElement(){return {click(){downloads.push({filename:this.download,blob:urls.get(this.href)});}};}},window:{addEventListener(type,fn){listeners.set('window:'+type,fn);},scrollTo(){}}};
 vm.createContext(sandbox);vm.runInContext(source,sandbox,{filename:'app.js'});
 return {...sandbox,field,listeners,downloads,renders,toasts,storageEvent:()=>listeners.get('window:storage')({key:KEY,newValue:shared.get(KEY)??null})};
}

function manualLocks(){const pending=[];return {pending,request(name,callback){return new Promise((resolve,reject)=>pending.push({name,callback,resolve,reject}));},async release(){const item=pending.shift();assert.ok(item,'expected a queued lock request');try{item.resolve(await item.callback());}catch(error){item.reject(error);}}};}

test('damaged local journals retain valid records and expose an exact downloadable original',async()=>{
 const raw=JSON.stringify(body([record('1900A',{notes:'keep me'}),{...record('1900B'),rating:1801}]));
 const shared=new Map([[KEY,raw]]),ctx=app(shared);
 assert.equal(ctx.audit.getSaved().tasks.length,1);
 assert.equal(shared.get(KEY),raw,'boot must not overwrite the working key');
 assert.equal(JSON.parse(shared.get(RECOVERY_KEY))[0].raw,raw);
 assert.match(ctx.audit.recoveryNotice(),/data-action="export-recovery"/);
 ctx.audit.exportRecovery();assert.equal(await ctx.downloads[0].blob.text(),raw);
 ctx.audit.persist({...ctx.audit.getSaved(),year:2024});
 assert.equal(stored(shared).tasks[0].notes,'keep me');assert.equal(stored(shared).tasks.length,1);
 assert.equal(JSON.parse(shared.get(RECOVERY_KEY))[0].raw,raw);
});

test('recovery quota failures block working-key overwrites while the original remains downloadable',async()=>{
 const raw=JSON.stringify(body([record(),{...record('1900B'),rating:1801}]));
 const shared=new Map([[KEY,raw]]),ctx=app(shared,{rejectRecovery:true});
 assert.throws(()=>ctx.audit.persist({...ctx.audit.getSaved(),year:2024}),/не перезаписан/);
 assert.equal(shared.get(KEY),raw);ctx.audit.exportRecovery();assert.equal(await ctx.downloads[0].blob.text(),raw);
});

test('multiple original copies survive repeated independent repairs',()=>{
 const first=JSON.stringify(body([{...record(),rating:1801}]));
 const shared=new Map([[KEY,first]]),ctx=app(shared);
 const second='{ broken but different';shared.set(KEY,second);
 ctx.audit.persist({...ctx.audit.getSaved(),year:2024});
 const copies=JSON.parse(shared.get(RECOVERY_KEY));assert.equal(copies.length,2);assert.equal(copies[0].raw,first);assert.equal(copies[1].raw,second);
});

test('canonical aliases in old journals are recovered once, with both originals available in the copy',()=>{
 const first=record('1827A',{notes:'first note'}),alias={...first,id:'01827A',uid:'cf:01827A',notes:'second note'};
 const raw=JSON.stringify(body([first,alias])),shared=new Map([[KEY,raw]]),ctx=app(shared);
 assert.equal(ctx.audit.getSaved().tasks.length,1);assert.equal(ctx.audit.getSaved().tasks[0].uid,'cf:1827A');
 assert.match(ctx.audit.recoveryNotice(),/Объединено дублей одного номера: 1/);
 assert.equal(JSON.parse(shared.get(RECOVERY_KEY))[0].raw,raw);
 ctx.audit.persist({...ctx.audit.getSaved(),year:2024});assert.equal(core.parseBackup(shared.get(KEY)).tasks.length,1);
});

test('stale tabs merge independent additions and do not resurrect another tab’s explicit deletion',()=>{
 const shared=new Map([[KEY,JSON.stringify(body([record('1900A')]))]]),one=app(shared),two=app(shared),three=app(shared);
 one.audit.persist({...one.audit.getSaved(),tasks:[...one.audit.getSaved().tasks,record('1900B')]});
 two.audit.persist({...two.audit.getSaved(),tasks:[...two.audit.getSaved().tasks,record('1900C')]});
 assert.deepEqual(stored(shared).tasks.map(t=>t.id).sort(),['1900A','1900B','1900C']);
 one.audit.persist({...one.audit.getSaved(),tasks:one.audit.getSaved().tasks.filter(t=>t.id!=='1900A')});
 three.audit.persist({...three.audit.getSaved(),tasks:[...three.audit.getSaved().tasks,record('1900D')]});
 assert.deepEqual(stored(shared).tasks.map(t=>t.id).sort(),['1900B','1900C','1900D']);
});

test('stale edits preserve unrelated field changes and settings from another tab',()=>{
 const shared=new Map([[KEY,JSON.stringify(body([record()]))]]),one=app(shared),two=app(shared);
 one.audit.persist({...one.audit.getSaved(),tasks:[{...one.audit.getSaved().tasks[0],notes:'from tab one'}],settings:{...one.audit.getSaved().settings,spread:130}});
 two.audit.persist({...two.audit.getSaved(),tasks:[{...two.audit.getSaved().tasks[0],rating:1900,ratingSource:'estimate'}],settings:{...two.audit.getSaved().settings,statsWeight:0.4},year:2024});
 const state=stored(shared);assert.equal(state.tasks[0].notes,'from tab one');assert.equal(state.tasks[0].rating,1900);assert.equal(state.settings.spread,130);assert.equal(state.settings.statsWeight,0.4);assert.equal(state.year,2024);
});

test('Web Locks serialize a second tab starting between the first read and write',async()=>{
 const shared=new Map([[KEY,JSON.stringify(body([record('1900A')]))]]),locks=manualLocks(),storageHooks={};
 const one=app(shared,{locks,storageHooks}),two=app(shared,{locks});let secondWrite;
 storageHooks.onRead=key=>{if(key===KEY){storageHooks.onRead=null;secondWrite=two.audit.persist({...two.audit.getSaved(),tasks:[...two.audit.getSaved().tasks,record('1900C')]});}};
 const firstWrite=one.audit.persist({...one.audit.getSaved(),tasks:[...one.audit.getSaved().tasks,record('1900B')]});
 assert.equal(stored(shared).tasks.length,1,'storage must only be read and written after the lock is granted');
 await locks.release();await firstWrite;assert.equal(locks.pending.length,1);assert.equal(locks.pending[0].name,KEY+'-write');
 await locks.release();await secondWrite;
 assert.deepEqual(stored(shared).tasks.map(t=>t.id).sort(),['1900A','1900B','1900C']);
});

test('queued writes capture the original baseline and desired journal before waiting for a lock',async()=>{
 const shared=new Map([[KEY,JSON.stringify(body([record('1900A')]))]]),locks=manualLocks(),one=app(shared,{locks}),two=app(shared,{locks});
 const first=one.audit.persist({...one.audit.getSaved(),tasks:[...one.audit.getSaved().tasks,record('1900B')]});
 const desired={...two.audit.getSaved(),tasks:[...two.audit.getSaved().tasks,record('1900C')]},second=two.audit.persist(desired);
 desired.tasks.push(record('1900D'));
 await locks.release();await first;two.storageEvent();
 await locks.release();await second;
 assert.deepEqual(stored(shared).tasks.map(t=>t.id).sort(),['1900A','1900B','1900C']);
});

test('saving waits for the lock, blocks double submit, and enables the button after completion',async()=>{
 const shared=new Map(),locks=manualLocks(),ctx=app(shared,{locks});ctx.audit.openTask();
 ctx.audit.applyCatalog({platform:'cf',id:'1827A',name:'Counting Orders',rating:1100,tags:['search']});
 const save=ctx.audit.saveTask({preventDefault(){}});await ctx.audit.saveTask({preventDefault(){}});
 assert.equal(ctx.field('#save-task').disabled,true);assert.equal(ctx.field('#task-dialog').open,true);assert.equal(locks.pending.length,1);assert.equal(ctx.toasts.length,0);
 await locks.release();await save;
 assert.equal(ctx.field('#save-task').disabled,false);assert.equal(ctx.field('#task-dialog').open,false);assert.equal(stored(shared).tasks.length,1);
});

test('simultaneous conflicting additions of one task are reported instead of overwriting notes',()=>{
 const shared=new Map([[KEY,JSON.stringify(body([]))]]),one=app(shared),two=app(shared);
 one.audit.persist({...one.audit.getSaved(),tasks:[record('1900A',{notes:'first writer'})]});
 assert.throws(()=>two.audit.persist({...two.audit.getSaved(),tasks:[record('1900A',{notes:'other writer'})]}),/добавили в другой вкладке/);
 assert.equal(stored(shared).tasks[0].notes,'first writer');
});

test('storage events update loaded state without early rendering or resetting an open form',()=>{
 const shared=new Map([[KEY,JSON.stringify(body([record()]))]]),one=app(shared),two=app(shared);
 two.audit.openTask('cf:1900A');two.field('#task-notes').value='unsaved local note';
 one.audit.persist({...one.audit.getSaved(),tasks:[{...one.audit.getSaved().tasks[0],notes:'remote note'}]});
 two.storageEvent();assert.equal(two.renders.count,0);assert.equal(two.audit.getSaved().tasks[0].notes,'remote note');assert.equal(two.field('#task-notes').value,'unsaved local note');
 two.audit.setHistory([{}, {}, {}]);two.storageEvent();assert.equal(two.renders.count,1);assert.equal(two.field('#task-notes').value,'unsaved local note');
});

test('saving an open stale form cannot resurrect a remotely deleted task, even after a storage event',async()=>{
 for(const dispatchEvent of [false,true]){
  const shared=new Map([[KEY,JSON.stringify(body([record()]))]]),one=app(shared),two=app(shared);
  two.audit.openTask('cf:1900A');two.field('#task-notes').value='pending edit';
  one.audit.persist({...one.audit.getSaved(),tasks:[]});if(dispatchEvent)two.storageEvent();
  await two.audit.saveTask({preventDefault(){}});assert.equal(stored(shared).tasks.length,0);assert.match(two.field('#task-error').textContent,/удалили в другой вкладке/);
 }
});

test('changing a selected task ID cannot retain the old official rating provenance',async()=>{
 const shared=new Map(),ctx=app(shared);ctx.audit.applyCatalog({platform:'cf',id:'1827A',name:'Counting Orders',rating:1100,tags:['search']});
 ctx.field('#task-id').value='1900C';ctx.field('#task-name').value="Anji's Binary Tree";ctx.field('#task-date').value=core.today();
 await ctx.audit.saveTask({preventDefault(){}});assert.equal(stored(shared).tasks[0].id,'1900C');assert.equal(stored(shared).tasks[0].ratingSource,'estimate');
});

test('editing only notes or a canonical spelling keeps genuine official provenance',async()=>{
 const shared=new Map([[KEY,JSON.stringify(body([record('1827A',{rating:1100})]))]]),ctx=app(shared);
 ctx.audit.openTask('cf:1827A');ctx.field('#task-id').value='01827A';ctx.field('#task-notes').value='new note';
 await ctx.audit.saveTask({preventDefault(){}});const task=stored(shared).tasks[0];assert.equal(task.id,'1827A');assert.equal(task.ratingSource,'official');assert.equal(task.notes,'new note');
});
