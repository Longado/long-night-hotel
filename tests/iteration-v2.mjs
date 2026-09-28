import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173');
 await page.locator('[data-act=new]').click();
 assert.match(await page.locator('#app').innerText(),/暴雨中的抵达/);await page.locator('[data-act=introPhone]').click();assert.match(await page.locator('.modal').innerText(),/山路封了/);await page.locator('[data-act=close]').click();
 assert.ok(await page.locator('[data-act=enter]').count());
 const size=await page.locator('#world').evaluate(c=>c.width);assert.ok(size>=1200,`clear render expected >=1200, got ${size}`);
 await page.screenshot({path:'verification/v2/01-story.png'});
 await page.locator('[data-act=enter]').first().click();
 await page.locator('[data-act=refuse]').click();await page.locator('[data-act=confirmRefuse]').click();
 await page.locator('[data-act=accept]').click();await page.locator('[data-act=accept]').click();
 await page.locator('[data-act=auto]').click();await page.locator('[data-act=night]').click();
 assert.match(await page.locator('.modal').innerText(),/周岑/);
 await page.locator('[data-act=close]').click();
 await page.reload();await page.locator('[data-act=load]').click();
 assert.match(await page.locator('.hud').innerText(),/周岑/);
 await page.keyboard.press('Escape');
 await page.locator('[data-act=quality]').click();assert.ok(await page.locator('#world').evaluate(c=>c.width)<=640);
 await page.locator('[data-act=quality]').click();assert.ok(await page.locator('#world').evaluate(c=>c.width)>=1200);
 await page.locator('[data-act=sway]').click();
 assert.match(await page.locator('.modal').innerText(),/手电摆动：关/);
 await page.screenshot({path:'verification/v2/02-options.png'});
 // Seed an existing, valid checkpoint at the last second of a failed rescue.
 await page.evaluate(()=>{
  const key='long-night-mvp-v1',data=JSON.parse(localStorage.getItem(key));
  const state=data.state,target=state.rooms.find(r=>r.id===state.firstTargetId);
  state.stage='blackout';state.firstOutageTriggered=true;state.outageBriefingSeen=true;state.satiated=false;state.paused=false;
  target.on=false;target.dark=74;target.fault=true;
  localStorage.setItem(key,JSON.stringify(data));
 });
 await page.reload();await page.locator('[data-act=load]').click();await page.waitForTimeout(2500);
 await page.keyboard.press('e');await page.locator('[data-act=settle]').click();
 assert.match(await page.locator('.summary').innerText(),/未能恢复照明，被酒店吞噬/);
 assert.doesNotMatch(await page.locator('.summary').innerText(),/灯亮了，谢谢你/);
 await page.screenshot({path:'verification/v2/09-failed-rescue.png'});
 assert.deepEqual(errors,[]);
 console.log('PASS story, clear rendering, Lin refusal fallback, checkpoint, quality/motion switches, seeded failed-rescue settlement.');
} finally {await browser.close()}
