import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.SCENE_VERIFY_OUT||'verification/environment-v1',base=process.env.SCENE_BASE_URL||'http://127.0.0.1:4173';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[],shots=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:900}}),p=await context.newPage();
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'/scene-preview.html');await p.waitForFunction(()=>document.body.dataset.ready==='true');
 const initialSave=await p.evaluate(()=>localStorage.getItem('long-night-mvp-v1'));
 for(const key of ['front','counter','recorder','entry','corridor','lamp']){
  await p.locator(`button[data-view="${key}"]`).click();await p.waitForTimeout(180);
  assert.equal(await p.locator(`button[data-view="${key}"]`).getAttribute('aria-pressed'),'true');
  await p.screenshot({path:`${out}/${key}.png`});shots.push(key);
 }
 await p.locator('#light').click();await p.waitForTimeout(150);await p.screenshot({path:`${out}/lamp-dark.png`});shots.push('lamp-dark');
 await p.mouse.move(620,440);await p.mouse.down();await p.mouse.move(740,470,{steps:4});await p.mouse.up();await p.locator('#reset').click();
 assert.equal(await p.locator('body').getAttribute('data-view'),'lamp');
 assert.equal(await p.evaluate(()=>localStorage.getItem('long-night-mvp-v1')),initialSave,'preview never changes progress');
 await p.locator('header a').first().click();assert.equal(new URL(p.url()).pathname,'/');
 await p.clock.install();
 const click=a=>p.locator(`[data-act="${a}"]`).click({timeout:8000});
 const run=ms=>p.clock.runFor(ms);
 const walk=async(key,ms)=>{await p.keyboard.down(key);await run(ms);await p.keyboard.up(key);await run(350);};
 const saved=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('long-night-mvp-v1')).state);
 await click('new');await walk('w',1500);await p.keyboard.press('e');assert.equal((await saved()).prologue.door,true);
 await walk('w',2300);await walk('d',400);await p.keyboard.press('e');
 assert.equal(await p.locator('[data-act="intro:listen"]').count(),1);
 await click('intro:listen');await p.keyboard.press('e');await click('intro:ledger');await click('intro:sign');await click('intro:take');
 assert.equal((await saved()).prologue.key,true);assert.equal((await saved()).prologue.signed,true);
 await p.screenshot({path:`${out}/main-signed.png`});shots.push('main-signed');
 await walk('a',900);await walk('w',11600);await p.keyboard.press('e');assert.match(await p.locator('.modal').innerText(),/这里比门外暖和/);
 await click('close');await walk('s',11600);await walk('d',900);await p.keyboard.press('e');await click('intro:finish');await run(1600);
 assert.match(await p.locator('.conversation').innerText(),/林姨/);await p.screenshot({path:`${out}/main-reception.png`});shots.push('main-reception');
 for(let i=0;i<3;i++)await click('accept');await click('auto');await click('night');await click('close');
 assert.equal((await saved()).phase,'night');await p.screenshot({path:`${out}/main-night.png`});shots.push('main-night');
 assert.deepEqual(errors,[]);
 await writeFile(`${out}/result.json`,JSON.stringify({passed:true,base,errors,shots,checks:['six scene cameras','dim lighting and view reset','preview leaves save untouched','entrance opens','listen / ledger / sign / key','lobby corridor bar round trip','morning reception','room allocation and first night']},null,2));
 console.log('PASS scene preview and actual entry / recorder / signing / key / bar / reception / night integration');
}finally{await browser.close();}
