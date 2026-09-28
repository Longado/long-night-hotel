import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as Props from '../src/guest-props.js';

test('all seven guests map to the intended reusable prop models',()=>{
 assert.deepEqual(Props.propLayout('lin').map(p=>p.key),['handbag']);
 assert.deepEqual(Props.propLayout('zhou').map(p=>p.key),['toolbox','wrench']);
 for(const id of ['xu','gu'])assert.deepEqual(Props.propLayout(id).map(p=>p.key),['camera']);
 assert.deepEqual(Props.propLayout('tang').map(p=>p.key),['medicine-case']);
 assert.deepEqual(Props.propLayout('luo').map(p=>p.key),['duffel']);
 assert.deepEqual(Props.propLayout('chen').map(p=>p.key),['briefcase']);
 assert.deepEqual(Props.propLayout('hotel'),[]);
});

test('prop URLs use local GLB files and unknown keys have no resource',()=>{
 assert.equal(Props.propAssetUrl('medicine-case'),'/assets/props/medicine-case-v1.glb');
 assert.equal(Props.propAssetUrl('camera'),'/assets/props/camera-v1.glb');
 assert.equal(Props.propAssetUrl('unknown'),'');
});

test('normalized model placement preserves tabletop scale without shared layout mutation',()=>{
 const camera=Props.propLayout('xu')[0];
 assert.equal(camera.width,.28);assert.deepEqual(camera.position,[0,0,.04]);
 const medicine=Props.propLayout('tang')[0];assert.equal(medicine.width,.51);
 const bag=Props.propLayout('luo')[0];assert.equal(bag.width,.85);
 camera.position[0]=100;
 assert.deepEqual(Props.propLayout('xu')[0].position,[0,0,.04]);
 assert.deepEqual(Props.propLayout('gu')[0].position,[0,0,.04]);
});
