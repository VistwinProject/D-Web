export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function validQuad(p){
 if(!Array.isArray(p)||p.length!==4||p.some(q=>!Array.isArray(q)||q.length!==2||q.some(n=>!Number.isFinite(n)||n<0||n>1)))return false;
 return p.every((a,i)=>{const b=p[(i+1)%4],c=p[(i+2)%4];return (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])>0.00002;});
}
// Solve a projective homography, including perspective division, not a CSS skew.
export function homography(points,width=1,height=1){
 const src=[[0,0],[width,0],[width,height],[0,height]],rows=[];
 src.forEach(([x,y],i)=>{const [u,v]=points[i];rows.push([x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v]);});
 for(let k=0;k<8;k++){let pivot=k;for(let j=k+1;j<8;j++)if(Math.abs(rows[j][k])>Math.abs(rows[pivot][k]))pivot=j;
 if(Math.abs(rows[pivot][k])<1e-10)throw Error('四角不可重疊');[rows[k],rows[pivot]]=[rows[pivot],rows[k]];
 const d=rows[k][k];for(let c=k;c<9;c++)rows[k][c]/=d;
 for(let j=0;j<8;j++)if(j!==k){const f=rows[j][k];for(let c=k;c<9;c++)rows[j][c]-=f*rows[k][c];}}
 return rows.map(r=>r[8]);
}
export function cssMatrix(points,w,h){const [a,b,c,d,e,f,g,k]=homography(points,w,h);return `matrix3d(${[a,d,0,g,b,e,0,k,0,0,1,0,c,f,0,1].join(',')})`;}
export function cropRect(sw,sh,aspect,zoom,x,y){let w=sw,h=w/aspect;if(h>sh){h=sh;w=h*aspect;}w/=zoom;h/=zoom;return [(sw-w)*x,(sh-h)*y,w,h];}
export function defaults(){return {version:1,regions:[
 {name:'煙霧 01',points:[[.055,.20],[.365,.20],[.365,.43],[.055,.43]]},
 {name:'煙霧 02',points:[[.405,.20],[.69,.20],[.69,.43],[.405,.43]]},
 {name:'煙霧 03',points:[[.055,.52],[.49,.52],[.49,.82],[.055,.82]]},
 {name:'IH 爐',points:[[.54,.52],[.68,.52],[.68,.84],[.54,.84]]}
 ].map((r,i)=>({...r,content:i===3?'ih':'smoke',enabled:true,aspect:i===3?9/14:16/9,zoom:1,panX:.5,panY:.5,brightness:1,lineWidth:1,resolution:1280,mirror:false,layer:i}))};}
export function validateConfig(value){
 if(value?.version!==1||!Array.isArray(value.regions)||value.regions.length!==4)throw Error('需要 3＋1 區域的設定檔');
 const ranges={aspect:[.25,4],zoom:[1,4],panX:[0,1],panY:[0,1],brightness:[0,1.5],layer:[0,3]};
 const regions=value.regions.map((r,i)=>{if(!r||!validQuad(r.points)||!['smoke','ih'].includes(r.content)||typeof r.enabled!=='boolean'||typeof r.mirror!=='boolean'||![640,1280,1920].includes(r.resolution))throw Error('設定格式或四角位置不正確');
 for(const [k,[a,b]]of Object.entries(ranges))if(!Number.isFinite(r[k])||r[k]<a||r[k]>b)throw Error('設定數值超出範圍');
 const lineWidth=r.lineWidth??1;if(!Number.isFinite(lineWidth)||lineWidth<.5||lineWidth>3)throw Error('線粗超出範圍');
 return {...defaults().regions[i],lineWidth,points:r.points.map(p=>[...p]),content:r.content,enabled:r.enabled,mirror:r.mirror,resolution:r.resolution,...Object.fromEntries(Object.keys(ranges).map(k=>[k,r[k]]))};});
 return {version:1,regions};
}
export function clockState(cue,age,duration){const connected=!!cue&&Number.isFinite(cue.time)&&typeof cue.playing==='boolean'&&age>=0&&age<4;return {connected,time:connected?clamp(cue.time+(cue.playing?age:0),0,duration):0,playing:connected&&cue.playing&&cue.time+age<duration};}
