'use strict';
// Polygons are measured against the original 1536 × 1024 photograph.
// The image and all targets share one transformed parent, so zoom/pan never
// introduce a second coordinate system for hit testing.
const targets = [
 {id:'duck',name:'黄色いアヒル',icon:'🐤',polygon:[[271,449],[280,440],[286,438],[284,425],[289,414],[300,409],[311,413],[316,422],[328,424],[327,430],[317,435],[325,446],[330,455],[326,465],[313,470],[284,470],[274,464]]},
 {id:'ball',name:'サッカーボール',icon:'⚽',polygon:[[925,304],[928,288],[939,276],[956,270],[972,272],[986,282],[994,298],[994,314],[984,328],[969,334],[951,333],[936,326],[928,316]]},
 {id:'apple',name:'赤いりんご',icon:'🍎',polygon:[[955,446],[962,435],[974,431],[984,434],[987,423],[991,423],[990,435],[1002,431],[1011,440],[1014,451],[1010,466],[1002,476],[984,480],[969,476],[960,465]]},
 {id:'glass',name:'虫めがね',icon:'🔍',polygon:[[816,795],[827,784],[848,779],[868,781],[888,789],[903,800],[908,814],[922,818],[930,818],[1019,844],[1024,853],[1018,864],[925,837],[917,830],[902,826],[886,835],[859,838],[834,831],[819,819],[812,807]]},
 {id:'cube',name:'ルービックキューブ',icon:'🧩',polygon:[[585,413],[619,406],[652,413],[652,462],[619,469],[585,461]]},
 {id:'clock',name:'赤い目覚まし時計',icon:'⏰',polygon:[[1225,412],[1220,405],[1228,397],[1240,394],[1245,380],[1256,376],[1274,378],[1281,394],[1290,397],[1298,406],[1292,416],[1299,435],[1296,455],[1287,469],[1292,477],[1283,479],[1279,474],[1240,476],[1237,480],[1228,479],[1233,470],[1222,456],[1219,437]]},
 {id:'pine',name:'まつぼっくり',icon:'🌲',polygon:[[422,583],[434,574],[445,578],[451,588],[460,587],[460,599],[467,608],[464,620],[470,627],[464,640],[450,646],[429,646],[416,638],[411,625],[409,613],[416,603],[413,593],[425,594]]},
 {id:'star',name:'星の飾り',icon:'⭐',polygon:[[986,582],[997,607],[1020,610],[1003,624],[1010,644],[988,634],[968,646],[971,622],[954,608],[979,606]]},
 {id:'plane',name:'青い飛行機',icon:'✈️',polygon:[[476,116],[483,114],[477,111],[476,107],[481,108],[490,116],[489,108],[493,105],[538,88],[565,85],[585,90],[583,96],[560,99],[549,115],[576,129],[583,116],[591,118],[589,139],[582,148],[539,148],[536,155],[525,157],[516,151],[516,142],[488,138],[480,130],[475,128]]},
 {id:'dino',name:'緑の恐竜',icon:'🦖',polygon:[[389,327],[409,316],[423,307],[435,286],[453,275],[466,265],[472,247],[485,239],[501,240],[514,247],[510,254],[492,254],[491,263],[486,275],[484,291],[475,304],[479,319],[477,330],[464,331],[465,322],[459,308],[450,307],[446,319],[443,330],[430,331],[432,322],[429,312],[414,325],[400,332],[388,332]]}
];
const $=id=>document.getElementById(id);
let found=new Set(), hints=3, started=null, stopped=null, scale=1, pan={x:0,y:0}, toastTimer, hintTimer, activeHint=null;
const pointers=new Map();let gesture=null, dragged=false;
const format=ms=>{const s=Math.floor(ms/1000);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`};
function elapsed(){return started===null?0:(stopped??performance.now())-started}
function notify(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2300)}
for(const [i,t] of targets.entries()){
 const xs=t.polygon.map(p=>p[0]),ys=t.polygon.map(p=>p[1]);t.x=Math.min(...xs);t.y=Math.min(...ys);t.w=Math.max(...xs)-t.x;t.h=Math.max(...ys)-t.y;
 const button=document.createElement('button');button.className='hotspot';button.dataset.target=t.id;button.setAttribute('aria-label',t.name);button.style.cssText=`left:${t.x/1536*100}%;top:${t.y/1024*100}%;width:${t.w/1536*100}%;height:${t.h/1024*100}%;clip-path:polygon(${t.polygon.map(([x,y])=>`${(x-t.x)/t.w*100}% ${(y-t.y)/t.h*100}%`).join(',')})`;
 // A separate marker avoids clipping the checkmark to the object's silhouette.
 button.addEventListener('click',e=>{if(!dragged)find(t.id);e.stopPropagation()});$('hotspots').append(button);
 const item=document.createElement('div');item.className='item';item.id=`item-${t.id}`;item.innerHTML=`<span class="item-icon" aria-hidden="true">${t.icon}</span><div><span class="item-number">${String(i+1).padStart(2,'0')}</span><span class="item-name">${t.name}</span></div><span class="item-check" aria-hidden="true"></span>`;$('items').append(item);
 const icon=item.querySelector('.item-icon');const crop=Math.max(t.w,t.h)*1.22;const cx=t.x+t.w/2,cy=t.y+t.h/2;icon.textContent='';icon.style.backgroundImage="url('stage1.png?v=2')";icon.style.backgroundSize=`${1536/crop*100}% ${1024/crop*100}%`;icon.style.backgroundPosition=`${(cx-crop/2)/(1536-crop)*100}% ${(cy-crop/2)/(1024-crop)*100}%`;
}
function find(id){if(started===null||found.has(id)||stopped!==null)return;found.add(id);const t=targets.find(t=>t.id===id);const b=document.querySelector(`[data-target="${id}"]`);b.classList.add('found');b.setAttribute('aria-label',`${t.name} 発見済み`);b.disabled=true;
 const marker=document.createElement('span');marker.className='found-marker';marker.style.cssText=`left:${(t.x+t.w/2)/1536*100}%;top:${(t.y+t.h/2)/1024*100}%`;marker.textContent='✓';$('scene').append(marker);
 $(`item-${id}`).classList.add('done');$(`item-${id}`).querySelector('.item-check').textContent='✓';$('foundCount').textContent=found.size;$('progress').style.width=`${found.size*10}%`;if(activeHint===id)clearHint();notify(`${t.name}、見つけた！`);
 if(found.size===10){stopped=performance.now();$('time').textContent=format(elapsed());$('hint').disabled=true;$('resultTime').textContent=format(elapsed());$('resultHints').textContent=`${3-hints} / 3`;$('complete').showModal()}}
function clearHint(){clearTimeout(hintTimer);document.querySelectorAll('.hinted').forEach(b=>b.classList.remove('hinted'));activeHint=null}
function renderTransform(){const v=$('viewport');pan.x=Math.min(0,Math.max(v.clientWidth*(1-scale),pan.x));pan.y=Math.min(0,Math.max(v.clientHeight*(1-scale),pan.y));$('scene').style.transform=`translate(${pan.x}px,${pan.y}px) scale(${scale})`;$('zoomReset').textContent=`${Math.round(scale*100)}%`;$('zoomOut').disabled=scale<=1;$('zoomIn').disabled=scale>=4}
function zoom(next,cx=$('viewport').clientWidth/2,cy=$('viewport').clientHeight/2){next=Math.max(1,Math.min(4,next));pan.x=cx-(cx-pan.x)*next/scale;pan.y=cy-(cy-pan.y)*next/scale;scale=next;renderTransform()}
$('zoomIn').onclick=()=>zoom(scale+.5);$('zoomOut').onclick=()=>zoom(scale-.5);$('zoomReset').onclick=()=>{scale=1;pan={x:0,y:0};renderTransform()};
$('hint').onclick=()=>{if(started===null||hints===0||found.size===10)return;clearHint();const t=targets.find(t=>!found.has(t.id));hints--;$('hintsLeft').textContent=hints;$('hint').disabled=hints===0;activeHint=t.id;document.querySelector(`[data-target="${t.id}"]`).classList.add('hinted');const v=$('viewport');pan.x=v.clientWidth/2-(t.x+t.w/2)/1536*v.clientWidth*scale;pan.y=v.clientHeight/2-(t.y+t.h/2)/1024*v.clientHeight*scale;renderTransform();notify(`ヒント：${t.name}は光っているところ`);hintTimer=setTimeout(clearHint,6000)};
function restart(){clearHint();found.clear();hints=3;started=performance.now();stopped=null;$('complete').close();$('foundCount').textContent='0';$('time').textContent='00:00';$('progress').style.width='0';$('hintsLeft').textContent='3';$('hint').disabled=false;document.querySelectorAll('.hotspot').forEach(b=>{b.classList.remove('found');b.disabled=false;b.setAttribute('aria-label',targets.find(t=>t.id===b.dataset.target).name)});document.querySelectorAll('.found-marker').forEach(m=>m.remove());document.querySelectorAll('.item').forEach(e=>{e.classList.remove('done');e.querySelector('.item-check').textContent=''});scale=1;pan={x:0,y:0};renderTransform();notify('新しい発見を、もう一度。')}
$('restart').onclick=restart;$('playAgain').onclick=restart;$('closeResult').onclick=()=>$('complete').close();setInterval(()=>{if(stopped===null)$('time').textContent=format(elapsed())},250);
const viewport=$('viewport');
function beginGesture(){const ps=[...pointers.values()];gesture={points:ps.map(p=>({...p})),scale,pan:{...pan}}}
viewport.addEventListener('pointerdown',e=>{if(pointers.size===0)dragged=false;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});beginGesture()});
viewport.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const ps=[...pointers.values()];if(ps.length>=2&&gesture.points.length>=2){const a=gesture.points,b=ps;const d0=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);const d1=Math.hypot(b[0].x-b[1].x,b[0].y-b[1].y);const rect=viewport.getBoundingClientRect();const c0={x:(a[0].x+a[1].x)/2-rect.left,y:(a[0].y+a[1].y)/2-rect.top};const c1={x:(b[0].x+b[1].x)/2-rect.left,y:(b[0].y+b[1].y)/2-rect.top};scale=Math.max(1,Math.min(4,gesture.scale*d1/Math.max(1,d0)));pan.x=c1.x-(c0.x-gesture.pan.x)*scale/gesture.scale;pan.y=c1.y-(c0.y-gesture.pan.y)*scale/gesture.scale;dragged=true;renderTransform()}else if(ps.length===1){const dx=ps[0].x-gesture.points[0].x,dy=ps[0].y-gesture.points[0].y;if(Math.hypot(dx,dy)>6){dragged=true;pan.x=gesture.pan.x+dx;pan.y=gesture.pan.y+dy;renderTransform()}}});
function endPointer(e){const tracked=pointers.has(e.pointerId);const target=e.target.closest?.('.hotspot');if(tracked&&e.type==='pointerup'&&pointers.size===1&&!dragged&&target)find(target.dataset.target);pointers.delete(e.pointerId);if(pointers.size)beginGesture();else gesture=null}
window.addEventListener('pointerup',endPointer);window.addEventListener('pointercancel',endPointer);viewport.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')endPointer(e)});
viewport.addEventListener('click',e=>{if(!dragged&&!e.target.closest('.hotspot'))notify('そこにはないみたい。じっくり探してみよう。')});
viewport.addEventListener('wheel',e=>{e.preventDefault();const r=viewport.getBoundingClientRect();zoom(scale*(e.deltaY>0?.88:1.12),e.clientX-r.left,e.clientY-r.top)},{passive:false});
new ResizeObserver(()=>{scale=1;pan={x:0,y:0};renderTransform()}).observe(viewport);

// Clock starts only on explicit play, not during image loading or instructions.
$('welcome').showModal();
$('welcome').addEventListener('cancel',e=>e.preventDefault());
$('begin').onclick=()=>{$('welcome').close();restart()};
function imageReady(){if($('room').naturalWidth){$('begin').disabled=false;$('begin').textContent='ゲームを開始する ↗'}}
$('room').addEventListener('load',imageReady);
$('room').addEventListener('error',()=>{$('loadStatus').textContent='写真を読み込めませんでした。ページを再読み込みしてください。'});
imageReady();
