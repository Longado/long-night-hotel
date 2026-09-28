import './character-preview.css';
import * as W from './world.js';
import {PEOPLE} from './content.js';

const guests=PEOPLE.flat().map(g=>({...g,number:'103',type:'standard',side:0,z:9,alive:true,on:true,dark:0,emergency:0}));
const sample={guest:'tang',view:'reception',expression:'neutral',room:'standard',angle:'front',light:true,closeup:false};
const status=document.querySelector('#load-status');
const picker=document.querySelector('#guest-select');
for(const guest of guests){const option=document.createElement('option');option.value=guest.id;option.textContent=guest.name;picker.append(option);}
picker.value=sample.guest;
const notes={reception:'前台半身像。柜台保留对人物的遮挡。',peep:'标准房可见随身物品；套房只展示外间。',corridor:'固定机位查看三个朝向，样片中的人物不自主行动。'};
const currentGuest=()=>guests.find(g=>g.id===sample.guest);
let lastState='',portraitKey='';
function snapshot(){
 const state=W.getCharacterState(),next=JSON.stringify({...sample,...state},null,2);
 if(next!==lastState){
  document.querySelector('#preview-state').textContent=next;lastState=next;
  const assets=state.assetsByGuest[sample.guest],kind=sample.view==='reception'?'expressions':'directions';
  status.textContent=assets[kind]==='ready'?`${currentGuest().name}人物样张 · 前台 / 猫眼 / 走廊`:assets[kind]==='failed'?'人物图片未载入，已保留原有模型。':`${currentGuest().name}正在就位…`;
  const propStatus=document.querySelector('#prop-status'),pending=state.props.some(p=>p.status==='loading'),failed=state.props.some(p=>p.status==='failed');
  propStatus.hidden=!pending&&!failed;propStatus.textContent=pending?'随身物品正在载入…':failed?'部分物品暂用简化外形。':'';
  const nextPortraitKey=sample.guest+':'+assets.expressions;
  if(nextPortraitKey!==portraitKey){
   const url=W.portrait(sample.guest),image=document.querySelector('#portrait-preview');
   if(url){image.src=url;image.hidden=false;portraitKey=nextPortraitKey;}
   else{image.removeAttribute('src');image.hidden=true;portraitKey='';}
  }
 }
}
function controls(){
 const guest=currentGuest();
 for(const key of ['view','expression','room','angle'])for(const button of document.querySelectorAll(`[data-${key}]`))button.setAttribute('aria-pressed',String(button.dataset[key]===sample[key]));
 for(const controls of document.querySelectorAll('[data-controls]'))controls.hidden=controls.dataset.controls!==sample.view;
 document.querySelector('#toggle-light').textContent=sample.view==='corridor'?`手电：${sample.light?'开':'关'}`:`灯光：${sample.light?'亮':'暗'}`;
 document.querySelector('#toggle-light').setAttribute('aria-pressed',String(sample.light));
 const propButton=document.querySelector('#toggle-props');propButton.hidden=sample.view==='corridor'||sample.view==='peep'&&sample.room==='suite';propButton.textContent=sample.closeup?'返回人物视角':'物品近看';propButton.setAttribute('aria-pressed',String(sample.closeup));
 document.querySelector('#scene-note').textContent=sample.view==='peep'&&sample.guest==='tang'?'标准房可见闭合药箱；套房药箱留在内间。':notes[sample.view];
 document.querySelector('#guest-name').textContent=guest.name;
 document.querySelector('#portrait-name').textContent=guest.name;
 document.querySelector('#portrait-preview').alt=guest.name+'的中性神态证件照';
 document.querySelector('#world').setAttribute('aria-label','长夜旅店中的'+guest.name+'人物样片');
 document.title=guest.name+'人物样张 · 长夜旅店';
}
function setView(){
 const guest=currentGuest();
 if(sample.view==='reception'){W.setMode('reception',[],guest);W.setGuestExpression(sample.expression);}
 else if(sample.view==='peep')W.setMode('peep',[],{...guest,type:sample.room==='suite'?'suite':'standard',away:sample.room==='away'});
 else{W.setMode('night',[guest]);W.setSway(false);W.pose(0,8.8,0,-.11);}
 W.setLightPower(sample.view==='corridor'?1:sample.light?1:.12);
 if(sample.view==='corridor'||sample.view==='peep'&&sample.room==='suite')sample.closeup=false;
 W.setPropCloseup(sample.closeup);
 controls();snapshot();
}
function frame(time){
 const guest=currentGuest(),facing={front:0,side:-Math.PI/2,back:Math.PI}[sample.angle];
 W.update([guest],sample.light,null,time/1000,{phase:'night',actors:sample.view==='corridor'?{[guest.id]:{x:0,z:6,visible:true,direction:0,facing}}:{}});
 snapshot();requestAnimationFrame(frame);
}
picker.addEventListener('change',()=>{sample.guest=picker.value;sample.expression='neutral';setView();});
document.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.id==='toggle-props'){sample.closeup=!sample.closeup;W.setPropCloseup(sample.closeup);controls();snapshot();return;}
 if(button.id==='toggle-light'){
  sample.light=!sample.light;W.setLightPower(sample.view==='corridor'?1:sample.light?1:.12);controls();snapshot();return;
 }
 if(button.dataset.expression){sample.expression=button.dataset.expression;W.setGuestExpression(sample.expression);controls();snapshot();return;}
 if(button.dataset.angle){sample.angle=button.dataset.angle;controls();return;}
 if(button.dataset.view)sample.view=button.dataset.view;
 if(button.dataset.room)sample.room=button.dataset.room;
 setView();
});
window.addEventListener('resize',()=>W.resize());
if(W.init()){
 setView();requestAnimationFrame(frame);
 await Promise.all([W.preloadCharacters(),W.preloadProps()]);
 document.body.dataset.ready='true';snapshot();
}else status.textContent='无法开启三维画面，请在支持 WebGL 的浏览器中打开。';
