import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Built from the 2026-09-20 concept sheets; dimensions stay in game metres.
// Materials belong to their scene, so world.js can dispose them normally.
function palette(){
 const basic=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.88,...extra});
 const wood=basic(0x866447),paper=basic(0xc8b794),brass=basic(0xa38a54,{metalness:.18,roughness:.7});
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
 const a=canvas.getContext('2d');a.fillStyle='#89664a';a.fillRect(0,0,128,128);
 let seed=29;const rand=()=>((seed=seed*16807%2147483647)/2147483647);
 for(let i=0;i<95;i++){const x=rand()*128;a.strokeStyle=i%3?'#77583f':'#977659';a.globalAlpha=.32;a.lineWidth=.4+rand();a.beginPath();a.moveTo(x,0);a.bezierCurveTo(x+rand()*9,40,x-rand()*8,85,x,128);a.stroke();}
 a.globalAlpha=1;const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.magFilter=T.LinearFilter;wood.map=texture;wood.color.setHex(0xffffff);
 return {wood,paper,brass,dark:basic(0x322b24),olive:basic(0x4e5548),black:basic(0x1c201d),cream:basic(0xcbbd94)};
}
function mesh(parent,geometry,material,x=0,y=0,z=0){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function block(p,m,w,h,d,x,y,z,r=.007){return mesh(p,new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/4,h/4,d/4)),m,x,y,z);}
function disc(p,m,r,h,x,y,z){const o=mesh(p,new T.CylinderGeometry(r,r,h,20),m,x,y,z);o.rotation.x=Math.PI/2;return o;}
function tube(p,m,points,r){return mesh(p,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v))),12,r,6,false),m);}

export function createCounter(){
 const g=new T.Group();g.name='concept-reception-counter';const m=palette();
 block(g,m.wood,2.5,1.02,.70,0,.53,0,.025);
 block(g,m.dark,2.59,.095,.76,0,.065,0,.017);
 block(g,m.wood,2.64,.055,.80,0,.12,0,.012);
 // Top remains y=1.15, exactly matching existing belongings and collision.
 block(g,m.wood,2.70,.10,.85,0,1.10,0,.03);
 block(g,m.brass,2.60,.012,.79,0,1.038,0,.005);
 for(const x of [-.82,0,.82]){
  block(g,m.dark,.74,.73,.027,x,.57,.357,.009);
  block(g,m.wood,.65,.64,.022,x,.57,.377,.011);
  for(const dx of [-.345,.345])block(g,m.wood,.025,.72,.035,x+dx,.57,.382,.005);
  for(const y of [.225,.915])block(g,m.wood,.72,.028,.035,x,y,.382,.005);
 }
 for(const side of [-1,1]){
  block(g,m.dark,.018,.73,.55,side*1.255,.57,0,.004);
  block(g,m.wood,.022,.64,.47,side*1.269,.57,0,.005);
 }
 // Manager-side drawers leave the original footprint unchanged.
 for(const x of [-.82,.82])for(const y of [.37,.72]){
  block(g,m.dark,.72,.3,.018,x,y,-.359,.004);block(g,m.wood,.68,.265,.024,x,y,-.373,.008);
  tube(g,m.brass,[[x-.075,y,-.391],[x-.06,y,-.419],[x+.06,y,-.419],[x+.075,y,-.391]],.008);
 }
 return g;
}

export function createRecorder(){
 const g=new T.Group();g.name='concept-reel-recorder';const m=palette();
 block(g,m.olive,.40,.268,.15,0,.149,0,.022);
 for(const x of [-.207,.207])block(g,m.wood,.025,.273,.157,x,.149,0,.012);
 for(const x of [-.15,.15])block(g,m.black,.047,.018,.10,x,.009,0,.006);
 block(g,m.olive,.368,.23,.008,0,.149,.078,.01);
 for(const x of [-.1,.1]){
  disc(g,m.black,.076,.007,x,.208,.087);
  disc(g,m.brass,.072,.005,x,.208,.092);
  // Three rounded openings in each reel read clearly from the game camera.
  for(let i=0;i<3;i++){const angle=i*Math.PI*2/3;const o=disc(g,m.black,.020,.002,x+Math.sin(angle)*.04,.208+Math.cos(angle)*.04,.096);o.scale.y=1.3;}
  disc(g,m.olive,.012,.006,x,.208,.10);disc(g,m.brass,.006,.009,x,.208,.104);
 }
 tube(g,m.black,[[-.15,.16,.098],[-.123,.12,.098],[0,.103,.098],[.123,.12,.098],[.15,.16,.098]],.0018);
 for(const x of [-.123,.123]){disc(g,m.brass,.009,.006,x,.121,.10);disc(g,m.black,.003,.008,x,.121,.104);}
 block(g,m.olive,.103,.030,.013,0,.113,.095,.005);
 disc(g,m.brass,.042,.005,-.124,.06,.086);
 disc(g,m.black,.036,.004,-.124,.06,.090);
 const c=document.createElement('canvas');c.width=c.height=128;const a=c.getContext('2d');a.fillStyle='#696759';a.fillRect(0,0,128,128);
 a.fillStyle='#252c26';for(let y=7;y<128;y+=13)for(let x=7;x<128;x+=13){a.beginPath();a.arc(x+(y%2)*5,y,3.6,0,7);a.fill();}
 const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
 mesh(g,new T.CircleGeometry(.034,24),new T.MeshStandardMaterial({map:tex,roughness:.95}),-.124,.06,.093);
 block(g,m.black,.136,.052,.008,.086,.051,.087,.005);
 for(let i=0;i<4;i++)block(g,m.cream,.027,.039,.014,.038+i*.032,.052,.098,.004);
 disc(g,m.brass,.019,.016,-.036,.048,.096);block(g,m.cream,.003,.012,.002,-.036,.055,.106,.001);
 for(const x of [-.18,.18])for(const y of [.034,.26]){disc(g,m.brass,.003,.002,x,y,.085);}
 for(let i=0;i<8;i++)block(g,m.black,.008,.048,.003,-.058+i*.016,.21,-.077,.002);
 block(g,m.black,.042,.021,.004,.125,.045,-.078,.003);
 block(g,m.black,.003,.021,.067,.221,.235,0,.001);
 return g;
}

export function createSconce(){
 const g=new T.Group();g.name='concept-wall-sconce';const m=palette();
 const plate=mesh(g,new T.SphereGeometry(1,16,10),m.brass,0,.085,0);plate.scale.set(.069,.145,.014);
 const inset=mesh(g,new T.SphereGeometry(1,16,10),m.dark,0,.085,.011);inset.scale.set(.057,.129,.006);
 const face=mesh(g,new T.SphereGeometry(1,16,10),m.brass,0,.085,.017);face.scale.set(.052,.123,.005);
 for(const y of [-.01,.18])disc(g,m.dark,.004,.004,0,y,.025);
 tube(g,m.brass,[[0,.15,.025],[0,.15,.10],[0,.13,.18],[0,.058,.205]],.012);
 mesh(g,new T.CylinderGeometry(.029,.032,.027,16),m.brass,0,.045,.205);
 const glass=new T.MeshStandardMaterial({color:0xd4c6a1,roughness:.92,side:T.DoubleSide,emissive:0xffbe69,emissiveIntensity:.18});glass.userData.environmentGlow=.18;
 const profile=[[.028,.031],[.040,.019],[.057,-.005],[.085,-.05],[.118,-.084]].map(v=>new T.Vector2(...v));
 const shade=mesh(g,new T.LatheGeometry(profile,20),glass,0,0,.205);shade.castShadow=false;
 const rim=mesh(g,new T.TorusGeometry(.118,.006,6,24),m.brass,0,-.084,.205);rim.rotation.x=Math.PI/2;
 const diffuser=mesh(g,new T.CircleGeometry(.11,24),glass,0,-.08,.205);diffuser.rotation.x=Math.PI/2;diffuser.castShadow=false;
 return g;
}

export function addLobbyWoodwork(parent){
 const m=palette();const g=new T.Group();g.name='concept-lobby-woodwork';parent.add(g);
 for(const side of [-1,1]){
  block(g,m.dark,.10,1.0,8.7,side*3.86,.55,-4.5,.004);
  for(const y of [.1,1.06,2.98])block(g,m.wood,.15,.075,8.7,side*3.83,y,-4.5,.009);
  for(let z=-8.5;z<-.3;z+=.8)block(g,m.wood,.15,.92,.035,side*3.83,.57,z,.004);
 }
 for(const side of [-1,1]){
  block(g,m.dark,2.95,1.0,.06,side*2.47,.55,-8.85,.004);
  for(const y of [.1,1.06,2.98])block(g,m.wood,2.95,.075,.11,side*2.47,y,-8.81,.009);
  for(let x=1.08;x<3.9;x+=.7)block(g,m.wood,.035,.92,.105,side*x,.57,-8.81,.004);
 }
 for(const x of [-.95,.95])block(g,m.wood,.14,2.85,.16,x,1.425,-8.85,.013);
 block(g,m.wood,2.15,.14,.16,0,2.86,-8.85,.015);
 return g;
}

export function createPendant(length=.45){
 const g=new T.Group();g.name='concept-pendant';const m=palette();
 mesh(g,new T.CylinderGeometry(.008,.008,length,8),m.dark,0,length/2+.07,0);
 mesh(g,new T.CylinderGeometry(.045,.045,.025,16),m.brass,0,.067,0);
 const glass=new T.MeshStandardMaterial({color:0xd4c6a1,roughness:.9,side:T.DoubleSide,emissive:0xffbe69,emissiveIntensity:.18});glass.userData.environmentGlow=.18;
 const profile=[[.04,.05],[.075,.02],[.15,-.08],[.19,-.11]].map(v=>new T.Vector2(...v));
 mesh(g,new T.LatheGeometry(profile,20),glass);
 const rim=mesh(g,new T.TorusGeometry(.19,.007,6,24),m.brass,0,-.11,0);rim.rotation.x=Math.PI/2;
 const shade=mesh(g,new T.CircleGeometry(.18,24),glass,0,-.104,0);shade.rotation.x=Math.PI/2;shade.castShadow=false;
 return g;
}
