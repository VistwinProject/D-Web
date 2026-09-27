import test from 'node:test';
import assert from 'node:assert/strict';
import {kitchenLayout as k} from '../kitchen-layout.mjs';
import {readFileSync} from 'node:fs';
test('IH fits the source worktop and stays clear of the source sink',()=>{
 const [x,y,z]=k.stove;
 // Source Group283 worktop and Mesh164 sink dimensions in the exported coordinate frame.
 assert.ok(x-.295>=-.589 && x+.295<=1.561);
 assert.ok(z-.23>=-.792 && z+.23<=-.192);
 assert.ok(x-.295>-.055);assert.ok(y>.898 && y<.96);
 assert.equal(k.hood[0],x);assert.ok(Math.abs(k.hood[2]-z)<.05);
 assert.ok(k.hood[1]>y+.5 && k.hood[1]<1.568);
 assert.deepEqual(k.viewDirection,[-1,1,-1]);
});
test('export contains the actual sink and cabinet nodes, without former dining chairs',()=>{
 const bytes=readFileSync(new URL('../assets/kitchen.glb',import.meta.url));
 assert.equal(bytes.toString('utf8',0,4),'glTF');
 const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
 const names=new Set(json.nodes.map(n=>n.name));
 for(const name of ['Group282','Group283','Group284','Mesh164','Mesh168'])assert.ok(names.has(name),name);
 for(const name of ['Group776','Group772','Group988','Plane04_01','Plane04_02','Plane04_03'])assert.ok(!names.has(name),name);
});
