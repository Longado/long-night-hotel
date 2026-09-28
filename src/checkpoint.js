import {PEOPLE} from './content.js';
const clone=value=>JSON.parse(JSON.stringify(value));
export function checkpoint(s){const copy=clone(s.enemy&&s.threatCheckpoint?s.threatCheckpoint:s);delete copy.threatCheckpoint;delete copy.repair;copy.enemy=null;copy.paused=false;return copy;}
export function beforeThreat(s){const copy=clone(s);delete copy.threatCheckpoint;copy.enemy=null;return copy;}
export function restore(data){if(![1,2,3].includes(data.schema)||!data.state?.rooms||!Array.isArray(data.state.guests))throw Error('Invalid checkpoint');const s=clone(data.state);if(data.schema===1){const obsolete=new Set(['xu0','luo0','luo1','tang1','notice','tape','shadow-boundary']);s.clues=(s.clues||[]).filter(c=>!obsolete.has(c.id));s.story={};if(s.roster)s.roster=clone(PEOPLE[(s.day||1)-1]);for(const r of [...s.rooms,...s.guests]){const current=PEOPLE.flat().find(g=>g.id===r.id);if(current)Object.assign(r,{facts:current.facts,intro:current.intro,line:current.line});}if(s.phase==='arrival')s.prologue=null;if(s.hotelChaseUsed&&!s.hotelEscaped)s.hotelChaseUsed=false;s.legacyNotice=true;}if(s.enemy){if(s.threatCheckpoint)return restore({schema:2,state:s.threatCheckpoint});s.hotelChaseUsed=s.enemy.kind==='hotel'?false:s.hotelChaseUsed;s.killerChaseUsed=s.enemy.kind==='killer'?false:s.killerChaseUsed;}s.enemy=null;s.paused=false;delete s.threatCheckpoint;
 if(data.schema<3&&!s.layoutVersion){
  s.layoutVersion=1;
  if(['layout','night'].includes(s.phase)&&s.rooms.some(r=>r.shape)){
   const lost=new Set(s.rooms.filter(r=>r.alive===false).map(r=>r.id||r.guestId));
   s.guests=s.guests.filter(g=>!lost.has(g.id));s.phase=s.guests.length?'layout':'settlement';s.rooms=[];
   s.income=0;s.history=[...(s.history||[]),...(s.events||[])];s.events=[];s.guard=null;s.actors={};s.officerDuty=null;s.stage='tour';s.story={};
   s.clues=(s.clues||[]).filter(c=>!['wall-trace','shadow-boundary'].includes(c.id));
   s.migrationNotice='客房布局已更新：保留现金、装备和已获得的来客证言，请为仍在店的住客重新分房并重走本夜。';
  }
 }
 return s;}
