// Rules shared by the room planner, night shift, and morning register.
export function doorPosition(room){return room.z??(room.col*3+1.5+(room.mirror&&room.shape!=='S'?3:0));}
export function guardReach(rooms,id){const officer=rooms.find(r=>(r.id||r.guestId)==='chen'&&r.alive!==false),target=rooms.find(r=>(r.id||r.guestId)===id&&r.alive!==false);return !!officer&&!!target&&Math.abs(doorPosition(officer)-doorPosition(target))<=6;}
export function remember(s,key,text){s.events??=[];if(!s.events.some(e=>e.key===key))s.events.push({key,text});}
export function review(s){return (s.events||[]).map(e=>e.text);}
export const OBSERVATIONS={lin:'旧手袋旁立着一张合照。她把照片朝向床铺。',zhou:'扳手和绝缘胶带摊在桌上，手套留着机油痕。',xu:'相机旁晾着三张照片，窗边的一张只有空走廊。',tang:'药箱放在桌上，箱盖闭合，锁扣扣着；看不见箱内的东西。',luo:'床边藏着长工具袋，一端露出布包铁器。',chen:'公文包旁摊着剪报，标题提到一件布包铁器。',gu:'相机与底片袋摆在一起，镜头还没有盖上。'};
