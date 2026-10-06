// Input contract remains ppm / mg per m3; convert once, at presentation.
export const displayUnits=['ppm','ppb','µg/m³','µg/m³','µg/m³','µg/m³'];
export function displayValue(index,value){const v=Number(value);return Number.isFinite(v)?Math.round(v*(index===1||index===2?1000:1)):'—';}
