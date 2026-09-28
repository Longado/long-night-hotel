import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';
const out='verification/fixed-rooms';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const p=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install();
let yaw=0;
const click=async a=>{console.log(a);await p.locator(`[data-act="${a}"]`).click({timeout:7000});};
const run=ms=>p.clock.runFor(ms);
const turn=async target=>{await p.mouse.move(720,350);await p.mouse.down();await p.evaluate(a=>window.dispatchEvent(new MouseEvent('mousemove',{movementX:-a/.003,bubbles:true})),target-yaw);await p.mouse.up();yaw=target;await run(350);};
const walk=async(key,ms)=>{await p.keyboard.down('Shift');await p.keyboard.down(key);await run(ms);await p.keyboard.up(key);await p.keyboard.up('Shift');await run(350);};
const shot=async name=>{await run(350);await p.screenshot({path:`${out}/${name}.png`});};
const saved=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('long-night-mvp-v1')).state);
const seed=async state=>{await p.evaluate(state=>localStorage.setItem('long-night-mvp-v1',JSON.stringify({schema:3,state})),state);await p.reload();await click('load');yaw=0;await run(350);};
try{
 await p.goto('http://127.0.0.1:4173');await click('new');await click('enter');for(let i=0;i<3;i++)await click('accept');
 assert.equal(await p.locator('[data-act^="room:"]').count(),6);assert.equal(await p.locator('[data-act^="shape:"]').count(),0);
 await click('auto');await shot('01-key-board');await click('guest:lin');await click('room:106');assert.match(await p.locator('[data-act="room:106"]').innerText(),/林姨/);assert.equal(await p.locator('[data-act="room:101"]').isDisabled(),true);await click('room:105');
 await click('night');await click('close');await walk('w',1667);await turn(Math.PI/2);await p.keyboard.press('e');assert.match(await p.locator('.modal').innerText(),/105/);await click('close');await click('close');await turn(0);await walk('w',3250);await p.keyboard.press('e');assert.equal(await p.locator('[data-act=repair]').count(),1);await click('close');
 await turn(Math.atan2(1.08,1.1));await p.keyboard.press('e');assert.equal(await p.locator('[data-type=painting]').count(),1);assert.match(await p.locator('.modal').innerText(),/105/);await shot('02-painting-warning');await click('close');await turn(0);await p.keyboard.press('e');await click('repair');await run(8500);
 await walk('s',3250);await turn(Math.PI/2);await p.keyboard.press('e');await click('close');await turn(0);await walk('s',2000);await turn(Math.PI);await p.keyboard.press('e');await click('settle');await shot('03-morning');await click('next');
 for(let i=0;i<4;i++){await click('ask0');await click('ask1');await click('accept');}await click('auto');await click('night');await click('close');const night=await saved();await writeFile(`${out}/night-fixture.json`,JSON.stringify(night,null,2));
 // Actual generated rooms; set ready stage to compare protection strategies independently.
 await seed({...night,stage:'ready',player:{x:0,z:23}});await turn(Math.PI);await p.keyboard.press('e');await click('guard:luo');await click('evidence:luo0');await click('evidence:gu0');await click('submitGuard');assert.equal((await saved()).guard,null);await click('advance');await run(1200);await p.keyboard.press('Escape');await click('close');assert.match(await p.locator('.hud').innerText(),/最后/);await shot('04-guard-result');
 await seed({...night,stage:'ready',player:{x:0,z:23}});await turn(Math.PI);await p.keyboard.press('e');await click('protect:tang');await click('advance');await turn(0);await walk('w',2800);await turn(Math.PI/2);await run(600);
 // Aim at the approaching actor using geometry, without changing game state.
 const current=await saved();assert.equal(current.stage,'approach');
 await p.keyboard.press('Escape');await shot('05-patrol-pause');await click('close');
 // Dedicated close-range approach checkpoint exercises the actual person interaction and retry.
 const approach={...night,stage:'approach',victim:{id:'tang',number:'105'},player:{x:0,z:13},actors:{luo:{id:'luo',x:-.95,z:10,visible:true}},protection:'tang'};
 await seed(approach);await turn(.42);await p.keyboard.press('e');assert.equal(await p.locator('[data-type=person]').count(),1);await shot('06-intercept');await click('intervene');await p.keyboard.press('Escape');await click('load');yaw=0;assert.equal((await saved()).stage,'approach');
 await turn(.5);await p.keyboard.press('e');await click('intervene');await turn(0);await walk('s',3100);const rescued=await saved();assert.equal(rescued.enemy,null);assert.ok(rescued.rooms.every(r=>r.alive));assert.ok(rescued.events.some(e=>e.key==='rescue'));
 await seed({...night,stage:'blackout',player:{x:0,z:1.5},rooms:night.rooms.map(r=>({...r,on:false,fault:true})),hotelChaseUsed:false});await p.keyboard.press('e');await click('repair');await run(600);await shot('07-painting-emergence');await walk('s',5000);assert.equal((await saved()).hotelEscaped,true);await walk('w',5000);await p.keyboard.press('e');await click('read:wall-trace');assert.match(await p.locator('.modal').innerText(),/颜料/);await click('close');await p.keyboard.press('e');await click('repair');await run(8500);await walk('s',5200);await turn(Math.PI);await p.keyboard.press('e');await click('settle');await click('ending');await click('endingNext');await shot('08-ending');

 // Suite visibility does not invent an inner-room clue.
 const suiteRooms=night.rooms.map(r=>r.id==='luo'?{...r,number:'106',type:'suite',label:'套房',side:1,z:15}:r);
 await seed({...night,stage:'ready',rooms:suiteRooms,player:{x:0,z:15}});await turn(-Math.PI/2);await p.keyboard.press('e');await click('peep');await click('observe');assert.match(await p.locator('.peephole-footer').innerText(),/内间门关着/);await shot('09-suite');await click('close');await p.keyboard.press('Tab');assert.doesNotMatch(await p.locator('.modal').innerText(),/床边藏着长工具袋/);
 // Someone in the corridor cannot simultaneously talk from the registered bedroom.
 await seed({...night,stage:'approach',victim:{id:'tang',number:'105'},player:{x:0,z:3},actors:{luo:{id:'luo',x:-.95,z:8,visible:true,away:true}}});await turn(Math.PI/2);await p.keyboard.press('e');assert.match(await p.locator('.modal').innerText(),/门内没有回应/);assert.equal(await p.locator('[data-act=followup]').count(),0);await shot('10-empty-bedroom');
 assert.deepEqual(errors,[]);await writeFile(`${out}/result.json`,JSON.stringify({passed:true,errors,checks:['actual first-night reception, fixed allocation, repair, recheck, settlement','stable six doors and occupied-room rejection','painting warning and trace','guard assignment distinct from arrival','direct intervention, pursuit retry and survival','hotel pursuit, repair and ending','suite does not expose inner-room evidence','outside guests do not answer from their bedroom'],boundary:'Second-night branches start from a generated checkpoint with controlled stage/positions; not a blind playtest.'},null,2));console.log('PASS fixed rooms browser');
}finally{await browser.close();}
