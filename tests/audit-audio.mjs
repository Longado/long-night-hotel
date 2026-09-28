import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{const Native=window.AudioContext;window.AudioContext=class extends Native{constructor(...args){super(...args);window.demoAudioContext=this;window.demoAnalyser=this.createAnalyser();demoAnalyser.fftSize=2048;}};const original=AudioNode.prototype.connect;AudioNode.prototype.connect=function(destination,...args){const r=original.call(this,destination,...args);if(destination===window.demoAudioContext?.destination)original.call(this,window.demoAnalyser);return r;};});
 await p.goto('http://127.0.0.1:4173/');assert.equal(await p.evaluate(()=>!!window.demoAudioContext),false,'no audio before player gesture');await p.locator('[data-act=new]').click();await p.waitForFunction(()=>window.demoAudioContext?.state==='running');
 await p.evaluate(async()=>{const source=await(await fetch('/src/main.js')).text();const A=await import(source.match(/import \* as Audio from ["']([^"']+)["']/)[1]);window.testAudio=A;A.cue('relief');});
 await p.waitForTimeout(100);const rms=()=>p.evaluate(()=>{const a=new Float32Array(demoAnalyser.fftSize);demoAnalyser.getFloatTimeDomainData(a);return Math.sqrt(a.reduce((sum,x)=>sum+x*x,0)/a.length)});assert.ok(await rms()>.001,'relief cue generates actual audio samples');
 await p.locator('[data-act=introPhone]').click();await p.waitForTimeout(1800);assert.ok(await rms()>.0001,'reading retains ambience');
 await p.locator('[data-act=close]').click();await p.locator('[data-act=introPause]').click();await p.waitForTimeout(3500);assert.ok(await rms()<.0001,'explicit pause fades ambience');
 await p.evaluate(()=>{testAudio.toggle();testAudio.update({phase:'title'},{paused:true,moving:false});});await p.waitForTimeout(450);assert.ok(await rms()<.0001,'mute silences current output');assert.deepEqual(errors,[]);console.log('PASS: no autoplay, gesture unlock, nonzero synthesized audio, mute fades current output.');
}finally{await browser.close()}
