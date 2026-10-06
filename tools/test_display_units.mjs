import test from 'node:test';
import assert from 'node:assert/strict';
import {displayValue,displayUnits} from '../display-units.mjs';
test('source values keep magnitude when displayed in revised units',()=>{assert.equal(displayValue(1,.03),30);assert.equal(displayValue(2,.2),200);assert.equal(displayValue(0,480),480);assert.equal(displayValue(4,200),200);assert.equal(displayValue(1,NaN),'—');assert.equal(displayUnits[1],'ppb');assert.equal(displayUnits[2],'µg/m³');});
