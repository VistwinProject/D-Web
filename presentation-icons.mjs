const paths={
 narrator:'<circle cx="32" cy="32" r="25"/><path d="M17 29v6m7-15v24m8-30v36m8-30v24m7-15v6"/>',
 mother:'<path d="M18 34V23a14 14 0 0 1 28 0v11l5 8H13z"/><path d="M23 23c8 1 13-3 15-7 1 5 3 8 5 10v6a11 11 0 0 1-22 0v-7m-7 31c1-12 9-16 18-16s17 4 18 16"/><path d="M27 29h1m9 0h1m-9 7q3 3 6 0"/>',
 child:'<path d="M18 23a14 14 0 0 1 28 0M16 23h34M20 25v8a12 12 0 0 0 24 0v-8M15 56c1-10 8-15 17-15s16 5 17 15M26 30h1m10 0h1m-10 7q4 3 8 0M27 12v9"/>',
 steward:'<rect x="12" y="18" width="40" height="34" rx="11"/><path d="M32 10v8M7 30v12m50-12v12M23 43h18"/><circle cx="32" cy="8" r="2"/><circle cx="24" cy="32" r="3"/><circle cx="40" cy="32" r="3"/>',
 heat:'<rect x="9" y="26" width="46" height="29" rx="6"/><ellipse cx="32" cy="39" rx="14" ry="8"/><ellipse cx="32" cy="39" rx="7" ry="4"/><path class="heat-wave" d="M22 21c-6-6 5-8 0-14m10 14c-6-6 5-8 0-14m10 14c-6-6 5-8 0-14"/>',
 exhaust:'<rect x="7" y="7" width="50" height="50" rx="10"/><g class="rotor"><path d="M32 29C14 29 16 11 27 13c8 1 7 9 5 16ZM35 33c9-16 24-5 16 3-5 6-12 1-16-3ZM29 35c9 16-8 23-12 13-3-7 5-11 12-13Z"/></g><circle cx="32" cy="32" r="4"/>',
 fresh:'<rect x="8" y="7" width="48" height="19" rx="5"/><path d="M17 15h30m-30 5h30"/><g class="air-stream"><path d="M19 32v22m13-22v22m13-22v22M15 49l4 5 4-5m5 0 4 5 4-5m5 0 4 5 4-5"/></g>'
};
export function icon(name){return `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.narrator}</svg>`;}
export const roles={'旁白':{label:'',icon:'narrator',color:'#9abcf4'},'媽媽':{label:'媽媽',icon:'mother',color:'#e5b593'},'孩子':{label:'小孩',icon:'child',color:'#ebd58a'},'空氣管家':{label:'空氣管家',icon:'steward',color:'#7fd6bd'}};
