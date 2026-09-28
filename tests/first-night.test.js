import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as rules from '../src/rules.js';
test('first night targets Lin by identity, not room order',()=>{
 assert.equal(typeof rules.firstNightTarget,'function');
 assert.equal(rules.firstNightTarget([{id:'xu',alive:true},{id:'lin',alive:true}]).id,'lin');
});
test('refusing Lin or losing a guest still leaves a valid target',()=>{
 assert.equal(typeof rules.firstNightTarget,'function');
 assert.equal(rules.firstNightTarget([{id:'lin',alive:false},{id:'zhou',alive:true}]).id,'zhou');
 assert.equal(rules.firstNightTarget([]),null);
});
test('first outage affects only designated room and never restarts its countdown',()=>{
 assert.equal(typeof rules.triggerFirstOutage,'function');
 const s={day:1,stage:'tour',firstTargetId:'lin',rooms:[{id:'xu',alive:true,on:true},{id:'lin',alive:true,on:true,dark:0}]};
 assert.equal(rules.triggerFirstOutage(s).id,'lin');
 assert.equal(s.rooms[0].on,true);assert.equal(s.rooms[1].on,false);assert.equal(s.stage,'blackout');
 s.rooms[1].dark=30;assert.equal(rules.triggerFirstOutage(s),null);assert.equal(s.rooms[1].dark,30);
});
test('second night is not rewritten by first-night tutorial',()=>{
 assert.equal(typeof rules.triggerFirstOutage,'function');
 const s={day:2,stage:'tour',rooms:[{id:'lin',alive:true,on:true}]};
 assert.equal(rules.triggerFirstOutage(s),null);assert.equal(s.stage,'tour');
});
