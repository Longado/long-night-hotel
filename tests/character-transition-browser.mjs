import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

// Isolated pages import the actual renderer; no game save or production debug hook.
const base=process.env.CHARACTER_ART_BASE_URL||'http://127.0.0.1:4173';
const out=process.env.CHARACTER_TRANSITION_OUT||'verification/all-guests-v1/transitions';
const guestIds=['lin','zhou','xu','tang','luo','chen','gu'];
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const results={},failures=[];
function check(label,actual,expected){try{assert.deepEqual(actual,expected,label);}catch(error){failures.push(error.message);}}
async function harness(id,intercept){
 const context=await browser.newContext({viewport:{width:1000,height:700}});
 if(intercept)await context.route(`**/assets/characters/${id}/*.png`,intercept);
 const page=await context.newPage();
 page.on('pageerror',error=>failures.push(`${id} browser runtime: ${error.message}`));
 await page.route('**/character-transition-harness.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><style>body{margin:0}canvas{width:100vw;height:100vh;display:block}</style></head><body><canvas id="world"></canvas></body></html>'}));
 await page.goto(base+'/character-transition-harness.html');
 await page.evaluate(async()=>{const W=await import('/src/world.js');if(!W.init())throw Error('WebGL unavailable');});
 return {page,context};
}
async function draw(page,id,mode,preload=false){
 return page.evaluate(async({id,mode,preload})=>{
  const W=await import('/src/world.js');const {PEOPLE}=await import('/src/content.js');
  const g={...PEOPLE.flat().find(g=>g.id===id),number:'103',side:0,z:9,type:'standard',alive:true,on:true,dark:0,emergency:0};
  if(preload)await W.preloadCharacters([id]);
  W.setMode(mode,mode==='night'?[g]:[],g);
  if(mode==='night')W.pose(0,8.8,0,-.11);
  // No await between scene creation and actual render: catch even a one-frame flash.
  W.update([g],true,null,0,{phase:'night',actors:mode==='night'?{[id]:{x:0,z:6,visible:true,direction:0,facing:0}}:{}});
  const state=W.getCharacterState(),pixels=document.querySelector('#world').toDataURL('image/png');
  return {state,pixels,portrait:W.portrait(id)};
 },{id,mode,preload});
}
async function settleCurrent(page,id){
 return page.evaluate(async id=>{
  const W=await import('/src/world.js');await W.preloadCharacters([id]);
  W.update([],false,null,0);
  return {state:W.getCharacterState(),pixels:document.querySelector('#world').toDataURL('image/png'),portrait:W.portrait(id)};
 },id);
}
async function record(name,result){
 await writeFile(`${out}/${name}.png`,Buffer.from(result.pixels.split(',')[1],'base64'));
 results[name]={state:result.state,portraitKind:result.portrait.startsWith('data:image/svg+xml')?'placeholder':result.portrait.startsWith('data:image/png')?'photo':'empty'};
}
const person=(result,id)=>result.state.characters.find(character=>character.id===id);
try{
 for(const id of guestIds){
 await mkdir(`${out}/${id}`,{recursive:true});
 const warm=await harness(id);
 for(const mode of ['reception','peep','night']){
  const result=await draw(warm.page,id,mode,true);await record(id+'/warm-first-frame-'+mode,result);
  check(`${id}/${mode}: cached-ready first rendered frame`,person(result,id)?.kind,'sprite');
  check(`${id}/${mode}: first frame remains upright`,[person(result,id)?.planeRotation?.[0],person(result,id)?.planeRotation?.[2]],[0,0]);
 }
 await warm.context.close();

 let releaseCold;const coldGate=new Promise(resolve=>releaseCold=resolve);
 const cold=await harness(id,async route=>{await coldGate;await route.continue();});
 const pending=await draw(cold.page,id,'reception');await record(id+'/cold-pending',pending);
 check('pending atlas never displays old geometry',person(pending,id)?.kind,'loading');
 check('pending ID is a neutral placeholder',results[id+'/cold-pending'].portraitKind,'placeholder');
 releaseCold();
 const settled=await settleCurrent(cold.page,id);await record(id+'/cold-ready',settled);
 check('cold atlas resolves directly to sprite',person(settled,id)?.kind,'sprite');
 check('loaded ID is neutral authored photo',results[id+'/cold-ready'].portraitKind,'photo');
 await cold.context.close();

 const failed=await harness(id,route=>route.abort('failed'));
 await draw(failed.page,id,'reception');
 const failedResult=await settleCurrent(failed.page,id);await record(id+'/failed-stable-fallback',failedResult);
 check('explicit failure keeps a visible fallback',person(failedResult,id)?.kind,'fallback');
 check('failed ID may use stable geometric fallback',results[id+'/failed-stable-fallback'].portraitKind,'photo');
 const failedAgain=await draw(failed.page,id,'peep',true);await record(id+'/failed-switch-fallback',failedAgain);
 check('failed cache remains fallback across scene switches',person(failedAgain,id)?.kind,'fallback');
 await failed.context.close();

 let releaseLate;const lateGate=new Promise(resolve=>releaseLate=resolve);
 const late=await harness(id,async route=>{await lateGate;await route.continue();});
 await draw(late.page,id,'reception');
 const abandoned=await late.page.evaluateHandle(async id=>{
  const W=await import('/src/world.js');const {PEOPLE}=await import('/src/content.js');
  const guest=W.avatar(PEOPLE.flat().find(g=>g.id===id));
  const pendingVisibility={fallback:guest.getObjectByName('character-fallback').visible,shadow:guest.getObjectByName('character-contact-shadow').visible};
  W.setMode('title',[]);W.update([],false,null,0);return {guest,pendingVisibility,id};
 },id);
 releaseLate();
 const afterLeave=await late.page.evaluate(async ({guest,pendingVisibility,id})=>{
  const W=await import('/src/world.js');await W.preloadCharacters([id]);await Promise.resolve();
  W.update([],false,null,0);
  return {state:W.getCharacterState(),pendingVisibility,abandonedSpriteVisible:guest.getObjectByName(id+'-lit-cutout').visible};
 },abandoned);
 results[id+'/leave-before-resolve']=afterLeave;
 check('pending figure and contact shadow are hidden',afterLeave.pendingVisibility,{fallback:false,shadow:false});
 check('late load cannot resurrect removed scene guest',afterLeave.state.characters,[]);
 check('late load cannot populate disposed guest',afterLeave.abandonedSpriteVisible,false);
 await abandoned.dispose();await late.context.close();
 }
 // The real killer branch used to rotate all mesh children. A paper character
 // must remain upright while chasing, with its contact shadow flat on the floor.
 const chase=await harness('luo');
 const chaseSamples=await chase.page.evaluate(async()=>{
  const W=await import('/src/world.js');const {PEOPLE}=await import('/src/content.js');
  const g={...PEOPLE.flat().find(g=>g.id==='luo'),number:'101',side:0,z:3,type:'standard',alive:true,on:true,dark:0,emergency:0};
  await W.preloadCharacters(['luo']);W.setMode('night',[g]);
  const samples=[];
  for(const [index,bearingDegrees] of [0,45,90,135,180,-135,-90,-45].entries()){
   const bearing=bearingDegrees*Math.PI/180,time=index*.3;
   const expectedNormal=[Math.sin(bearing),0,Math.cos(bearing)];
   // Orbit within corridor width; look towards the enemy from all eight bearings.
   W.pose(expectedNormal[0]*1.5,10+expectedNormal[2]*1.5,bearing,-.11);
   W.update([g],true,{kind:'killer',x:0,z:10,delay:0},time,{phase:'night',actors:{}});
   samples.push({time,bearingDegrees,expectedNormal,state:W.getCharacterState(),pixels:document.querySelector('#world').toDataURL('image/png'),portrait:W.portrait('luo')});
  }
  W.update([g],true,null,3,{phase:'night',actors:{}});
  return {samples,afterRemoval:W.getCharacterState()};
 });
 for(const [index,result] of chaseSamples.samples.entries()){
  const c=person(result,'luo');
  check(`Luo chase ${index}: authored character`,c?.kind,'sprite');
  check(`Luo chase ${index}: no plane pitch or roll`,[c?.planeRotation?.[0],c?.planeRotation?.[2]],[0,0]);
  const facingDot=c?.planeWorldNormal?.reduce((sum,value,axis)=>sum+value*result.expectedNormal[axis],0);
  check(`Luo chase ${result.bearingDegrees}deg: world normal faces camera`,Number.isFinite(facingDot)&&facingDot>.999,true);
  check(`Luo chase ${result.bearingDegrees}deg: world up stays vertical`,c?.planeWorldUp?.[1]>.999,true);
  check(`Luo chase ${result.bearingDegrees}deg: pursuer presents front frame`,c?.frame,'front');
  check(`Luo chase ${index}: contact shadow remains flat`,c?.contactRotation,[-Math.PI/2,0,0]);
  check(`Luo chase ${index}: feet stay on carpet`,c?.floorY,-.03);
  await record(`luo/chase-bearing-${result.bearingDegrees}`,result);
 }
 results['luo/chase-time-series']=chaseSamples.samples.map(({time,bearingDegrees,expectedNormal,state})=>({time,bearingDegrees,expectedNormal,state}));
 results['luo/chase-after-removal']=chaseSamples.afterRemoval;
 check('Luo pursuit removal leaves no registered ghost',chaseSamples.afterRemoval.characters,[]);
 await chase.context.close();
}catch(error){failures.push(error.stack||String(error));}finally{
 await writeFile(`${out}/result.json`,JSON.stringify({passed:failures.length===0,guestIds,results,failures},null,2));
 await browser.close();
}
assert.deepEqual(failures,[],'character transition regression');
console.log('All seven character transitions passed: warm first-frame, cold pending/ready, explicit failure, leave-before-resolve, and upright Luo pursuit.');
