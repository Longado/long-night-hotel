import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
await page.clock.install();await page.goto('http://127.0.0.1:4173');await page.waitForTimeout(600);await page.screenshot({path:'verification/v2/01-title.png'});
await page.locator('[data-act=new]').click();await page.locator('[data-act=enter]').first().click();await page.screenshot({path:'verification/v2/02-reception.png'});
for(let i=0;i<3;i++){await page.locator('[data-act=ask0]').click();await page.locator('[data-act=ask1]').click();await page.locator('[data-act=accept]').click()}
await page.locator('[data-act=auto]').click();await page.screenshot({path:'verification/v2/03-layout.png'});await page.locator('[data-act=night]').click();await page.locator('[data-act=close]').click();await page.screenshot({path:'verification/v2/04-night.png'});
async function walk(key,ms){await page.keyboard.down('Shift');await page.keyboard.down(key);await page.clock.runFor(ms);await page.keyboard.up(key);await page.keyboard.up('Shift');await page.clock.runFor(350);}
async function interact(){await page.keyboard.press('e');}
async function close(){await page.locator('[data-act=close]').last().click()}
await walk('w',4800);await interact();assert.match(await page.locator('.modal').innerText(),/林姨/);await page.locator('[data-act=peep]').click();await page.screenshot({path:'verification/v2/05-peephole.png'});await close();
assert.match(await page.locator('.modal').innerText(),/经理，灯灭了/);
const before=await page.locator('#app').innerText();await page.clock.fastForward(90000);assert.equal(await page.locator('#app').innerText(),before);await page.screenshot({path:'verification/v2/05-outage.png'});await close();
await page.locator('[data-act=pause]').click();await page.clock.fastForward(90000);await close();
await walk('w',450);await interact();await page.locator('[data-act=repair]').click();await page.clock.runFor(8300);
assert.match(await page.locator('.hud').innerText(),/回 101 房确认林姨平安/);
await walk('s',320);await interact();assert.match(await page.locator('.modal').innerText(),/灯亮了，谢谢你/);await page.screenshot({path:'verification/v2/06-thanks.png'});await close();
await walk('s',5600);await interact();await page.locator('[data-act=settle]').click();assert.match(await page.locator('h1').innerText(),/等到了天亮/);await page.screenshot({path:'verification/v2/06-first-morning.png'});
await page.locator('[data-act=next]').click();assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('long-night-mvp-v1')).state.clues.some(c=>c.id==='lin0')),'day-one observations survive the next-day checkpoint');
for(let i=0;i<4;i++){await page.locator('[data-act=ask0]').click();await page.locator('[data-act=ask1]').click();if(i===1){await page.locator('[data-act=refuse]').click();await page.locator('[data-act=confirmRefuse]').click()}else await page.locator('[data-act=accept]').click()}
await page.locator('[data-act=auto]').click();await page.locator('[data-act=night]').click();await close();
// Day two, three rooms: z=1.5 and 7.5 north, z=1.5 south.
await walk('w',3450);await interact();assert.match(await page.locator('.modal').innerText(),/陈默/);await close();await walk('w',1350);await interact();assert.match(await page.locator('.modal').innerText(),/唐宁/);await close();await walk('s',5600);await interact();await page.locator('[data-act=advance]').click();await interact();await page.locator('[data-act=final]').click();
await walk('w',5600);await interact();await page.locator('[data-act=repair]').click();await walk('s',5600);await walk('w',5600);await interact();await page.locator('[data-act=repair]').click();await page.clock.runFor(8300);await walk('s',5600);await interact();await page.locator('[data-act=settle]').click();await page.screenshot({path:'verification/v2/07-second-morning.png'});assert.match(await page.locator('h1').innerText(),/等到了天亮/);assert.deepEqual(errors,[]);console.log('PASS: real UI completed two nights, refusal branch, room layout, peephole, paused blackout, repair, chase escape, zero page errors.');} catch(e){console.error(await page.locator('#app').innerText());await page.screenshot({path:'verification/v2/failure.png'});throw e;} finally {await browser.close();}
