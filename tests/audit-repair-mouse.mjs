import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const p=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install();await p.goto('http://127.0.0.1:4173/');
 await p.locator('[data-act=new]').click();await p.locator('[data-act=enter]').first().click();for(let i=0;i<3;i++)await p.locator('[data-act=accept]').click();await p.locator('[data-act=auto]').click();await p.locator('[data-act=night]').click();await p.locator('[data-act=close]').click();
 await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('long-night-mvp-v1'));Object.assign(d.state,{stage:'blackout',firstOutageTriggered:true,outageBriefingSeen:true});d.state.rooms[0].on=false;d.state.rooms[0].fault=true;localStorage.setItem('long-night-mvp-v1',JSON.stringify(d))});await p.reload();await p.locator('[data-act=load]').click();
 await p.keyboard.down('Shift');await p.keyboard.down('w');await p.clock.runFor(5600);await p.keyboard.up('w');await p.keyboard.up('Shift');await p.clock.runFor(200);
 await p.mouse.dblclick(650,350);await p.waitForFunction(()=>!!document.pointerLockElement);await p.keyboard.press('e');await p.clock.runFor(100);
 assert.equal(await p.evaluate(()=>!!document.pointerLockElement),false,'power menu must release cursor for repair button');
 await p.locator('[data-act=repair]').click();await p.clock.runFor(500);await p.locator('[data-act=close]').click();await p.waitForFunction(()=>!!document.pointerLockElement);await p.keyboard.press('e');await p.clock.runFor(100);await p.locator('[data-act=repair]').click();await p.clock.runFor(8300);
 assert.match(await p.locator('.modal').innerText(),/继续巡查/,'automatic completion offers a deliberate click to restore locked look');
 const hud=await p.locator('.hud-bottom').innerText();await p.clock.runFor(90000);assert.equal(await p.locator('.hud-bottom').innerText(),hud);await p.screenshot({path:'verification/audit-iteration/10-mouse-resume.png'});await p.locator('[data-act=resumeLook]').click();await p.waitForFunction(()=>!!document.pointerLockElement);assert.equal(await p.locator('.modal').count(),0);
 await p.keyboard.press('e');await p.clock.runFor(100);assert.equal(await p.evaluate(()=>!!document.pointerLockElement),false);await p.locator('[data-act=close]').click();await p.waitForFunction(()=>!!document.pointerLockElement);
 await p.keyboard.press('e');await p.clock.runFor(100);await p.evaluate(()=>{document.querySelector('#world').requestPointerLock=()=>Promise.reject(new Error('browser denied'))});await p.locator('[data-act=close]').click();await p.waitForFunction(()=>document.querySelector('#toast').textContent.includes('按住鼠标拖动'));assert.equal(await p.locator('.modal').count(),0);assert.deepEqual(errors,[]);
 console.log('PASS: locked look releases for power menu; automatic repair completion and manual close restore look through user clicks.');
}finally{await browser.close()}
