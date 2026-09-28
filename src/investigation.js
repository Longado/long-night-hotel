import {requestGuard} from './night-actions.js';
import {guardReach} from './demo.js';
export const DOSSIERS={
 tang:{name:'唐宁',dob:'1968.04.17',bookingDob:'1968.04.21',number:'0417',luggage:'药箱一只',oralLuggage:'药箱一只',reply:{dob:'我的生日是四月十七。预约是同事打的电话，也许前台转抄错了。'},verification:'接线员查到原始便条：唐宁，四月十七。她承认把日期抄成了二十一。姓名与证件尾号一致。日期差异已解释，其他情况仍需你判断。',clears:['dob']},
 luo:{name:'罗诚',dob:'1962.11.06',bookingDob:'1962.11.06',number:'1106',luggage:'长工具袋一只',oralLuggage:'没有行李',reply:{luggage:'登记的人记错了吧。我一路都是空着手来的。你问别人也一样。'},verification:'接线员翻到预约原件：罗诚要求预留放置长工具袋的空间。没有更正记录。这与他声称没有行李的说法不符。',clears:[]},
 chen:{name:'陈默',dob:'1956.08.23',bookingDob:'1956.08.23',number:'0823',luggage:'公文包一只',oralLuggage:'公文包一只',reply:{},verification:'预约姓名、生日和公文包记录一致；当地值班室确认了陈默的警员身份。',clears:[]},
 gu:{name:'顾远',dob:'1971.02.14',bookingDob:'1971.02.14',number:'0214',luggage:'相机一台',oralLuggage:'相机一台',reply:{},verification:'接线员确认姓名、生日与相机记录均一致。预约资料没有发现差异。',clears:[]}
};
export function dossierFields(id){const d=DOSSIERS[id];if(!d)return {};return {'id:name':d.name,'id:dob':d.dob,'id:number':d.number,'booking:name':d.name,'booking:dob':d.bookingDob,'booking:luggage':d.luggage,'oral:luggage':d.oralLuggage};}
export function compareFields(id,left,right){const fields=dossierFields(id);const [ls,lk]=(left||'').split(':'),[rs,rk]=(right||'').split(':');if(!fields[left]||!fields[right]||ls===rs||lk!==rk)return {kind:'unrelated'};return {kind:fields[left]===fields[right]?'match':'mismatch',key:lk};}
function investigation(s){return s.investigation??={checksLeft:2,guests:{}};}
function record(s,id){const all=investigation(s);return all.guests[id]??={questioned:[],verified:false};}
export function questionEvidence(s,id,key){const d=DOSSIERS[id];if(!d?.reply[key])return false;const r=record(s,id);if(!r.questioned.includes(key))r.questioned.push(key);return true;}
export function verifyGuest(s,id){if(!DOSSIERS[id])return {ok:false};const r=record(s,id),all=investigation(s);if(r.verified)return {ok:true,repeat:true,text:DOSSIERS[id].verification};if(all.checksLeft<=0)return {ok:false};all.checksLeft--;r.verified=true;return {ok:true,repeat:false,text:DOSSIERS[id].verification};}
export function evidenceFor(s,id){const r=s.investigation?.guests[id],d=DOSSIERS[id],out=[];if(!d)return out;
 for(const key of r?.questioned||[]){if(r.verified&&d.clears.includes(key))continue;out.push({id:`question-${id}-${key}`,kind:'contradiction',text:key==='dob'?'证件与预约的生日不一致，解释尚未得到核实。':'罗诚口述没有行李，预约却记着长工具袋。'});}
 if(id==='luo'){
  if(s.clues.some(c=>c.id==='luo0')&&s.clues.some(c=>c.id==='tang1'))out.push({id:'luo0',kind:'contradiction',text:'罗诚否认到过北桥，却说出红封皮内页缺角；你没有向他描述记录。'});
  if(r?.verified)out.push({id:'verify-luo',kind:'support',text:'回拨查到原始预约：罗诚要求放置长工具袋。'});
  if(s.clues.some(c=>c.id==='gu0'))out.push({id:'gu0',kind:'support',text:'顾远的照片拍到罗诚携带长工具袋。'});
  if(s.clues.some(c=>c.id==='luonight'))out.push({id:'luonight',kind:'support',text:'夜间猫眼观察：罗诚桌边露出布包铁器。'});
 }
 return out;
}
export function assignGuard(s,id,selected){if((!s.layoutVersion&&!guardReach(s.rooms,id))||s.day!==2||s.stage!=='ready'||!s.rooms.some(r=>r.role==='sheriff'&&r.alive)||!s.rooms.some(r=>r.id===id&&r.role!=='sheriff'&&r.alive))return false;const available=evidenceFor(s,id),picked=available.filter(e=>selected.includes(e.id));if(new Set(selected).size!==2||picked.length!==2||!picked.some(e=>e.kind==='contradiction')||!picked.some(e=>e.kind==='support'))return false;if(s.layoutVersion)requestGuard(s,id);else s.guard=id;s.guardEvidence=picked.map(e=>e.id);return true;}
export function canKillerChase(s){return !!s.rooms?.some(r=>r.role==='killer'&&r.alive&&s.guard!==r.id)&&!s.killerChaseUsed;}
export function repairThreat(s){return s.day===2&&!s.hotelChaseUsed?'hotel':null;}
