import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const p=await browser.newPage({viewport:{width:1440,height:1000}});await p.goto('http://127.0.0.1:4173/');await p.evaluate(()=>{document.querySelector('#app').style.display='none';window.requestAnimationFrame=()=>0});await p.waitForTimeout(100);
 const overlap=await p.evaluate(async()=>{
  const source=await(await fetch('/src/world.js')).text(),url=source.match(/from ["']([^"']*three[^"']*)["']/)[1],T=await import(url),main=await(await fetch('/src/main.js')).text(),W=await import(main.match(/import \* as W from ["']([^"']+)["']/)[1]);
  const rooms=[{id:'lin',number:'101',side:0,z:1.5,alive:true,on:true,dark:0},{id:'x',number:'102',side:1,z:7.5,alive:true,on:true,dark:0},{id:'y',number:'103',side:0,z:13.5,alive:true,on:true,dark:0}];
  let scene;const update=T.Object3D.prototype.updateMatrixWorld;T.Object3D.prototype.updateMatrixWorld=function(...args){if(this.isScene)scene=this;return update.apply(this,args)};
  W.setMode('night',rooms);W.pose(-.65,1.5,Math.PI/2,0,false,0,.016);W.update(rooms,true,null,0);window.testWorld={W,rooms};
  const collisions=[];for(const mesh of scene.children){const g=mesh.geometry?.parameters;if(!g)continue;const trim=(g.width===.23&&g.height===.07)||(g.width===.26&&g.height===.12)||(g.width===.10&&g.height===.88);if(!trim)continue;for(const r of rooms)if(Math.sign(mesh.position.x)===(r.side===0?-1:1)&&mesh.position.z-g.depth/2<r.z+.735&&mesh.position.z+g.depth/2>r.z-.735)collisions.push({door:r.number,z:mesh.position.z,length:g.depth});}
  return collisions;
 });
 await p.screenshot({path:'verification/door-clearance/01-closeup.png'});
 assert.deepEqual(overlap,[],'wall trim must stop at both sides of every door frame');
 console.log('PASS: horizontal and vertical wall trim clear three door openings on both corridor sides.');
}finally{await browser.close()}
