import test from 'node:test';
import assert from 'node:assert/strict';
import {presentationState} from '../brand-cover.mjs';
test('cover follows playback lifecycle without reappearing during pause',()=>{
 assert.equal(presentationState({time:0,playing:false,duration:138}),'standby');
 assert.equal(presentationState({time:0,playing:true,duration:138}),'playing');
 assert.equal(presentationState({time:20,playing:false,duration:138}),'playing');
 assert.equal(presentationState({time:138,playing:false,duration:138}),'complete');
 assert.equal(presentationState({time:0,playing:false,duration:138}),'standby');
});
