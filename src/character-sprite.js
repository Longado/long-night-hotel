import * as T from 'three';

const CUTOUT_ALPHA=.4;
const BASE_URL=import.meta.env?.BASE_URL||'/';
const EXPRESSIONS=['neutral','guarded','explaining'];
const CHARACTER_VERSIONS={lin:'v1',zhou:'v1',xu:'v1',tang:'v2',luo:'v1',chen:'v1',gu:'v1'};
const FRAMING={directions:{height:1.82,bottom:0},expressions:{height:1.12,bottom:.70}};
export function hasCharacter(id){return Object.hasOwn(CHARACTER_VERSIONS,id);}
export function characterAssetUrl(id,kind){return hasCharacter(id)&&Object.hasOwn(FRAMING,kind)?`${BASE_URL}assets/characters/${id}/${id}-${kind}-${CHARACTER_VERSIONS[id]}.png`:'';}
function atlasKey(id,kind){return `${id}:${kind}`;}
const atlases=new Map();
const controllers=new WeakMap();
const neutralPortraits=new Map();
const pendingPortrait='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="130" height="164" viewBox="0 0 130 164"><rect width="130" height="164" fill="#929486"/><rect x="8" y="8" width="114" height="148" fill="none" stroke="#b9b7a6"/><text x="65" y="86" text-anchor="middle" fill="#4a5149" font-family="sans-serif" font-size="12">照片载入中</text></svg>');

// The painted profile faces screen-right. World forward is +Z.
export function directionFrame(cameraBearing,facing=0){
 const angle=Math.atan2(Math.sin(cameraBearing-facing),Math.cos(cameraBearing-facing));
 const abs=Math.abs(angle);
 if(abs<Math.PI/4)return {name:'front',index:0,flip:false};
 if(abs>=3*Math.PI/4)return {name:'back',index:2,flip:false};
 return {name:'side',index:1,flip:angle>0};
}
export function expressionFrame(expression){return Math.max(0,EXPRESSIONS.indexOf(expression));}
export function atlasFrame(index,flip=false,crop={left:0,right:1,top:0,bottom:1}){
 const width=(crop.right-crop.left)/3;
 return {offset:[(index+(flip?crop.right:crop.left))/3,1-crop.bottom],repeat:[flip?-width:width,crop.bottom-crop.top]};
}

function imageBounds(image){
 const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
 const data=ctx.getImageData(0,0,image.width,image.height).data,cell=image.width/3;
 const boxes=Array.from({length:3},()=>({left:cell,right:0,top:image.height,bottom:0}));
 for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
  if(data[(y*image.width+x)*4+3]<CUTOUT_ALPHA*255)continue;
  const index=Math.min(2,Math.floor(x/cell)),b=boxes[index],local=x-index*cell;
  b.left=Math.min(b.left,local);b.right=Math.max(b.right,local+1);b.top=Math.min(b.top,y);b.bottom=Math.max(b.bottom,y+1);
 }
 if(boxes.some(b=>b.right<=b.left))throw new Error('Character atlas contains an empty frame');
 // Shared vertical bounds prevent the figure changing height between frames.
 const top=Math.min(...boxes.map(b=>b.top)),bottom=Math.max(...boxes.map(b=>b.bottom));
 return boxes.map(b=>({left:Math.max(.5,b.left-1)/cell,right:Math.min(cell-.5,b.right+1)/cell,top:top/image.height,bottom:bottom/image.height}));
}
function loadAtlas(id,kind){
 const key=atlasKey(id,kind);
 if(atlases.has(key))return atlases.get(key).promise;
 const record={status:'loading',promise:null};atlases.set(key,record);
 record.promise=new Promise(resolve=>{
  const url=characterAssetUrl(id,kind);
  new T.TextureLoader().load(url,texture=>{
   try{
    texture.colorSpace=T.SRGBColorSpace;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearFilter;
    texture.generateMipmaps=false;texture.wrapS=texture.wrapT=T.ClampToEdgeWrapping;
    Object.assign(record,{status:'ready',texture,bounds:imageBounds(texture.image)});resolve(record);
   }catch{texture.dispose();record.status='failed';resolve(null);}
  },undefined,()=>{record.status='failed';resolve(null);});
 });
 return record.promise;
}
export async function preloadCharacters(ids=Object.keys(CHARACTER_VERSIONS)){if(typeof ids==='string')ids=[ids];await Promise.all(ids.filter(hasCharacter).flatMap(id=>Object.keys(FRAMING).map(kind=>loadAtlas(id,kind))));return characterAssetStates();}
export function characterAssetState(id='tang'){return Object.fromEntries(Object.keys(FRAMING).map(kind=>[kind,atlases.get(atlasKey(id,kind))?.status||'idle']));}
export function characterAssetStates(){return Object.fromEntries(Object.keys(CHARACTER_VERSIONS).map(id=>[id,characterAssetState(id)]));}

function contactShadow(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
 const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,2,32,32,31);
 gradient.addColorStop(0,'rgba(0,0,0,.45)');gradient.addColorStop(.5,'rgba(0,0,0,.20)');gradient.addColorStop(1,'rgba(0,0,0,0)');
 ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
 const mesh=new T.Mesh(new T.PlaneGeometry(.75,.40),new T.MeshBasicMaterial({map:new T.CanvasTexture(canvas),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
 mesh.rotation.x=-Math.PI/2;mesh.position.y=.012;mesh.name='character-contact-shadow';return mesh;
}

export function createCharacter(fallback,{id='tang',kind='directions'}={}){
 const group=new T.Group();group.name='guest-'+id;group.userData.characterId=id;
 fallback.name='character-fallback';fallback.scale.setScalar(1.82/2);fallback.visible=false;
 const shadow=contactShadow();shadow.visible=false;group.add(fallback,shadow);
 const material=new T.MeshStandardMaterial({roughness:1,metalness:0,alphaTest:CUTOUT_ALPHA,side:T.DoubleSide,depthWrite:true,transparent:false});
 const mesh=new T.Mesh(new T.PlaneGeometry(1,1),material);mesh.name=id+'-lit-cutout';mesh.visible=false;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
 const config=FRAMING[kind];mesh.position.y=config.bottom+config.height/2;
 let disposed=false,atlas=null,texture=null,expression='neutral',selected={name:kind==='expressions'?'neutral':'front',index:0,flip:false};
 const worldPosition=new T.Vector3(),worldRotation=new T.Quaternion(),worldNormal=new T.Vector3(),worldUp=new T.Vector3();
 function applyFrame(){
  if(!atlas)return;
  const crop=atlas.bounds[selected.index],uv=atlasFrame(selected.index,selected.flip,crop);
  texture.offset.set(...uv.offset);texture.repeat.set(...uv.repeat);
  const image=texture.image,ratio=(crop.right-crop.left)*image.width/3/((crop.bottom-crop.top)*image.height);
  mesh.scale.set(config.height*ratio,config.height,1);
 }
 const controller={
  setExpression(value){expression=EXPRESSIONS[expressionFrame(value)];if(kind==='expressions'){selected={name:expression,index:expressionFrame(expression),flip:false};applyFrame();}},
  update(camera){
   if(disposed)return;
   group.getWorldPosition(worldPosition);
   const bearing=Math.atan2(camera.position.x-worldPosition.x,camera.position.z-worldPosition.z);
   // Rotate only around Y: the feet stay on the floor when the player looks up/down.
   mesh.rotation.set(0,bearing-group.rotation.y,0);
   if(kind==='directions'){
    const next=directionFrame(bearing,group.rotation.y);
    if(next.index!==selected.index||next.flip!==selected.flip){selected=next;applyFrame();}
   }
  },
  snapshot(){
   mesh.getWorldQuaternion(worldRotation);
   return {id,kind:mesh.visible?'sprite':fallback.visible?'fallback':'loading',atlas:kind,frame:selected.name,expression,visible:group.visible,facing:group.rotation.y,floorY:group.position.y,height:1.82,alphaTest:material.alphaTest,depthWrite:material.depthWrite,billboard:'vertical',planeRotation:mesh.rotation.toArray().slice(0,3),contactRotation:shadow.rotation.toArray().slice(0,3),planeWorldNormal:worldNormal.set(0,0,1).applyQuaternion(worldRotation).normalize().toArray(),planeWorldUp:worldUp.set(0,1,0).applyQuaternion(worldRotation).normalize().toArray()};
  },
  dispose(){disposed=true;},
 };
 controllers.set(group,controller);
 function attachAtlas(result){
  if(disposed)return;
  if(!result){fallback.visible=true;shadow.visible=true;return;}
  atlas=result;texture=result.texture.clone();texture.needsUpdate=true;material.map=texture;material.needsUpdate=true;
  // Shadow maps use the same cutout rather than a rectangular plane.
  mesh.customDepthMaterial=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,map:texture,alphaTest:CUTOUT_ALPHA,side:T.DoubleSide});
  mesh.customDistanceMaterial=new T.MeshDistanceMaterial({map:texture,alphaTest:CUTOUT_ALPHA,side:T.DoubleSide});
  applyFrame();mesh.visible=true;fallback.visible=false;shadow.visible=true;
 }
 const cached=atlases.get(atlasKey(id,kind));
 // Promise callbacks wait until the next microtask even for an already-ready atlas.
 // Install ready textures before the caller can render this newly created scene.
 if(cached?.status==='ready')attachAtlas(cached);
 else if(cached?.status==='failed')attachAtlas(null);
 else loadAtlas(id,kind).then(attachAtlas);
 return group;
}
export function characterController(group){return controllers.get(group);}

export function characterPortrait(id){
 if(!hasCharacter(id))return '';
 if(neutralPortraits.has(id))return neutralPortraits.get(id);
 const atlas=atlases.get(atlasKey(id,'expressions'));
 if(atlas?.status==='failed')return '';
 if(atlas?.status!=='ready'){loadAtlas(id,'expressions');return pendingPortrait;}
 const image=atlas.texture.image,b=atlas.bounds[0],cell=image.width/3;
 // Neutral first frame only: ID paper never inherits the conversation expression.
 const height=(b.bottom-b.top)*image.height*.67,width=height*65/82;
 const center=(b.left+b.right)*cell/2;
 const canvas=document.createElement('canvas');canvas.width=130;canvas.height=164;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#929486';ctx.fillRect(0,0,130,164);
 ctx.drawImage(image,center-width/2,b.top*image.height,width,height,0,5,130,159);
 const portrait=canvas.toDataURL('image/png');neutralPortraits.set(id,portrait);return portrait;
}
