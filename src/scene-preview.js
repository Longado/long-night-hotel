import './scene-preview.css';
import * as W from './world.js';
const views={front:{x:-.6,z:-1.05,yaw:.12,pitch:-.07},counter:{x:-.55,z:-2.1,yaw:.28,pitch:-.30},recorder:{x:-1.55,z:-2.9,yaw:.19,pitch:-.32},entry:{x:0,z:-5.5,yaw:0,pitch:.01},corridor:{x:0,z:3,yaw:Math.PI,pitch:0,night:true},lamp:{x:-.68,z:6.8,yaw:.94,pitch:.4,night:true}};
let selected='front',pose={...views.front},dark=false,drag=null;
const canvas=document.querySelector('#world');
function setView(key){selected=key;pose={...views[key]};W.setMode(pose.night?'night':'prologue',[]);W.setSway(false);W.setHeldVisible(false);W.setLightPower(dark?.12:1);for(const b of document.querySelectorAll('button[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===key));document.body.dataset.view=key;}
document.querySelector('nav').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.view)setView(b.dataset.view);if(b.id==='reset')setView(selected);if(b.id==='light'){dark=!dark;W.setLightPower(dark?.12:1);b.textContent='灯光：'+(dark?'暗':'亮');b.setAttribute('aria-pressed',String(dark));}});
canvas.addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag)return;pose.yaw-=(e.clientX-drag[0])*.003;pose.pitch=Math.max(-.9,Math.min(.9,pose.pitch-(e.clientY-drag[1])*.003));drag=[e.clientX,e.clientY];});
canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
window.addEventListener('resize',W.resize);
function frame(time){if(pose.night)W.pose(pose.x,pose.z,pose.yaw,pose.pitch);else W.prologuePose({player:{x:pose.x,z:pose.z},door:false,key:false,signed:false},pose.yaw,pose.pitch,0,time/1000);W.update([],false,null,time/1000);requestAnimationFrame(frame);}
if(W.init()){setView(selected);requestAnimationFrame(frame);document.body.dataset.ready='true';}else document.querySelector('#note').textContent='无法开启三维画面，请启用浏览器硬件加速后刷新。';
