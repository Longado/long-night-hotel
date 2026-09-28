import {chooseVictim} from './rules.js';
import {remember} from './demo.js';
const living=(s,id)=>s.rooms.find(r=>r.id===id&&r.alive);
function actor(s,r){s.actors??={};return s.actors[r.id]??={id:r.id,x:r.side===0?-.95:.95,z:r.z,visible:false};}
function move(a,z,speed,dt,x=a.x){const dx=x-a.x,dz=z-a.z,d=Math.hypot(dx,dz),step=speed*dt;a.direction=Math.sign(dz);a.facing=Math.atan2(dx,dz);if(d<=step){a.x=x;a.z=z;return true;}a.x+=dx/d*step;a.z+=dz/d*step;return false;}
export function requestGuard(s,id){
 const officer=living(s,'chen'),target=living(s,id);if(!officer||!target)return false;
 const a=actor(s,officer);a.visible=true;a.away=true;s.protection=null;s.guard=null;s.officerDuty={target:id,status:'walking'};return true;
}
export function beginPeopleRound(s){
 const target=chooseVictim(s.rooms,s.guard);
 if(!target){s.stage='finalReady';if(s.guard)remember(s,'guard-effective','陈默实际守在约定的门口；这一轮没有传来呼救。');return false;}
 const k=s.rooms.find(r=>r.role==='killer'&&r.alive),a=actor(s,k);a.visible=true;a.away=true;
 s.victim={id:target.id,number:target.number};s.stage='approach';return true;
}
export function tickPeople(s,dt){
 if(s.paused||!s.layoutVersion)return;
 const duty=s.officerDuty,officer=living(s,'chen');
 if(duty){
  const target=living(s,duty.target);
  if(!officer||!target){s.guard=null;s.officerDuty=null;if(s.actors?.chen)s.actors.chen.visible=false;}
  else {const a=actor(s,officer);a.visible=true;if(move(a,duty.interceptZ??target.z,1.7,dt,duty.interceptX??(target.side===0?-.9:.9))){duty.status='holding';s.guard=target.id;}}
 }
 if(!duty&&s.actors?.chen?.visible&&officer){const a=s.actors.chen;if(move(a,officer.z,1.7,dt,officer.side===0?-.95:.95)){a.visible=false;a.away=false;}}
 if(!['approach','attack'].includes(s.stage))return;
 const killer=s.rooms.find(r=>r.role==='killer'&&r.alive),victim=living(s,s.victim?.id);
 if(!killer||!victim){s.stage='finalReady';if(s.actors?.luo)s.actors.luo.visible=false;return;}
 const a=actor(s,killer),cop=s.actors?.chen;
 // Holding the original door does not remotely restrain a person who already left it.
 const blocked=officer&&duty&&cop&&Math.hypot(cop.z-a.z,cop.x-a.x)<1.5&&(duty.target===killer.id||duty.target===victim.id);
 if(blocked){s.guard=killer.id;s.stage='finalReady';a.visible=false;duty.status='holding';duty.interceptZ=cop.z;duty.interceptX=cop.x;remember(s,'guard-effective','陈默在走廊拦住罗诚，没有让他接近住客。');return;}
 if(s.stage==='approach'){
  if(move(a,victim.z,1.25,dt,victim.side===0?-.85:.85)){s.stage='attack';s.attackRemaining=60;}
 }else{
  s.attackRemaining-=dt;
  if(s.attackRemaining<=0){victim.alive=false;victim.cause='未能阻止房门处的袭击';s.stage='finalReady';a.visible=false;remember(s,`attack-${victim.id}`,`你未能在求助停止前赶到 ${victim.number} 房。`);}
 }
}
export function intervene(s){
 if(!['approach','attack'].includes(s.stage))return false;
 const a=s.actors?.luo;if(!a||Math.hypot(s.player.x-a.x,s.player.z-a.z)>2.6)return false;
 const target=living(s,s.victim?.id);if(!target)return false;
 remember(s,'rescue',`你在 ${target.number} 房${s.stage==='approach'?'外的走廊提前制止了接近':'门口喝止了袭击'}，${target.name}没有受伤。`);
 s.stage='finalReady';a.visible=false;return true;
}

export function atRoom(s,id){return !!living(s,id)&&!s.actors?.[id]?.visible&&!s.actors?.[id]?.away;}
