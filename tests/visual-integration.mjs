import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const p=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:4173/');
 // Observe the actual rendered camera without adding production debug state.
 async function observe(){await p.evaluate(async()=>{const url=performance.getEntriesByType('resource').find(r=>r.name.includes('/deps/three.js')).name;const T=await import(url);const update=T.Object3D.prototype.updateMatrixWorld;T.Object3D.prototype.updateMatrixWorld=function(...args){if(this.isCamera&&this.near===.05)window.renderedPose={x:this.position.x,yaw:this.rotation.y};return update.apply(this,args)}})}
 await observe();await p.locator('[data-act=new]').click();await p.locator('[data-act=enter]').first().click();
 for(let i=0;i<3;i++)await p.locator('[data-act=accept]').click();
 await p.locator('[data-act=auto]').click();await p.locator('[data-act=night]').click();await p.locator('[data-act=close]').click();await p.waitForTimeout(300);
 const before=await p.evaluate(()=>renderedPose);
 await p.mouse.move(650,350);await p.mouse.down();await p.mouse.move(720,350,{steps:5});await p.mouse.up();await p.waitForTimeout(200);
 const after=await p.evaluate(()=>renderedPose);assert.ok(after.yaw<before.yaw,'mouse right must turn the game camera right');
 await p.mouse.move(650,350);await p.mouse.down();await p.mouse.move(580,350,{steps:5});await p.mouse.up();await p.waitForTimeout(200);
 const x=await p.evaluate(()=>renderedPose.x);await p.keyboard.down('d');await p.waitForTimeout(250);await p.keyboard.up('d');assert.ok(await p.evaluate(()=>renderedPose.x)>x,'D must retain rightward movement');
 await p.screenshot({path:'verification/integrated/01-corridor.png'});
 // Face the bar with the real mouse input while standing in the existing safe zone.
 await p.evaluate(()=>{document.querySelector('#app').dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));window.dispatchEvent(new MouseEvent('mousemove',{movementX:Math.PI/.003}));window.dispatchEvent(new MouseEvent('mouseup'));});
 await p.waitForTimeout(400);await p.screenshot({path:'verification/integrated/02-bar.png'});
 await p.setViewportSize({width:1280,height:720});await p.waitForTimeout(200);assert.equal(await p.locator('#world').evaluate(c=>c.width),1280);
 await p.goto('http://127.0.0.1:4173/visual-lab.html');await observe();await p.waitForTimeout(300);
 const labBefore=await p.evaluate(()=>renderedPose.yaw);
 await p.mouse.move(550,360);await p.mouse.down();await p.mouse.move(620,360,{steps:5});await p.mouse.up();await p.waitForTimeout(200);
 assert.ok(await p.evaluate(()=>renderedPose.yaw)<labBefore,'lab mouse rotation must match game');
 const labX=await p.evaluate(()=>renderedPose.x);await p.keyboard.down('a');await p.waitForTimeout(250);await p.keyboard.up('a');assert.ok(await p.evaluate(()=>renderedPose.x)<labX,'lab A movement restored');
 assert.deepEqual(errors,[]);console.log('PASS: mouse-right turns right in both rendered views, A/D preserved, clear resize, no page errors.');
}finally{await browser.close()}
