import test from 'node:test';
import assert from 'node:assert/strict';
import {guardReach,doorPosition,remember,review} from '../src/demo.js';
import {assignGuard} from '../src/investigation.js';
test('guarding depends on actual door distance including mirrored rooms',()=>{const rooms=[{guestId:'chen',col:0,shape:'S'},{guestId:'luo',col:2,shape:'L'}];assert.equal(guardReach(rooms,'luo'),true);rooms[1].mirror=true;assert.equal(doorPosition(rooms[1]),10.5);assert.equal(guardReach(rooms,'luo'),false)});
test('valid evidence cannot deploy an officer outside walking range',()=>{const s={day:2,stage:'ready',clues:[{id:'luo0'},{id:'tang1'},{id:'gu0'}],rooms:[{id:'chen',role:'sheriff',alive:true,z:1.5},{id:'luo',role:'killer',alive:true,z:13.5}]};assert.equal(assignGuard(s,'luo',['luo0','gu0']),false);s.rooms[0].z=7.5;assert.equal(assignGuard(s,'luo',['luo0','gu0']),true)});
test('morning register only repeats witnessed facts and deduplicates saves',()=>{const s={rooms:[{id:'secret',role:'killer'}]};assert.deepEqual(review(s),[]);remember(s,'lamp','你替唐宁安装了一盏灯。');remember(s,'lamp','duplicate');assert.deepEqual(review(JSON.parse(JSON.stringify(s))),['你替唐宁安装了一盏灯。'])});
