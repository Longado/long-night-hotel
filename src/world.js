import {build as buildPrologue} from './prologue-scene.js';
import {createSconce} from './environment-art.js';
import * as T from 'three';
import {createCharacter,characterController,characterPortrait,characterAssetState,characterAssetStates,hasCharacter,preloadCharacters} from './character-sprite.js';
import {createProp,propLayout,propController,preloadProps,isSharedPropAsset} from './guest-props.js';
export {preloadCharacters,preloadProps};
import {FIXED_ROOMS,paintingState} from './rules.js';
let scene,camera,renderer,flash,ambient,mode='title',doorMeshes=[],person,barGroup,lightPower=1,held,crisp=true,sway=true,previousYaw=0,previousPitch=0;
let prologueWorld,wallPatch,paintingTexture,paintingCanvas,paintingKey='',peopleMeshes=new Map(),characterInstances=new Set(),propInstances=new Set(),belongingsGroup=null,propViewRestore=null;
const canvas=document.querySelector('#world');
const materials=new Map();
function mat(c){if(!materials.has(c))materials.set(c,new T.MeshStandardMaterial({color:c,roughness:.85,flatShading:true}));return materials.get(c)}
function box(w,h,d,c,x,y,z,parent=scene){const o=new T.Mesh(new T.BoxGeometry(w,h,d),mat(c));o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
function label(text,w=.45,h=.2,bg='#b39a64',fg='#211e18'){const c=document.createElement('canvas');c.width=256;c.height=96;const a=c.getContext('2d');a.fillStyle=bg;a.fillRect(0,0,256,96);a.fillStyle=fg;a.font='bold 50px Georgia';a.textAlign='center';a.fillText(text,128,64);const tx=new T.CanvasTexture(c);tx.magFilter=T.NearestFilter;return new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:tx}));}
function texture(colors){const c=document.createElement('canvas');c.width=c.height=64;let n=17;const ctx=c.getContext('2d');for(let x=0;x<64;x++)for(let y=0;y<64;y++){n=(n*16807)%2147483647;ctx.fillStyle=colors[n%colors.length];ctx.fillRect(x,y,1,1)}const t=new T.CanvasTexture(c);t.magFilter=T.NearestFilter;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(4,16);return t}
function surface(kind){
 const key='surface-'+kind;if(materials.has(key))return materials.get(key);
 const c=document.createElement('canvas');c.width=c.height=128;const a=c.getContext('2d');
 a.fillStyle=kind==='wall'?'#66664e':kind==='wood'?'#70533b':'#503532';a.fillRect(0,0,128,128);
 if(kind==='wood'){for(let x=0;x<128;x+=16){a.fillStyle=x%32?'#796044':'#624732';a.fillRect(x,0,14,128);a.fillStyle='#8b7150';a.fillRect(x+2,0,1,128);for(let y=0;y<128;y+=13){a.fillStyle='#513c2d';a.fillRect(x+4+(y%7),y,1,8);}}}
 if(kind==='wall'){a.strokeStyle='#7a7757';a.lineWidth=1;for(let x=-16;x<144;x+=32)for(let y=-16;y<144;y+=32){a.beginPath();a.moveTo(x+16,y);a.lineTo(x+31,y+16);a.lineTo(x+16,y+32);a.lineTo(x+1,y+16);a.closePath();a.stroke();a.fillStyle='#575b47';a.beginPath();a.ellipse(x+16,y+16,3,6,0,0,Math.PI*2);a.fill();}}
 if(kind==='carpet'){a.strokeStyle='#685044';a.lineWidth=1;for(let x=0;x<128;x+=32)for(let y=0;y<128;y+=32){a.beginPath();a.moveTo(x+16,y+5);a.lineTo(x+27,y+16);a.lineTo(x+16,y+27);a.lineTo(x+5,y+16);a.closePath();a.stroke();a.fillStyle='#603d37';a.fillRect(x+13,y+13,6,6);}let n=47;for(let i=0;i<2200;i++){n=n*16807%2147483647;const x=n%128;n=n*16807%2147483647;a.fillStyle=i%2?'#583a35':'#49312f';a.globalAlpha=.18;a.fillRect(x,n%128,1,1);}a.globalAlpha=1;}
 const tx=new T.CanvasTexture(c);tx.colorSpace=T.SRGBColorSpace;tx.magFilter=T.NearestFilter;tx.minFilter=T.LinearMipmapLinearFilter;tx.wrapS=tx.wrapT=T.RepeatWrapping;
 tx.repeat.set(kind==='carpet'?4:1,kind==='carpet'?20:1);
 const m=new T.MeshStandardMaterial({map:tx,roughness:.88,flatShading:true});materials.set(key,m);return m;
}
function framedPicture(side,z){
 const group=new T.Group();group.position.set(side*1.86,1.9,z);group.rotation.y=side<0?Math.PI/2:-Math.PI/2;scene.add(group);
 box(.72,.55,.09,0x342a22,0,0,0,group);box(.61,.44,.03,0xb2a382,0,0,.055,group);
 box(.51,.15,.01,0x566655,0,-.1,.075,group);box(.34,.12,.01,0x6a746a,-.06,.02,.075,group);box(.075,.075,.02,0xc5b38d,.16,.12,.08,group);
}
function radiator(side,z){
 box(.12,.58,1.05,0x424942,side*1.87,.46,z);
 for(let i=0;i<7;i++)box(.24,.62,.095,0x929582,side*1.87,.48,z-.44+i*.145);
 box(.08,.06,1.2,0xaea58a,side*1.79,.79,z);
}
function frameDoor(group){
 for(const x of [-.66,.66]){box(.13,2.52,.17,0xa28658,x,1.26,.09,group);box(.035,2.42,.04,0xd1b47c,x-.025,1.26,.2,group);}
 box(1.47,.14,.17,0xa28658,0,2.52,.09,group);box(1.30,.035,.25,0xaa9572,0,.018,.02,group);
 for(const x of [-.29,.29]){box(.44,.83,.035,0x3e3126,x,.69,.148,group);box(.38,.76,.03,0x6e5237,x,.69,.17,group);box(.44,.40,.035,0x3e3126,x,1.4,.148,group);box(.38,.34,.03,0x70563b,x,1.4,.17,group);}
 const eye=new T.Mesh(new T.TorusGeometry(.024,.007,5,12),mat(0xb4a071));eye.position.set(0,1.53,.2);group.add(eye);for(let i=0;i<5;i++)box(.014,.04+i*.009,.003,0x9a8b70,-.45+i*.16,.18+(i%2)*.1,.14,group);
 box(.055,.24,.04,0x9b875d,.4,1.02,.22,group);box(.18,.035,.065,0xc3ad7c,.36,1.05,.25,group);
}
function bulb(x,y,z,c=0xffc887,power=2){
 const l=new T.PointLight(c,power*3,8,1.5);l.position.set(x,y,z);scene.add(l);
 if(Math.abs(x)>1.5&&z<21){const side=Math.sign(x),fixture=createSconce();fixture.position.set(side*1.89,y+.10,z);fixture.rotation.y=side<0?Math.PI/2:-Math.PI/2;scene.add(fixture);}
 else{const b=new T.Mesh(new T.CylinderGeometry(.09,.17,.23,12),new T.MeshStandardMaterial({color:0xb9a47b,emissive:0xe7b773,emissiveIntensity:.3,roughness:1}));b.position.set(x,y+.1,z);scene.add(b);}
}
function proceduralAvatar(g,x=0,z=0){const group=new T.Group();group.position.set(x,0,z);scene.add(group);box(.56,.73,.32,g.color,0,1.02,0,group);box(.23,.7,.25,0x292c2b,-.16,.35,0,group);box(.23,.7,.25,0x292c2b,.16,.35,0,group);box(.18,.7,.2,g.color,-.38,1.0,0,group);box(.18,.7,.2,g.color,.38,1.0,0,group);box(.17,.2,.2,g.face,-.38,.65,.02,group);box(.17,.2,.2,g.face,.38,.65,.02,group);const head=new T.Mesh(new T.SphereGeometry(.26,6,5),mat(g.face));head.scale.y=1.15;head.position.y=1.66;group.add(head);box(.46,.15,.39,0x292521,0,1.91,-.03,group);box(.065,.038,.02,0x252523,-.105,1.7,.232,group);box(.065,.038,.02,0x252523,.105,1.7,.232,group);box(.10,.022,.02,0x704c40,0,1.55,.245,group);
 group.name='guest-'+g.id;
 if(g.id==='lin'){box(.53,.13,.42,0x8e8c80,0,1.89,-.02,group);box(.22,.24,.16,0x8e8c80,0,1.76,-.23,group);box(.58,.16,.36,0xa99a74,0,1.28,.03,group);}
 if(g.id==='tang'){box(.26,.42,.34,0x252623,0,1.65,-.17,group);box(.08,.52,.025,0xd0c2a3,0,1.02,.18,group);box(.13,.13,.03,0xc4b795,.16,1.17,.19,group);}
 if(g.id==='chen'){for(const x of [-.105,.105]){box(.16,.08,.035,0xaeb1a2,x,1.7,.25,group);box(.12,.045,.02,0x3c4645,x,1.7,.273,group);}box(.055,.016,.04,0xaeb1a2,0,1.7,.25,group);box(.06,.4,.03,0x272729,0,1.18,.18,group);}
 if(g.id==='luo'){box(.51,.12,.45,0x353329,0,1.91,.02,group);box(.50,.025,.16,0x353329,0,1.85,.25,group);box(.04,.08,.015,0x74513f,-.15,1.63,.24,group);}
 if(['gu','xu'].includes(g.id)){box(.035,.48,.035,0x292923,-.18,1.11,.19,group);box(.035,.48,.035,0x292923,.18,1.11,.19,group);box(.3,.2,.14,0x343b3b,0,.91,.24,group);box(.11,.11,.08,0x9faaa4,0,.91,.35,group);}
 if(g.id==='zhou'){box(.13,.44,.03,0x4d463b,-.15,1.13,.18,group);box(.13,.44,.03,0x4d463b,.15,1.13,.18,group);}
 return group}
export function avatar(g,x=0,z=0){
 if(!hasCharacter(g.id))return proceduralAvatar(g,x,z);
 const fallback=proceduralAvatar(g);
 const group=createCharacter(fallback,{id:g.id,kind:mode==='reception'?'expressions':'directions'});
 group.position.set(x,mode==='reception'?.05:mode==='night'?-.03:0,z);scene.add(group);characterInstances.add(group);return group;
}
export function setGuestExpression(expression){characterController(person)?.setExpression(expression);}
export function getCharacterState(){
 const active=person?.userData.characterId||[...characterInstances].find(g=>g.visible)?.userData.characterId||'tang';
 return {mode,assets:characterAssetState(active),assetsByGuest:characterAssetStates(),props:getPropState(),characters:[...characterInstances].map(g=>characterController(g).snapshot())};
}
export function getPropState(){return [...propInstances].map(group=>propController(group).snapshot());}
function removeActor(group){
 scene.remove(group);const controller=characterController(group);if(!controller)return;
 controller.dispose();characterInstances.delete(group);
 group.traverse(o=>{o.geometry?.dispose();o.customDepthMaterial?.dispose();o.customDistanceMaterial?.dispose();if(o.material&&!Array.from(materials.values()).includes(o.material)){o.material.map?.dispose();o.material.dispose();}});
}
export function setLightPower(power){
 lightPower=Math.max(0,Math.min(1,power));
 scene?.traverse(o=>{if(o.isLight&&o!==flash){o.userData.normalIntensity??=o.intensity;o.intensity=o.userData.normalIntensity*lightPower;}for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.userData.environmentGlow!==undefined)m.emissiveIntensity=m.userData.environmentGlow*lightPower;});
}
function guestProps(id,x,y,z){
 const group=new T.Group();group.name='belongings-'+id;group.position.set(x,y,z);scene.add(group);belongingsGroup=group;
 const b=(w,h,d,c,x,y,z)=>box(w,h,d,c,x,y,z,group);
 if(mode==='reception'){const fill=new T.PointLight(0xffdfb5,.6,1.6,2);fill.name='belongings-fill';fill.position.set(0,.48,.55);group.add(fill);}
 function fallbackFor(key){
  const fallback=new T.Group();
  const f=(w,h,d,c,x,y,z)=>box(w,h,d,c,x,y,z,fallback);
  const bag=(color,w=.48)=>{f(w,.28,.24,color,0,.14,0);f(w*.5,.035,.035,0x272a24,0,.38,0);for(const x of [-w*.25,w*.25])f(.03,.1,.035,0x272a24,x,.33,0);};
  if(key==='handbag')bag(0x4e4937,.42);
  if(key==='briefcase')bag(0x463b30);
  if(key==='camera'){f(.28,.17,.16,0x303a3a,0,.085,0);f(.12,.12,.12,0x9daba9,0,.09,.12);f(.08,.08,.01,0x17212a,0,.09,.185);}
  if(key==='medicine-case'){bag(0x687060);f(.51,.065,.27,0x77816e,0,.29,0);f(.09,.10,.025,0xb09e73,0,.24,.145);f(.025,.035,.008,0x3d4238,0,.23,.162);for(const x of [-.17,.17])f(.025,.25,.012,0x3a4037,x,.16,.129);}
  if(key==='duffel'){f(.85,.19,.24,0x414737,0,.095,0);for(const x of [-.23,.2])f(.06,.20,.255,0x89816a,x,.095,0);}
  if(key==='toolbox')f(.4,.07,.18,0x3b342c,0,.04,.02);
  if(key==='wrench'){f(.32,.025,.05,0x9eaba4,0,.018,0);f(.07,.03,.12,0x9eaba4,-.15,.018,0);}
  return fallback;
 }
 for(const spec of propLayout(id)){const prop=createProp(spec,fallbackFor(spec.key),{guestId:id,tableY:y});group.add(prop);propInstances.add(prop);}
 // Story-bearing papers and exposed details remain independent of stock assets.
 if(id==='lin'){b(.25,.32,.035,0x72573c,.37,.16,.02);b(.21,.27,.01,0xc1b18a,.37,.17,.045);for(const [x,h] of [[.32,.12],[.42,.15]]){b(.065,h,.01,0x636d62,x,.11,.052);b(.065,.07,.01,0xd0a887,x,.11+h/2+.025,.054);}}
 if(id==='luo'){b(.35,.065,.07,0xa1a89b,.49,.12,.02);b(.13,.14,.07,0xa1a89b,.66,.15,.02);}
 if(id==='chen'){const paperZ=mode==='reception'?-.06:0;b(.38,.015,.40,0xc3b78f,.46,.01,.06+paperZ);const paper=label('铁器 / 失踪',.35,.19,'#c3b78f','#383c37');paper.rotation.x=-Math.PI/2;paper.position.set(.46,.024,.05+paperZ);group.add(paper);for(let i=0;i<4;i++)b(.28,.004,.012,0x79715c,.46,.025,.15+i*.025+paperZ);}
 if(id==='zhou')b(.13,.1,.13,0x373e3d,.22,.05,-.13);
 if(['xu','gu'].includes(id)){for(let i=0;i<3;i++){b(.17,.01,.22,0xd9ceb0,.27+i*.07,.015+i*.015,.02);b(.13,.013,.15,0x515d5d,.27+i*.07,.02+i*.015,.02);}}
 return group;
}
export function setPropCloseup(enabled){
 if(!enabled){if(propViewRestore){camera.position.copy(propViewRestore.position);camera.quaternion.copy(propViewRestore.quaternion);camera.fov=propViewRestore.fov;camera.updateProjectionMatrix();propViewRestore=null;}return;}
 if(!belongingsGroup||!['reception','peep'].includes(mode))return;
 propViewRestore??={position:camera.position.clone(),quaternion:camera.quaternion.clone(),fov:camera.fov};
 const bounds=new T.Box3().setFromObject(belongingsGroup),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
 const distance=Math.max(.95,size.x/(2*Math.tan(T.MathUtils.degToRad(25))*camera.aspect*.62));
 camera.fov=50;camera.position.set(center.x,center.y+.72,center.z+distance);camera.lookAt(center);camera.updateProjectionMatrix();
}

const portraits=new Map();
export function portrait(id){
 const painted=characterPortrait(id);if(painted)return painted;
 if(portraits.has(id))return portraits.get(id);if(!person||!renderer)return '';
 const photo=new T.Scene();photo.background=new T.Color(0x8b9387);const guest=(person.getObjectByName('character-fallback')||person).clone(true);guest.visible=true;guest.position.set(0,0,0);guest.rotation.set(0,0,0);photo.add(guest,new T.HemisphereLight(0xffffff,0x706856,3));
 const light=new T.DirectionalLight(0xffe2b2,2);light.position.set(-1,2,2);photo.add(light);
 const lens=new T.PerspectiveCamera(28,65/82,.05,10);lens.position.set(0,1.67,1.9);lens.lookAt(0,1.62,0);
 const size=renderer.getSize(new T.Vector2());renderer.setSize(130,164,false);renderer.render(photo,lens);const url=canvas.toDataURL('image/png');renderer.setSize(size.x,size.y,false);portraits.set(id,url);return url;
}
function buildPainting(){
 const group=new T.Group();group.position.set(-1.08,1.6,.11);scene.add(group);
 box(.96,1.34,.10,0x332a23,0,0,0,group);box(.87,1.25,.06,0xa18351,0,0,.06,group);
 paintingCanvas=document.createElement('canvas');paintingCanvas.width=192;paintingCanvas.height=288;
 paintingTexture=new T.CanvasTexture(paintingCanvas);paintingTexture.magFilter=T.NearestFilter;paintingTexture.colorSpace=T.SRGBColorSpace;
 const canvas=new T.Mesh(new T.PlaneGeometry(.77,1.15),new T.MeshBasicMaterial({map:paintingTexture}));canvas.name='painted-surface';canvas.position.z=.10;group.add(canvas);const traces=new T.Group();traces.name='paint-traces';traces.visible=false;group.add(traces);for(let i=0;i<5;i++){const smear=box(.025,.30+i*.055,.012,0x243a3b,-.15+i*.065,-.7-i*.065,.04,traces);smear.rotation.z=.12*i;}
 for(const x of [-.29,.29])box(.03,.10,.015,0xc6af81,x,-.61,.10,group);
 paintingKey='';drawPainting({doors:[],phase:'quiet'});return group;
}
function drawPainting(state){
 const key=state.phase+state.doors.join(',');if(key===paintingKey)return;paintingKey=key;
 const c=paintingCanvas.getContext('2d');c.fillStyle='#344544';c.fillRect(0,0,192,288);
 c.fillStyle='#81775d';c.beginPath();c.moveTo(0,0);c.lineTo(77,103);c.lineTo(77,184);c.lineTo(0,288);c.fill();
 c.beginPath();c.moveTo(192,0);c.lineTo(115,103);c.lineTo(115,184);c.lineTo(192,288);c.fill();
 c.fillStyle='#643f36';c.beginPath();c.moveTo(0,288);c.lineTo(77,184);c.lineTo(115,184);c.lineTo(192,288);c.fill();
 c.fillStyle='#ddc184';c.fillRect(81,108,30,62);
 for(const r of FIXED_ROOMS){const depth=(r.z-3)/6,w=26-depth*7,h=120-depth*28,y=78+depth*18,x=r.side===0?7+depth*28:185-depth*28-w;
  c.fillStyle='#382d27';c.fillRect(x,y,w,h);c.strokeStyle='#bba476';c.strokeRect(x,y,w,h);c.fillStyle='#d3bb83';c.font='8px monospace';c.fillText(r.number,x+2,y+13);
  if(state.doors.includes(r.number)&&state.phase!=='trace'){c.fillStyle='#172021';c.beginPath();c.ellipse(x+w/2,y+h-35,6,8,0,0,Math.PI*2);c.fill();c.fillRect(x+w/2-7,y+h-28,14,30);}
 }
 if(state.phase==='emerging'){c.fillStyle='#1c2729';c.beginPath();c.ellipse(96,170,17,23,0,0,Math.PI*2);c.fill();c.fillRect(75,190,42,98);}
 if(state.phase==='trace'){c.fillStyle='#152a2c';for(let i=0;i<5;i++)c.fillRect(74+i*7,226+i*7,4,62);}
 paintingTexture.needsUpdate=true;
}
function hotelShadow(){
 const group=new T.Group();scene.add(group);
 const shade=new T.MeshStandardMaterial({color:0x344b4c,roughness:.65});shade.color.setHex(0x637979);shade.emissive=new T.Color(0x253e48);shade.emissiveIntensity=.3;shade.side=T.DoubleSide;
 for(let i=0;i<5;i++){const skin=shade.clone();const strip=new T.Mesh(new T.BoxGeometry(.13,1.75-(i%3)*.21,.055),skin);strip.position.set((i-2)*.12,1.03,(i%2)*.11);strip.rotation.z=(i-2)*.11;group.add(strip);}
 const glow=new T.PointLight(0x8abacc,.7,2);glow.position.y=1.3;group.add(glow);return group;
}
function base(){barGroup=null;person=null;peopleMeshes=new Map();characterInstances=new Set();propInstances=new Set();belongingsGroup=null;propViewRestore=null;lightPower=1;scene=new T.Scene();scene.background=new T.Color('#151d21');scene.fog=new T.Fog('#151d21',7,32);ambient=new T.HemisphereLight(0xabbfce,0x25181c,.85);scene.add(ambient);camera=new T.PerspectiveCamera(68,innerWidth/innerHeight,.05,70);}
function corridor(rooms){rooms=[...FIXED_ROOMS.map(f=>({...f,id:'empty-'+f.number,...rooms.find(r=>r.number===f.number)})),...rooms.filter(r=>r.number==='000')];base();const carpet=box(4,.1,28,0x633b34,0,-.08,12);carpet.material=surface('carpet');box(.07,.02,28,0xa38a54,-1.85,.01,12);box(.07,.02,28,0xa38a54,1.85,.01,12);box(4,.2,28,0x383c33,0,3,12);
 for(const side of [-1,1]){
  const openings=rooms.filter(r=>(r.side===0?-1:1)===side).map(r=>[r.z-.76,r.z+.76]).sort((a,b)=>a[0]-b[0]);
  const spans=[];let start=-2;
  for(const [lo,hi] of openings){if(lo>start)spans.push([start,Math.min(lo,26)]);start=Math.max(start,hi);}
  if(start<26)spans.push([start,26]);
  box(.18,3,28,0x5c6250,side*2,1.5,12);
  for(let z=-1;z<26;z+=1.5){
   box(.025,1.76,1.5,0xffffff,side*1.90,1.99,z+.75).material=surface('wall');
   if(!openings.some(([lo,hi])=>z+.0225>lo&&z-.0225<hi))box(.10,.88,.045,0x8c7351,side*1.86,.52,z);
  }
  box(.2,1.05,28,0x352d26,side*1.96,.52,12);
  for(const [lo,hi] of spans){if(hi<=lo)continue;box(.26,.12,hi-lo,0x715b40,side*1.93,.09,(lo+hi)/2);box(.23,.07,hi-lo,0x9a855a,side*1.94,1.08,(lo+hi)/2);}
  for(let z=6;z<21;z+=6)bulb(side*1.7,2.25,z,0xffc48a,.32);
 }

 doorMeshes=[];for(const r of rooms){const side=r.side===0?-1:1;const group=new T.Group();group.position.set(side*1.96,0,r.z);group.rotation.y=side===-1?Math.PI/2:-Math.PI/2;scene.add(group);box(1.36,2.5,.13,0x171916,0,1.25,0,group);const door=box(1.16,2.35,.17,0x57432e,0,1.19,.05,group);door.material=surface('wood').clone();frameDoor(group);const plaque=label(r.number);plaque.position.set(0,1.97,.16);group.add(plaque);box(.09,.07,.09,0xc8ac6e,.4,1.0,.18,group);box(.028,.028,.03,0x080a0a,0,1.53,.18,group);const glow=box(1.1,.045,.03,0xffc578,0,.04,.16,group);glow.material=new T.MeshBasicMaterial({color:0xe2ac60});doorMeshes.push({id:r.id,door,glow,group})}
 for(const side of [-1,1]){const free=[4.5,10.5,16.5,19.5].filter(z=>!rooms.some(r=>(r.side===0?-1:1)===side&&Math.abs(r.z-z)<1.55));free.forEach((z,i)=>{framedPicture(side,z);if(i===0)radiator(side,z);});}for(const z of [3,9,15,21])box(4,.10,.14,0x5b503d,0,2.88,z);
 box(2.9,3,.2,0x4b5146,-.55,1.5,-.1);box(1.1,.4,.2,0x4b5146,1.45,2.8,-.1);box(.9,1,.18,0x323f39,0,1.5,.05);box(.78,.88,.08,0x849082,0,1.5,.17);for(const x of [-.2,.2]){box(.13,.2,.06,0x313d35,x,1.3,.24);box(.035,.12,.08,0xc2ae70,x,1.33,.27);}box(.7,.06,.08,0xaaa181,0,1.97,.15);const elec=label('A / B',.7,.26,'#525e56','#f2dfb0');elec.position.set(0,1.55,.13);scene.add(elec);
 // Keep the existing safe-zone threshold and add a furnished, warm destination.
 box(4,.04,.1,0xb99c60,0,.025,20.8);
 for(const x of [-1.83,1.83]){box(.18,2.9,.24,0x382b23,x,1.45,21);box(.055,2.8,.27,0x9d8057,x,1.4,20.98);}
 box(3.8,.25,.24,0x382b23,0,2.82,21);
 const entry=label('BAR',.8,.24,'#292823','#d7bc83');entry.position.set(0,2.76,20.85);entry.rotation.y=Math.PI;scene.add(entry);
 box(4,3,.2,0x313b3c,0,1.5,26.4);
 box(3.3,1.05,.68,0xffffff,0,.52,25).material=surface('wood');
 box(3.55,.12,.85,0x4a3527,0,1.11,25);
 for(const x of [-1.07,0,1.07]){box(.93,.72,.04,0x302921,x,.55,24.64);box(.82,.61,.025,0x70523b,x,.55,24.605);}
 box(3.2,.04,.04,0xb29660,0,.23,24.43);
 const mirror=box(2.85,1.32,.09,0x485655,0,1.97,26.16);mirror.material=new T.MeshStandardMaterial({color:0x485655,roughness:.35,metalness:.35});
 for(const y of [1.33,1.96,2.62])box(3.15,.07,.36,0x5a4431,0,y,25.99);
 for(const x of [-1.55,1.55])box(.08,1.36,.35,0x5a4431,x,1.97,25.99);
 for(let i=0;i<12;i++){
  const x=-1.3+(i%6)*.5,y=i<6?1.52:2.15;const bottle=new T.Group();scene.add(bottle);
  const color=[0x465c47,0x6b4830,0x384b50][i%3];
  box(.12,.26,.12,color,x,y,25.83,bottle);box(.055,.13,.065,color,x,y+.185,25.83,bottle);box(.08,.095,.008,0xc1ac83,x,y-.015,25.765,bottle);
 }
 for(const x of [-1,0,1]){
  const seat=new T.Mesh(new T.CylinderGeometry(.24,.24,.1,12),mat(0x563b36));seat.position.set(x,.78,23.65);scene.add(seat);
  for(const dx of [-.16,.16])for(const dz of [-.14,.14])box(.045,.71,.045,0x342c26,x+dx,.36,23.65+dz);
  box(.36,.035,.035,0xa78c5e,x,.3,23.47);
 }
 box(.45,.06,.3,0x3b3c32,.72,1.2,24.9);box(.085,.17,.085,0xc6b997,.68,1.3,24.9);
 for(const x of [-1.12,1.12]){box(.018,.5,.018,0x30322d,x,2.74,24.5);bulb(x,2.43,24.5,0xffc48a,2.5);}
 wallPatch=buildPainting();flash=new T.SpotLight(0xffe4b2,32,16,.55,.8,1.3);flash.castShadow=true;flash.shadow.mapSize.set(1024,1024);flash.shadow.bias=-.001;scene.add(flash,flash.target);camera.position.set(0,1.65,22);camera.rotation.order='YXZ';scene.add(camera);
 held=new T.Group();camera.add(held);const hand=box(.12,.12,.38,0x8a7054,.30,-.30,-.5,held);const torch=new T.Mesh(new T.CylinderGeometry(.11,.10,.32,7),mat(0x282d2b));torch.rotation.x=Math.PI/2;torch.position.set(.29,-.27,-.62);held.add(torch);held.traverse(o=>o.castShadow=false);torch.position.set(.29,-.27,-.72);previousYaw=0;previousPitch=0;
}
export function init(){try{renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;setQuality(crisp);setMode('title',[]);return true}catch{return false}}
export function setMode(next,rooms=[],g=null){mode=next;if(scene){scene.traverse(o=>{characterController(o)?.dispose();propController(o)?.dispose();if(isSharedPropAsset(o))return;o.customDepthMaterial?.dispose();o.customDistanceMaterial?.dispose();o.geometry?.dispose();for(const material of Array.isArray(o.material)?o.material:[o.material])if(material&&!Array.from(materials.values()).includes(material)){for(const value of Object.values(material))if(value?.isTexture)value.dispose();material.dispose();}})}if(next==='prologue'||next==='reception'){corridor([]);prologueWorld=buildPrologue({surface,scene,camera});held.visible=false;flash.intensity=0;if(next==='reception'){prologueWorld.open();person=avatar(g||{},-1,-5);guestProps(g?.id,-1.65,1.16,-3.28);camera.position.set(-.9,1.85,-2);camera.lookAt(-1,1.4,-5);}return;}if(next==='night'||next==='title'||next==='ending'){corridor(next==='ending'?[{id:'unknown',number:'000',side:1,z:19.5}]:next==='title'?[]:rooms);if(next==='ending'){camera.position.set(-.9,1.65,21.8);camera.lookAt(1.9,1.45,19.5);ambient.intensity=.8;held.visible=false;}else if(next==='title'){camera.position.set(-.5,1.6,3);camera.lookAt(.1,1.55,24);ambient.intensity=1.2;held.visible=false;}else ambient.intensity=.55;const lobby=buildPrologue({surface,scene,camera});lobby.open();}
 else{base();scene.fog=null;box(12,.1,12,0x624037,0,-.05,0);box(12,4,.2,0x646953,0,2,-2);for(let x=-4;x<4;x+=1.5)box(1.5,2.4,.025,0xffffff,x,2.3,-1.86).material=surface('wall');box(12,1.1,.3,0x45382c,0,.55,-1.9);const win=box(2.4,1.7,.08,0x738188,-1.5,2,-1.75);win.material=new T.MeshBasicMaterial({map:texture(['#65757b','#71818a','#8a9396','#576975'])});for(const x of [-2.74,-1.5,-.26])box(.09,1.87,.18,0x302e28,x,2,-1.64);for(const y of [1.09,2,2.91])box(2.58,.09,.18,0x302e28,-1.5,y,-1.64);box(2.68,.1,.35,0x65523d,-1.5,1.08,-1.57);bulb(1.6,2.1,.6,0xffd092,3);if(next==='reception'){box(6,1.0,1.2,0x674b35,0,.5,1.5);box(6,.12,1.35,0xffffff,0,1.04,1.5).material=surface('wood');for(const x of [-2,-1,0,1,2]){box(.89,.67,.035,0x322b24,x,.51,2.12);box(.79,.57,.04,0x6b523b,x,.51,2.15);}const bell=new T.Mesh(new T.CylinderGeometry(.04,.11,.08,12),mat(0xb8a073));bell.position.set(1.25,1.15,1.8);scene.add(bell);box(.75,.035,.5,0xdfd0aa,.6,1.13,1.7);guestProps(g?.id,-.7,1.11,1.55);person=avatar(g||{},0,.3);camera.position.set(.1,1.85,3.6);camera.lookAt(0,1.45,.3)}else{box(1.35,.5,2.1,0x46362d,-1.1,.3,-.2);box(1.36,.12,2.05,0xb8b097,-1.1,.6,-.2);box(1.38,.05,1.35,0x6d7768,-1.1,.69,.12);box(1.5,.9,.1,0xffffff,-1.1,.65,-1.3).material=surface('wood');box(.82,.12,.4,0xcac2aa,-1.1,.72,-.9);box(1.05,.78,.65,0x6e543b,.72,.39,.3);if(g.type!=='suite')guestProps(g.id,.62,.79,.35);else box(.1,.14,.1,0xb3aa91,.35,.88,.35);if(g.type==='suite'){box(5,2.8,.15,0x4b5349,0,1.4,-.25);box(1.1,2.25,.10,0x634c35,-1,1.12,-.14);box(1.4,.55,.55,0x74674f,-1,.3,1);box(1.4,.45,.16,0x80705b,-1,.68,.76);}person=avatar(g,-.2,g.type==='suite'?.65:-.55);person.visible=g.alive!==false&&!g.away;camera.position.set(0,1.65,3.7);camera.lookAt(.1,1.05,-.4)}}}
export function pose(x,z,yaw,pitch,moving=false,time=0,dt=0){
 if(mode!=='night')return;camera.position.set(x,1.65,z);camera.rotation.set(pitch,yaw,0,'YXZ');
 if(held){const smooth=1-Math.exp(-dt*12);const dx=sway?Math.max(-.035,Math.min(.035,(previousYaw-yaw)*.22))+(moving?Math.sin(time*8)*.009:0):0;const dy=sway?Math.max(-.02,Math.min(.02,(previousPitch-pitch)*.18))+(moving?Math.cos(time*16)*.006:0):0;held.position.x+=(dx-held.position.x)*smooth;held.position.y+=(dy-held.position.y)*smooth;}
 previousYaw=yaw;previousPitch=pitch;
}
export function setQuality(clear){crisp=clear;if(!renderer)return;const width=clear?Math.min(innerWidth,1600):Math.min(640,innerWidth);renderer.setSize(width,Math.round(innerHeight*width/innerWidth),false);canvas.style.imageRendering=clear?'auto':'pixelated';}
export function setHeldVisible(visible){if(held)held.visible=visible;}
export function setSway(enabled){sway=enabled;if(!sway&&held)held.position.set(0,0,0);}

export function update(rooms,on,enemy,time,state={}){if(mode==='night'){if(wallPatch){const picture=paintingState(state);drawPainting(picture);wallPatch.getObjectByName('paint-traces').visible=picture.phase==='trace';wallPatch.getObjectByName('painted-surface').position.z=.1+(picture.phase==='emerging'?.10*(1+Math.sin(time*6)):0);wallPatch.scale.z=picture.phase==='emerging'?1+Math.sin(time*9)*.15:1;wallPatch.rotation.z=picture.phase==='emerging'?Math.sin(time*14)*.014:0;}for(const d of doorMeshes){const r=rooms.find(r=>r.id===d.id);if(!r){d.glow.visible=false;continue;}d.glow.visible=r.alive&&(r.on||r.emergency>0);d.door.scale.x=r.alive?1-Math.min(.4,r.dark/180):.13;d.door.rotation.z=r.dark>15?Math.sin(time*1.2)*.015*r.dark/75:0;d.door.material.color.setHex(r.alive?0xb3a28d:0x272026)}for(const [id,a] of Object.entries(state.actors||{})){
 let mesh=peopleMeshes.get(id);const guest=rooms.find(r=>r.id===id);if(!guest)continue;
 if(!mesh){mesh=avatar(guest);peopleMeshes.set(id,mesh);}
 mesh.visible=!!a.visible&&guest.alive&&!enemy;
 mesh.position.set(a.x,characterController(mesh)?-.03:0,a.z);mesh.rotation.y=a.facing??(a.direction<0?Math.PI:0);
 if(id==='chen'&&state.officerDuty?.status==='holding')mesh.rotation.y=a.x<0?-Math.PI/2:Math.PI/2;
 if(mesh.visible&&a.direction&&!characterController(mesh))mesh.children.slice(1,3).forEach((leg,i)=>leg.rotation.x=Math.sin(time*6+i*Math.PI)*.12);
 }flash.intensity=on?32:0;flash.position.copy(camera.position);const dir=new T.Vector3();camera.getWorldDirection(dir);flash.target.position.copy(camera.position).add(dir.multiplyScalar(8));flash.position.y-=.12;flash.target.position.y-=.5;if(enemy){if(!barGroup||barGroup.userData.kind!==enemy.kind){if(barGroup)removeActor(barGroup);barGroup=enemy.kind==='hotel'?hotelShadow():avatar({id:'luo',color:0x695142,face:0xb79879});barGroup.userData.kind=enemy.kind;}barGroup.visible=true;barGroup.position.set(enemy.x,characterController(barGroup)?-.03:0,enemy.z);const rise=enemy.kind==='hotel'?Math.max(.08,1-Math.max(0,enemy.delay)/2):1;barGroup.scale.set(1,rise,1);if(!characterController(barGroup))barGroup.children.forEach((part,i)=>{if(part.isMesh)part.rotation.z=Math.sin(time*5+i)*.08;});if(characterController(barGroup))barGroup.rotation.set(0,Math.atan2(camera.position.x-enemy.x,camera.position.z-enemy.z),0);else barGroup.lookAt(camera.position.x,barGroup.position.y,camera.position.z)}else if(barGroup){if(barGroup.userData.kind==='hotel'&&state.shadowRetreat){const r=state.shadowRetreat,age=time-r.started,approach=Math.max(.1,(20.45-r.z)/3.4),fold=Math.max(0,age-approach);barGroup.position.z=Math.min(20.45,r.z+age*3.4);barGroup.position.x=r.x+(-1.8-r.x)*Math.min(1,fold);barGroup.scale.y=Math.max(.01,1-fold);if(fold>=1){removeActor(barGroup);barGroup=null;}}else if(barGroup.userData.kind!=='hotel'){removeActor(barGroup);barGroup=null;}}}if(person&&!characterController(person)&&['reception','peep'].includes(mode)){person.rotation.y=Math.sin(time*.8)*.025;person.children.slice(3,7).forEach((arm,i)=>arm.rotation.x=Math.sin(time*1.2+i*.3)*.08);}for(const group of characterInstances)characterController(group).update(camera);renderer?.render(scene,camera)}
export function resize(){if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();setQuality(crisp)}

export function prologuePose(state,yaw,pitch,dt,time){if(mode==='prologue')prologueWorld.update(state,yaw,pitch,dt,time);}
