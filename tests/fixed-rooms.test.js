import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/rules.js';
import {restore} from '../src/checkpoint.js';
test('six permanent rooms keep numbers, opposite doors and types across occupancy',()=>{
 assert.equal(R.FIXED_ROOMS?.length,6);
 assert.deepEqual(R.FIXED_ROOMS.map(r=>r.number),['101','102','103','104','105','106']);
 assert.deepEqual(R.FIXED_ROOMS.map(r=>r.z),[3,3,9,9,15,15]);
 assert.equal(R.FIXED_ROOMS.filter(r=>r.type==='standard').length,3);
 assert.equal(R.FIXED_ROOMS.at(-1).type,'suite');
});
test('key assignment rejects occupied rooms and moves only the selected guest',()=>{
 assert.equal(typeof R.assignRoom,'function');
 const s={guests:[{id:'lin'},{id:'zhou'}],rooms:[]};
 assert.equal(R.assignRoom(s,'lin','105'),true);assert.equal(R.assignRoom(s,'zhou','105'),false);
 assert.equal(R.assignRoom(s,'zhou','101'),true);assert.equal(R.assignRoom(s,'lin','106'),true);
 assert.deepEqual(s.rooms.map(r=>r.number).sort(),['101','106']);
 assert.equal(R.assignRoom(s,'absent','104'),false);
 assert.equal(R.fixedReady(s.guests,s.rooms),true);
 assert.equal(R.fixedReady(s.guests,[s.rooms[0],s.rooms[0]]),false);
});
test('old occupied night restarts allocation without losing money or inventing revived guests',()=>{
 const s=restore({schema:2,state:{phase:'night',day:2,cash:42,batteryMax:240,guests:[{id:'luo'},{id:'tang'}],rooms:[{id:'luo',guestId:'luo',shape:'S',alive:true},{id:'tang',guestId:'tang',shape:'L',alive:false}],clues:[{id:'gu0'}]}});
 assert.equal(s.layoutVersion,1);assert.equal(s.phase,'layout');assert.equal(s.cash,42);assert.equal(s.batteryMax,240);
 assert.deepEqual(s.guests.map(g=>g.id),['luo']);assert.deepEqual(s.rooms,[]);assert.ok(s.migrationNotice);
});
test('painting tracks occupied dark rooms, not identity; emergency light protects them',()=>{
 assert.equal(typeof R.paintingState,'function');
 const s={rooms:[{number:'101',role:'killer',alive:true,on:true},{number:'106',role:'civilian',alive:true,on:false,emergency:0}]};
 assert.deepEqual(R.paintingState(s).doors,['106']);s.rooms[1].emergency=90;assert.deepEqual(R.paintingState(s).doors,[]);
 s.hotelEscaped=true;assert.equal(R.paintingState(s).phase,'trace');
});
test('an occupied booking is not a body in the room: outside guests do not create silhouettes or die in an empty bedroom',()=>{const s={actors:{chen:{visible:true,away:true}},rooms:[{id:'chen',number:'102',alive:true,on:false,dark:74,emergency:0},{id:'tang',number:'105',alive:true,on:false,dark:0,emergency:0}]};R.tickRooms(s,s.rooms,2);assert.equal(s.rooms[0].alive,true);assert.equal(s.rooms[0].dark,0);assert.deepEqual(R.paintingState(s).doors,['105']);});
