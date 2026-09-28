import test from 'node:test';import assert from 'node:assert/strict';
import * as I from '../src/investigation.js';
const A=await import('../src/night-actions.js').catch(()=>({}));
const make=()=>({layoutVersion:1,day:2,stage:'ready',player:{x:0,z:22},clues:[{id:'luo0'},{id:'tang1'},{id:'gu0'}],rooms:[{id:'luo',name:'罗诚',number:'101',role:'killer',alive:true,side:0,z:3},{id:'chen',name:'陈默',number:'106',role:'sheriff',alive:true,side:1,z:15},{id:'tang',name:'唐宁',number:'105',role:'civilian',alive:true,side:0,z:15},{id:'gu',name:'顾远',number:'103',role:'civilian',alive:true,side:0,z:9}],events:[]});
test('officer can walk from any room; assignment is not immediate remote guarding',()=>{
 assert.equal(typeof A.tickPeople,'function');const s=make();assert.equal(I.assignGuard(s,'luo',['luo0','gu0']),true);assert.equal(s.guard,null);
 A.tickPeople(s,1);assert.equal(s.guard,null);assert.ok(s.actors.chen.z<15&&s.actors.chen.z>3);
 for(let i=0;i<15;i++)A.tickPeople(s,1);assert.equal(s.guard,'luo');assert.equal(s.actors.chen.z,3);
 assert.equal(A.beginPeopleRound(s),false);assert.equal(s.stage,'finalReady');
});
test('killer travels from own door before a conflict; manager can prevent attack onsite',()=>{
 assert.equal(typeof A.beginPeopleRound,'function');const s=make();assert.equal(A.beginPeopleRound(s),true);
 assert.equal(s.stage,'approach');assert.equal(s.actors.luo.z,3);A.tickPeople(s,1);assert.ok(s.actors.luo.z>3&&s.actors.luo.z<15);
 assert.equal(A.intervene(s),false);s.player={x:s.actors.luo.x,z:s.actors.luo.z};assert.equal(A.intervene(s),true);assert.equal(s.stage,'finalReady');assert.ok(s.rooms.every(r=>r.alive));
});
test('room placement changes travel time; pause and serialization preserve movement',()=>{
 assert.equal(typeof A.beginPeopleRound,'function');const near=make(),far=make();near.rooms.find(r=>r.id==='tang').z=9;
 A.beginPeopleRound(near);A.beginPeopleRound(far);A.tickPeople(near,5);A.tickPeople(far,5);
 assert.equal(near.stage,'attack');assert.equal(far.stage,'approach');const saved=JSON.parse(JSON.stringify(far));saved.paused=true;A.tickPeople(saved,40);assert.equal(saved.actors.luo.z,far.actors.luo.z);
});
test('absent killer has no attack; absent officer has no guard; interrupted duties do not protect remotely',()=>{
 assert.equal(typeof A.beginPeopleRound,'function');const s=make();s.rooms=s.rooms.filter(r=>r.id!=='luo');assert.equal(A.beginPeopleRound(s),false);
 const b=make();b.rooms=b.rooms.filter(r=>r.id!=='chen');assert.equal(I.assignGuard(b,'luo',['luo0','gu0']),false);
 const c=make();I.assignGuard(c,'luo',['luo0','gu0']);A.tickPeople(c,20);c.rooms.find(r=>r.id==='chen').alive=false;A.tickPeople(c,1);assert.equal(c.guard,null);
});
test('interception keeps officer at the actual intercept site through subsequent ticks',()=>{const s=make();I.assignGuard(s,'luo',['luo0','gu0']);A.beginPeopleRound(s);for(let i=0;i<20&&s.stage!=='finalReady';i++)A.tickPeople(s,.5);assert.equal(s.stage,'finalReady');const where=s.actors.chen.z;A.tickPeople(s,2);assert.equal(s.actors.chen.z,where);});
test('a guest outside cannot answer from their registered room, including after interception',()=>{assert.equal(typeof A.atRoom,'function');const s=make();assert.equal(A.atRoom(s,'luo'),true);A.beginPeopleRound(s);assert.equal(A.atRoom(s,'luo'),false);s.player={x:s.actors.luo.x,z:s.actors.luo.z};A.intervene(s);assert.equal(A.atRoom(s,'luo'),false);assert.equal(A.atRoom(s,'tang'),true);});
test('opposite doors still require crossing the corridor before guarding',()=>{const s=make();s.rooms.find(r=>r.id==='chen').z=3;I.assignGuard(s,'luo',['luo0','gu0']);A.tickPeople(s,.1);assert.equal(s.guard,null);assert.ok(s.actors.chen.x>-.9);A.tickPeople(s,2);assert.equal(s.guard,'luo');});
