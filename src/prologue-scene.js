import * as T from 'three';
import {createCounter,createRecorder,createSconce,createPendant,addLobbyWoodwork} from './environment-art.js';
// This lobby is appended to the same corridor used at night.
export function build({surface,scene,camera}){
 const group=new T.Group();group.name='shared-lobby';scene.add(group);
 const material=c=>new T.MeshStandardMaterial({color:c,roughness:.85,flatShading:true});
 const box=(w,h,d,c,x,y,z,parent=group)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),material(c));m.position.set(x,y,z);parent.add(m);m.receiveShadow=true;return m;};
 const text=(words,w,h,x,y,z)=>{const c=document.createElement('canvas');c.width=512;c.height=160;const a=c.getContext('2d');a.fillStyle='#35382f';a.fillRect(0,0,512,160);a.fillStyle='#d4bd87';a.font='42px "PingFang SC",sans-serif';a.textAlign='center';a.fillText(words,256,95);const tx=new T.CanvasTexture(c);tx.colorSpace=T.SRGBColorSpace;const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:tx}));m.position.set(x,y,z);group.add(m);return m;};
 const lamp=(x,y,z,power)=>{const l=new T.PointLight(0xffc883,power,12,1.5);l.position.set(x,y,z);group.add(l);if(z<-9){const fixture=createSconce();fixture.position.set(x,y+.05,-9.16);fixture.rotation.y=Math.PI;group.add(fixture);l.position.z=-9.4;}else{const shade=createPendant(.43);shade.position.set(x,y+.1,z);group.add(shade);}};
 box(12,.1,22,0x273941,0,-.1,-9);const floor=box(8,.1,9,0x624036,0,0,-4.5);floor.material=surface('carpet').clone();floor.material.map=floor.material.map.clone();floor.material.map.repeat.set(8,9);box(8,.15,9,0x343b36,0,3.2,-4.5);
 for(const x of [-4,4]){box(.2,3.2,9,0x5c685f,x,1.6,-4.5);for(let z=-8;z<0;z+=2)box(.03,1.9,2,0xffffff,x+(x<0?.12:-.12),2,z).material=surface('wall');}
 for(const x of [-2.5,2.5]){box(3,3.2,.25,0x45534f,x,1.6,-9);box(1.5,1.5,.04,0x627a80,x,1.9,-9.15);box(.06,1.5,.08,0x332e28,x,1.9,-9.18);}
 for(const x of [-2.5,2.5])box(2.9,1.88,.025,0xffffff,x,2.01,-8.858).material=surface('wall');
 addLobbyWoodwork(group);
 for(const x of [-3.4,3.4]){const fixture=createSconce();fixture.position.set(x,2.34,-8.75);group.add(fixture);const light=new T.PointLight(0xffc883,1.0,3,2);light.position.set(x,2.25,-8.5);group.add(light);}
 box(2,.35,.25,0x51442f,0,3,-9);const name=text('长 夜 旅 店',2.2,.6,0,3.6,-9.2);name.rotation.y=Math.PI;
 const door=new T.Group();door.position.set(-.9,0,-9);group.add(door);box(1.8,2.8,.12,0x6f5539,.9,1.4,0,door);box(1.3,1.3,.04,0x52706c,.9,1.9,-.08,door);box(.07,.25,.1,0xb9a366,1.6,1.2,-.1,door);lamp(1.2,2.6,-9.8,6);
 box(1.3,1.3,.04,0x52706c,.9,1.9,.08,door);
 for(const side of [-1,1]){for(const x of [.205,1.595])box(.055,1.43,.04,0x382e25,x,1.9,side*.108,door);for(const y of [1.205,2.595])box(1.44,.055,.04,0x382e25,.9,y,side*.108,door);box(1.4,.66,.035,0x493827,.9,.61,side*.075,door);box(1.28,.54,.028,0x6b5138,.9,.61,side*.10,door);}
 const counter=createCounter();counter.position.set(-1,0,-3.5);group.add(counter);
 const sign=text('FRONT DESK',1.2,.2,-1,.85,-3.96);sign.rotation.y=Math.PI;
 box(.56,.035,.4,0xd4c8a8,-.7,1.18,-3.6);const ink=box(.23,.008,.025,0x39443e,-.7,1.205,-3.6);ink.visible=false;
 const recorder=createRecorder();recorder.position.set(-1.7,1.15,-3.67);group.add(recorder);
 const key=new T.Group();key.position.set(-.05,1.2,-3.6);group.add(key);const ring=new T.Mesh(new T.TorusGeometry(.085,.015,5,16),material(0xc2a66d));ring.rotation.x=Math.PI/2;key.add(ring);box(.025,.025,.2,0xc2a66d,0,0,.13,key);box(.07,.025,.025,0xc2a66d,.02,0,.22,key);lamp(-1,2.6,-2.2,5);
 box(1.65,1,.06,0x705337,-2.5,1.9,-8.8);const photo=text('旧走廊 / 配电箱',1.5,.85,-2.5,1.9,-8.75);const c=photo.material.map.image,a=c.getContext('2d');a.fillStyle='#a2a492';a.fillRect(0,0,512,160);a.fillStyle='#4c5b57';a.beginPath();a.moveTo(0,0);a.lineTo(512,0);a.lineTo(290,55);a.lineTo(205,55);a.fill();a.fillStyle='#493b31';a.beginPath();a.moveTo(0,160);a.lineTo(512,160);a.lineTo(290,112);a.lineTo(205,112);a.fill();a.fillStyle='#526a5b';a.fillRect(220,60,40,48);a.fillStyle='#c6b781';a.fillRect(225,65,30,8);photo.material.map.needsUpdate=true;
 // Right-hand opening beside the fuse box is the sole connection to the corridor.
 box(2,3.2,.18,0x465249,-3,1.6,0);box(2,3.2,.18,0x465249,3,1.6,0);
 const arrow=text('客房 / BAR →',1.25,.3,1.35,2.65,-.16);arrow.rotation.y=Math.PI;
 const rain=new Float32Array(240*6);for(let i=0;i<240;i++){const x=(Math.random()-.5)*12,z=-10-Math.random()*10,y=Math.random()*6;rain.set([x,y,z,x-.03,y-.25,z],i*6);}const geom=new T.BufferGeometry();geom.setAttribute('position',new T.BufferAttribute(rain,3));group.add(new T.LineSegments(geom,new T.LineBasicMaterial({color:0x9ab4c2,transparent:true,opacity:.35})));
 let angle=0;return {scene,camera,update(s,yaw,pitch,dt){camera.position.set(s.player.x,1.65,s.player.z);camera.rotation.set(pitch,yaw,0,'YXZ');angle+=((s.door?-1.5:0)-angle)*Math.min(1,dt*5);door.rotation.y=angle;key.visible=!s.key;ink.visible=!!s.signed;for(let i=0;i<rain.length;i+=6){rain[i+1]-=dt*6;rain[i+4]-=dt*6;if(rain[i+1]<0){rain[i+1]=6;rain[i+4]=5.75;}}geom.attributes.position.needsUpdate=true;},open(){door.rotation.y=-1.5;}};
}
