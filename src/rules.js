export const SHAPES={S:[[0,0],[0,1]],L:[[0,0],[1,0],[0,1]],Q:[[0,0],[1,0],[0,1],[1,1]]};
export const COST={S:1,L:1,Q:2};
export const PRICE={S:20,L:25,Q:35};
export function admit(s,accept){if(!accept&&s.refused>=1)return false;if(!accept)s.refused++;return true;}
export function cells(p){const width=p.shape==='S'?1:2;return SHAPES[p.shape].map(([x,y])=>[p.col+(p.mirror?width-1-x:x),y]);}
export function validPlacement(p,list){const c=cells(p);return c.every(([x])=>x>=0&&x<6)&&!list.some(r=>r.side===p.side&&cells(r).some(([x,y])=>c.some(([a,b])=>a===x&&b===y)));}
export function canStart(guests,rooms,cap){return guests.every(g=>rooms.some(r=>r.guestId===g.id))&&rooms.reduce((n,r)=>n+COST[r.shape],0)<=cap;}
export function tickRooms(s,rooms,dt){if(s.paused)return;for(const r of rooms){const protectedFor=r.on?0:Math.min(dt,r.emergency||0);if(!r.on)r.emergency=Math.max(0,(r.emergency||0)-dt);if(!r.alive)continue;if(s.actors?.[r.id]?.away||s.actors?.[r.id]?.visible){r.dark=0;continue;}if(r.on){r.dark=0;continue;}if(protectedFor>=dt){r.dark=0;continue;}if(s.satiated)continue;r.dark=(protectedFor?0:r.dark||0)+dt-protectedFor;if(r.dark>=75){r.alive=false;r.cause=r.manual?'主动断电后被吞噬':'未能恢复照明，被酒店吞噬';s.satiated=true;break;}}}
export function chooseVictim(rooms,guard){const k=rooms.find(r=>r.role==='killer'&&r.alive);if(!k||guard===k.id)return null;return rooms.filter(r=>r.alive&&r.id!==k.id&&r.id!==guard).sort((a,b)=>({tang:0,gu:1,chen:2}[a.id]??3)-({tang:0,gu:1,chen:2}[b.id]??3)||(a.role==='sheriff')-(b.role==='sheriff')||a.x-b.x)[0]||null;}

export function firstNightTarget(rooms) {
  return rooms.find(r => r.id === 'lin' && r.alive) || rooms.find(r => r.alive) || null;
}
export function triggerFirstOutage(s) {
  if (s.day !== 1 || s.firstOutageTriggered) return null;
  const r = s.rooms.find(r => r.id === s.firstTargetId && r.alive) || firstNightTarget(s.rooms);
  if (!r) return null;
  s.firstTargetId = r.id;
  s.firstOutageTriggered = true;
  s.stage = 'blackout';
  r.on = false; r.dark = 0; r.fault = true;
  return r;
}

// Permanent architecture. Occupancy never changes a door's number or location.
export const FIXED_ROOMS=Object.freeze([
 {number:'101',type:'standard',label:'标准房',side:0,z:3,price:20,detail:'前段 · 独住空间 · 靠近配电箱'},
 {number:'102',type:'standard',label:'标准房',side:1,z:3,price:20,detail:'前段 · 与 101 对门 · 靠近配电箱'},
 {number:'103',type:'standard',label:'标准房',side:0,z:9,price:20,detail:'中段 · 床边小桌 · 与 104 对门'},
 {number:'104',type:'queen',label:'大床房',side:1,z:9,price:25,detail:'中段 · 宽书桌 · 可展开记录'},
 {number:'105',type:'queen',label:'大床房',side:0,z:15,price:25,detail:'后段 · 宽书桌 · 靠近酒吧'},
 {number:'106',type:'suite',label:'套房',side:1,z:15,price:35,detail:'后段 · 外间会客 / 内间休息'},
].map(Object.freeze));
export function assignRoom(s,guestId,number){
 const room=FIXED_ROOMS.find(r=>r.number===number);
 if(!room||!s.guests.some(g=>g.id===guestId)||s.rooms.some(r=>r.number===number&&r.guestId!==guestId))return false;
 s.rooms=[...s.rooms.filter(r=>r.guestId!==guestId),{...room,guestId}];return true;
}
export function fixedReady(guests,rooms){
 return guests.length>0&&rooms.length===guests.length&&new Set(rooms.map(r=>r.number)).size===rooms.length&&
 guests.every(g=>rooms.filter(r=>r.guestId===g.id).length===1)&&rooms.every(r=>FIXED_ROOMS.some(f=>f.number===r.number));
}
export function paintingState(s){
 const doors=(s.rooms||[]).filter(r=>r.alive&&!s.actors?.[r.id]?.away&&!s.actors?.[r.id]?.visible&&!r.on&&!(r.emergency>0)).map(r=>r.number);
 return {doors,phase:s.hotelEscaped?'trace':s.enemy?.kind==='hotel'?'emerging':doors.length?'warning':'quiet'};
}
