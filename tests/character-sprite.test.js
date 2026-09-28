import {test} from 'node:test';
import assert from 'node:assert/strict';
import {directionFrame, atlasFrame, expressionFrame} from '../src/character-sprite.js';

test('direction selection uses actor yaw and camera bearing with exact diagonal boundaries',()=>{
 assert.deepEqual(directionFrame(0,0),{name:'front',index:0,flip:false});
 assert.equal(directionFrame(Math.PI/4-.0001,0).name,'front');
 assert.equal(directionFrame(Math.PI/4,0).name,'side');
 assert.equal(directionFrame(3*Math.PI/4-.0001,0).name,'side');
 assert.equal(directionFrame(3*Math.PI/4,0).name,'back');
 assert.equal(directionFrame(Math.PI,0).name,'back');
 assert.equal(directionFrame(Math.PI/2,Math.PI/2).name,'front');
 assert.equal(directionFrame(2*Math.PI+.1,0).name,'front');
});

test('screen-right source profile mirrors only when seen from actor positive X',()=>{
 assert.deepEqual(directionFrame(Math.PI/2,0),{name:'side',index:1,flip:true});
 assert.deepEqual(directionFrame(-Math.PI/2,0),{name:'side',index:1,flip:false});
 assert.equal(directionFrame(-2*Math.PI-Math.PI/2,0).flip,false);
 assert.equal(directionFrame(-Math.PI,0).name,'back');
});

test('atlas frame stays inside its equal-width cell and mirrors without bleeding into neighbors',()=>{
 const normal=atlasFrame(1,false);const mirror=atlasFrame(1,true);
 assert.deepEqual(normal,{offset:[1/3,0],repeat:[1/3,1]});
 assert.deepEqual(mirror,{offset:[2/3,0],repeat:[-1/3,1]});
 const crop=atlasFrame(2,false,{left:.2,right:.8,top:.1,bottom:.9});
 assert.ok(Math.abs(crop.offset[0]-(2.2/3))<1e-12);
 assert.ok(Math.abs(crop.repeat[0]-.2)<1e-12);
 assert.ok(Math.abs(crop.offset[1]-.1)<1e-12);
 assert.ok(Math.abs(crop.repeat[1]-.8)<1e-12);
});

test('expressions choose exactly their cells and unknown expressions reset to neutral',()=>{
 assert.equal(expressionFrame('neutral'),0);
 assert.equal(expressionFrame('guarded'),1);
 assert.equal(expressionFrame('explaining'),2);
 assert.equal(expressionFrame('angry'),0);
});

test('every authored guest gets an isolated atlas URL and Tang retains v2',async()=>{
 const Characters=await import('../src/character-sprite.js');
 const {PEOPLE}=await import('../src/content.js');
 assert.equal(typeof Characters.characterAssetUrl,'function');
 const paths=[];
 for(const guest of PEOPLE.flat()){
  assert.equal(Characters.hasCharacter(guest.id),true,guest.id);
  for(const kind of ['directions','expressions']){
   const path=Characters.characterAssetUrl(guest.id,kind);
   assert.equal(path,`/assets/characters/${guest.id}/${guest.id}-${kind}-${guest.id==='tang'?'v2':'v1'}.png`);
   paths.push(path);
  }
 }
 assert.equal(new Set(paths).size,14);
 assert.equal(Characters.hasCharacter('hotel'),false);
 assert.equal(Characters.characterAssetUrl('hotel','directions'),'');
 assert.equal(Characters.characterAssetUrl('tang','unknown'),'');
});
