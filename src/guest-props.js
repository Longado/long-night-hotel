import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const BASE_URL=import.meta.env?.BASE_URL||'/';
const KEYS=['handbag','toolbox','camera','medicine-case','duffel','briefcase','wrench'];
const LAYOUTS={
 lin:[{key:'handbag',width:.42,position:[0,0,0]}],
 zhou:[{key:'toolbox',width:.48,position:[0,0,0]},{key:'wrench',width:.38,position:[.38,.01,.11]}],
 xu:[{key:'camera',width:.28,position:[0,0,.04]}],
 tang:[{key:'medicine-case',width:.51,position:[0,0,0]}],
 luo:[{key:'duffel',width:.85,position:[0,.015,0]}],
 chen:[{key:'briefcase',width:.48,position:[0,0,0]}],
 gu:[{key:'camera',width:.28,position:[0,0,.04]}],
};
const assets=new Map(),controllers=new WeakMap();
const loader=new GLTFLoader();
export function propLayout(id){return (LAYOUTS[id]||[]).map(item=>({...item,position:[...item.position]}));}
export function propAssetUrl(key){return KEYS.includes(key)?`${BASE_URL}assets/props/${key}-v1.glb`:'';}
export function isSharedPropAsset(object){return object.userData.sharedGuestPropAsset===true;}
export function propAssetState(){return Object.fromEntries(KEYS.map(key=>[key,assets.get(key)?.status||'idle']));}

function loadProp(key){
 if(assets.has(key))return assets.get(key).promise;
 const record={status:'loading',promise:null};assets.set(key,record);
 record.promise=new Promise(resolve=>{
  loader.load(propAssetUrl(key),gltf=>{
   const model=gltf.scene;
   try{
    const bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3());
    if(!Number.isFinite(size.x)||size.x<=0)throw Error('Prop has no usable geometry');
    model.traverse(object=>{
     // The module cache owns these GPU resources for the page lifetime. Every
     // scene clone shares them; removing a clone must never dispose the cache.
     object.userData.sharedGuestPropAsset=true;
     if(object.isMesh){object.castShadow=true;object.receiveShadow=true;}
     const materials=Array.isArray(object.material)?object.material:[object.material];
     for(const material of materials){if(!material)continue;if('roughness' in material)material.roughness=Math.max(.82,material.roughness);if('metalness' in material)material.metalness=0;}
    });
    Object.assign(record,{status:'ready',model,bounds,size});resolve(record);
   }catch{
    const geometries=new Set(),materials=new Set(),textures=new Set();
    model.traverse(object=>{if(object.geometry)geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material])if(material){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
    for(const resource of [...geometries,...materials,...textures])resource.dispose();
    record.status='failed';resolve(null);
   }
  },undefined,()=>{record.status='failed';resolve(null);});
 });
 return record.promise;
}
export async function preloadProps(keys=KEYS){if(typeof keys==='string')keys=[keys];await Promise.all(keys.filter(key=>KEYS.includes(key)).map(loadProp));return propAssetState();}

export function createProp(spec,fallback,{guestId,tableY=0}={}){
 const group=new T.Group();group.name='prop-'+spec.key;group.position.fromArray(spec.position);group.rotation.y=spec.yaw||0;
 fallback.name='prop-fallback';fallback.visible=false;group.add(fallback);
 let disposed=false,model=null,status='loading';
 const bounds=new T.Box3();
 const controller={
  snapshot(){
   const active=status==='ready'?model:status==='failed'?fallback:null;
   let measured=null;
   if(active){group.updateWorldMatrix(true,true);bounds.setFromObject(active);measured={min:bounds.min.toArray(),max:bounds.max.toArray(),size:bounds.getSize(new T.Vector3()).toArray()};}
   return {id:`${guestId}:${spec.key}`,guestId,key:spec.key,source:propAssetUrl(spec.key),status,kind:status==='ready'?'model':status==='failed'?'fallback':'loading',visible:!!active&&group.visible&&active.visible,fallback:fallback.visible,tableY,bounds:measured};
  },
  dispose(){disposed=true;},
 };
 controllers.set(group,controller);
 function attach(record){
  if(disposed)return;
  if(!record){status='failed';fallback.visible=true;return;}
  model=new T.Group();model.name='prop-model';model.add(record.model.clone(true));
  const scale=spec.width/record.size.x,center=record.bounds.getCenter(new T.Vector3());
  model.scale.setScalar(scale);model.position.set(-center.x*scale,-record.bounds.min.y*scale,-center.z*scale);
  group.add(model);status='ready';fallback.visible=false;
 }
 const cached=assets.get(spec.key);
 if(cached?.status==='ready')attach(cached);
 else if(cached?.status==='failed')attach(null);
 else loadProp(spec.key).then(attach);
 return group;
}
export function propController(group){return controllers.get(group);}
