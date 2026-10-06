import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
function load(file, imports={}, globals={}) {
  const exports={};
  const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(code,{exports,require:(name)=>imports[name],AbortController,setTimeout,clearTimeout,console,...globals});
  return exports;
}
const orientation=load('lib/orientation.ts');
const pose=(beta,gamma,angle=0)=>({beta,gamma,angle});
test('Holding angle is neutral; small changes follow portrait/landscape screen axes',()=>{
  const {screenTilt}=orientation;
  assert.equal(screenTilt(pose(70,4),pose(70,4)).x,0);
  assert.equal(screenTilt(pose(70,26),pose(70,4)).x,1);
  assert.equal(screenTilt(pose(92,4,90),pose(70,4,90)).x,1);
  assert.equal(screenTilt(pose(92,4,-90),pose(70,4,-90)).x,-1);
});
test('Angle wrapping, sensor jitter and extreme readings cannot jerk the logo',()=>{
  const {screenTilt}=orientation;
  assert.ok(Math.abs(screenTilt(pose(-179,0),pose(179,0)).y-2/22)<1e-6);
  assert.equal(screenTilt(pose(70.2,.2),pose(70,0)).x,0);
  assert.equal(screenTilt(pose(170,80),pose(70,0)).y,1);
});
function stateHarness(extra={}) {
  const state={section:'top',menuOpen:false,lightbox:null,reduced:false,sceneFailed:false,tilt:'off',tiltAvailable:false,...extra};
  const listeners=new Set();
  const setUI=(patch)=>{Object.assign(state,patch); for(const fn of listeners) fn(state);};
  return {state,setUI,store:{ui:()=>state,setUI,useUI:{subscribe:fn=>(listeners.add(fn),()=>listeners.delete(fn))}}};
}
function tiltHarness(permission=()=>Promise.resolve('granted')) {
  const h=stateHarness(), win=new EventTarget(), doc=new EventTarget(), mobile=new EventTarget();
  let now=100, active=0;
  win.isSecureContext=true; doc.hidden=false; mobile.matches=true;
  const add=win.addEventListener.bind(win);
  win.addEventListener=(type,fn,options)=>{
    if(type==='deviceorientation') {active++;options.signal.addEventListener('abort',()=>active--,{once:true});}
    add(type,fn,options);
  };
  class Sensor extends Event {static requestPermission=permission; constructor(beta,gamma){super('deviceorientation');this.beta=beta;this.gamma=gamma;}}
  const rt={tiltOn:false,tiltX:0,tiltY:0};
  const implementation=load('lib/tilt.ts',{'./orientation':orientation,'./runtime':{rt,markDirty(){}},'./store':h.store,'./ticker':{wake(){}}},
    {window:win,document:doc,matchMedia:()=>mobile,DeviceOrientationEvent:Sensor,screen:{orientation:{angle:0}},performance:{now:()=>now}});
  return {...h,...implementation,rt,doc,active:()=>active,send:(b,g)=>{now+=40;win.dispatchEvent(new Sensor(b,g));}};
}
test('One sensor listener; stops in product section, menu, hidden tab and on disposal',async()=>{
  const h=tiltHarness(), dispose=h.mountTilt();
  assert.equal(h.active(),0); await h.toggleTilt(); assert.equal(h.active(),1);
  h.send(70,0); h.send(70,11); assert.equal(h.rt.tiltX,.5);
  h.setUI({section:'edit'}); assert.equal(h.active(),0); assert.equal(h.rt.tiltOn,false);
  h.setUI({section:'end'}); assert.equal(h.active(),1);
  h.setUI({menuOpen:true}); assert.equal(h.active(),0);
  h.setUI({menuOpen:false}); assert.equal(h.active(),1);
  h.doc.hidden=true;h.doc.dispatchEvent(new Event('visibilitychange'));assert.equal(h.active(),0);
  h.doc.hidden=false;h.doc.dispatchEvent(new Event('visibilitychange'));assert.equal(h.active(),1);
  dispose();assert.equal(h.active(),0);
});
test('Denied or late sensor permission never activates a disabled feature',async()=>{
  let resolve;const h=tiltHarness(()=>new Promise(r=>resolve=r)), dispose=h.mountTilt();
  const pending=h.toggleTilt(); await h.toggleTilt();resolve('granted');await pending;
  assert.equal(h.state.tilt,'off');assert.equal(h.active(),0);dispose();
  const denied=tiltHarness(()=>Promise.resolve('denied')), off=denied.mountTilt();
  await denied.toggleTilt();assert.equal(denied.state.tilt,'denied');assert.equal(denied.active(),0);off();
});
function audioHarness() {
  const h=stateHarness(), win=new EventTarget(),doc=new EventTarget(),players=[];
  let gesture=false,reject=false;
  doc.hidden=false;
  doc.body={append(){}};
  class Audio extends EventTarget {
    paused=true;
    constructor(src){super();this.src=src;players.push(this);}
    setAttribute(){} removeAttribute(){} load(){} remove(){}
    play(){assert.equal(gesture||players.length===1&&h.state.sound===false,true);this.paused=false;
      return reject?Promise.reject(new Error('NotAllowedError')):Promise.resolve().then(()=>{this.dispatchEvent(new Event('playing'));});}
    pause(){if(!this.paused){this.paused=true;this.dispatchEvent(new Event('pause'));}}
  }
  const implementation=load('lib/audio.ts',{'./store':h.store},{window:win,document:doc,Audio});
  return {...h,...implementation,doc,players,tap:()=>{gesture=true;implementation.toggleSound();gesture=false;},deny:()=>reject=true};
}
test('First sound tap calls media.play immediately; rapid off cancels pending playback',async()=>{
  const h=audioHarness(),off=h.mountAudioLifecycle();
  assert.equal(h.players.length,0);h.tap();assert.equal(h.players.length,1);
  assert.equal(h.players[0].src,'/audio/street-loop.m4a');h.tap();await Promise.resolve();
  assert.equal(h.state.sound,false);assert.equal(h.players[0].paused,true);off();
});
test('Sound is confirmed by playback, pauses in background, resumes without duplication',async()=>{
  const h=audioHarness(),off=h.mountAudioLifecycle();h.tap();await Promise.resolve();assert.equal(h.state.sound,true);
  h.doc.hidden=true;h.doc.dispatchEvent(new Event('visibilitychange'));assert.equal(h.players[0].paused,true);
  h.doc.hidden=false;h.doc.dispatchEvent(new Event('visibilitychange'));await Promise.resolve();
  assert.equal(h.players.length,1);assert.equal(h.state.sound,true);off();assert.equal(h.players[0].paused,true);
});
test('Audio denial returns the control to off, with retry feedback',async()=>{
  const h=audioHarness(),off=h.mountAudioLifecycle();h.deny();h.tap();await Promise.resolve();await Promise.resolve();
  assert.equal(h.state.sound,false);assert.equal(h.state.soundLoading,false);assert.equal(h.state.soundError,true);off();
});
test('Phone scrolling never creates WebGL photo textures or hides the native images',()=>{
  const rt={w:390,h:844,limit:4000,scroll:0,dirty:true}, canvases=[];
  const entries=Array.from({length:6},(_,i)=>({
    dataset:{focus:'50'}, addEventListener(){},
    querySelector(){return {complete:true,naturalWidth:1200,naturalHeight:1200,addEventListener(){}};},
    getBoundingClientRect(){return {top:Math.floor(i/2)*300-rt.scroll,left:i%2*190,width:170,height:170};},
  }));
  class Group {children=[];add(e){this.children.push(e);}remove(e){this.children=this.children.filter(x=>x!==e);}}
  class Geometry {dispose(){}}
  class Mesh {constructor(geometry,material){this.material=material;this.position={set(){}};this.scale={set(){}};}}
  class Texture {constructor(image){this.image=image;}dispose(){this.disposed=true;}}
  const three={Group,PlaneGeometry:Geometry,Mesh,CanvasTexture:Texture,SRGBColorSpace:'srgb',LinearFilter:'linear'};
  const implementation=load('components/scene/photos.ts',{
    three,'@/lib/config':{BREAKPOINT_MOBILE:600,LENS:{band:.12}},'@/lib/runtime':{rt},
    '@/lib/scroll':{getScroller:()=>({scrollTop:rt.scroll,getBoundingClientRect:()=>({top:0,left:0})})},
    '@/lib/store':{ui:()=>({reduced:false,sceneFailed:false})},'@/lib/ticker':{wake(){}},
    './materials':{createPhotoMaterial:()=>({dispose(){},uniforms:{uMap:{},uImageAspect:{},uFocus:{},uPlaneAspect:{},uHover:{}}})},
    './state':{frame:{dt:1/60,settling:false}},
  },{matchMedia:()=>({matches:true}),document:{querySelectorAll:()=>entries,createElement:()=>{
    const canvas={getContext:()=>({drawImage(){}})};canvases.push(canvas);return canvas;
  }}});
  const photos=implementation.createPhotos({capabilities:{getMaxAnisotropy:()=>8}});
  assert.equal(photos.onScreen(),false);photos.update();assert.equal(photos.group.children.length,0);
  assert.equal(canvases.length,0);
  const textures=photos.group.children.map(m=>m.material.uniforms.uMap.value);
  for (const scroll of [100,400,0,1400,800,0]) { rt.scroll=scroll; assert.equal(photos.onScreen(),false); photos.update(); }
  assert.equal(canvases.length,0); assert.equal(photos.group.children.length,0);
  rt.scroll=1400;assert.equal(photos.onScreen(),false);assert.equal(photos.group.children.length,0);
  assert.ok(entries.every(e=>e.dataset.gl===undefined));assert.ok(textures.every(t=>t.disposed));photos.dispose();
});
const lensMath=load('lib/edge-lens.ts');
test('The mobile curve is flat in the middle, symmetric at both screen edges',()=>{
  const lens=(x,y)=>lensMath.edgeLens(x,170,y,390,844,.065,.12);
  const flat=lens(26,422);
  assert.ok(Math.abs(flat.x)<1e-9);assert.ok(Math.abs(flat.scale-1)<1e-9);
  const top=lens(26,0),bottom=lens(26,844),right=lens(194,0);
  assert.ok(top.x<0&&top.scale>1);assert.ok(right.x>0&&right.scale>1);
  assert.ok(Math.abs(top.x-bottom.x)<1e-9);assert.ok(Math.abs(top.scale-bottom.scale)<1e-9);
  assert.ok(Math.abs(top.x+right.x)<1e-9);
});
test('The curve is confined to viewport bands and can fully respect reduced motion',()=>{
  const lens=(y,s=.065)=>lensMath.edgeLens(26,170,y,390,844,s,.12);
  assert.ok(lens(10).scale>lens(50).scale);
  assert.ok(Math.abs(lens(102).scale-1)<1e-9);
  assert.ok(Math.abs(lens(0,0).scale-1)<1e-9);
});
const direction=load('lib/config.ts').DIRECTION;
const easing=load('lib/runtime.ts').smooth;
test('Closing street is already visible when the preceding heading disappears',()=>{
  assert.ok(direction.streetIn[0]<direction.arrowOut[0]);
  assert.ok(easing(...direction.streetIn,direction.headingOut[1])>.75);
  assert.ok(direction.brandIn[0]<direction.headingOut[1]);
  assert.ok(direction.streetIn[1]<direction.brandIn[1]);
  assert.ok(direction.wordsIn[0]>direction.brandIn[0]);
});
function nativeLensHarness(cssTimeline=false) {
  let reads=0;
  class Element extends EventTarget {
    dataset={};children=[];parent=null;className='';style={setProperty(k,v){this[k]=v;}};
    append(...nodes){for(const n of nodes){if(n.fragment)this.append(...n.children);else{this.children.push(n);n.parent=this;}}}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
    setAttribute(){}
  }
  const rt={w:390,h:844,limit:4000,scroll:0};
  const photo=new Element(),img=new Element();
  Object.assign(img,{complete:true,naturalWidth:1200,naturalHeight:1200,currentSrc:'https://example.test/image.webp',src:'https://example.test/image.webp',decode:()=>Promise.resolve()});
  photo.querySelector=()=>img;
  photo.getBoundingClientRect=()=>{reads++;return {top:80-root.scrollTop,left:26,width:170,height:170};};
  const root={scrollTop:0,querySelectorAll:()=>[photo],getBoundingClientRect:()=>{reads++;return {top:0,left:0};}};
  const idle=[],cancelled=new Set(),tasks=[];
  let intersect;
  class Observer {constructor(fn){intersect=fn;}observe(){}disconnect(){this.disconnected=true;}fire(near){this.fn([{target:photo,isIntersecting:near}]);}}
  const state={reduced:false};
  const implementation=load('lib/mobile-lens.ts',{
    './config':{LENS:{band:.12,strength:.065}},'./edge-lens':lensMath,'./runtime':{rt},
    './scroll':{getScroller:()=>root},'./store':{ui:()=>state},
    './ticker':{wake(){},addTask:fn=>(tasks.push(fn),()=>tasks.splice(tasks.indexOf(fn),1))},
  },{CSS:{supports:()=>cssTimeline},IntersectionObserver:Observer,
    window:{requestIdleCallback:fn=>(idle.push(fn),idle.length),cancelIdleCallback:id=>cancelled.add(id)},
    document:{createElement:()=>new Element(),createDocumentFragment:()=>Object.assign(new Element(),{fragment:true})}});
  const flush=async()=>{for(let i=0;i<idle.length;i++)if(!cancelled.has(i+1)){idle[i]();await Promise.resolve();await Promise.resolve();}idle.length=0;};
  return {rt,root,photo,img,state,tasks,flush,near:b=>intersect([{target:photo,isIntersecting:b}]),reads:()=>reads,start:implementation.createMobileLens};
}
test('Old-browser native lens prepares in idle time and never measures layout while scrolling',async()=>{
  const h=nativeLensHarness(),off=h.start();h.near(true);
  assert.equal(h.photo.children.length,0);await h.flush();assert.equal(h.photo.children.length,1);
  h.tasks[0]();const reads=h.reads(),overlay=h.photo.children[0];
  for(const scroll of [20,40,60,80,100,120,140,160]){h.rt.scroll=scroll;h.root.scrollTop=scroll;h.tasks[0]();}
  assert.equal(h.reads(),reads);assert.equal(h.photo.children[0],overlay);
  assert.ok(overlay.children.some(s=>s.style.transform&&s.style.transform!=='none'));
  h.near(false);assert.equal(h.photo.children.length,0);assert.equal(h.photo.dataset.domLens,undefined);
  off();assert.equal(h.tasks.length,0);
});
test('CSS-timeline lens avoids JavaScript animation writes and handles disposal during decode',async()=>{
  const h=nativeLensHarness(true),off=h.start();h.near(true);await h.flush();
  const overlay=h.photo.children[0];assert.equal(overlay.dataset.timeline,'css');
  h.rt.scroll=60;h.tasks[0]();assert.ok(overlay.children.every(s=>s.style.transform===undefined));off();
  const late=nativeLensHarness();let resolve;late.img.decode=()=>new Promise(r=>resolve=r);
  const stop=late.start();late.near(true);await late.flush();stop();resolve();await Promise.resolve();
  assert.equal(late.photo.children.length,0);assert.equal(late.photo.dataset.domLens,undefined);
});
test('The closing wordmark is underway before the old heading fully disappears',()=>{
  assert.ok(easing(...direction.brandIn,direction.headingOut[1])>=.45);
});
const choreography=load('lib/closing-motion.ts',{'./config':{DIRECTION:direction},'./runtime':{smooth:easing}});
test('Closing labels are present before the glass mark appears and fling in opposite directions',()=>{
  assert.ok(easing(...direction.stickersIn,direction.brandIn[0])>.98);
  const a=choreography.closingMotion(.85,0),b=choreography.closingMotion(.85,1);
  assert.ok(a.x<0&&b.x>0);assert.ok(a.y<0);assert.ok(a.angle<0&&b.angle>0);
  const initial=choreography.closingMotion(direction.brandIn[0],0);
  assert.ok(Math.abs(initial.x)<1e-9);assert.ok(Math.abs(initial.y)<1e-9);
});
test('Scroll throw and turn are reversible, settle before the footer and respect reduced motion',()=>{
  const snapshot=choreography.closingMotion(.8,0);
  choreography.closingMotion(1,0);choreography.closingMotion(.4,0);
  assert.equal(JSON.stringify(choreography.closingMotion(.8,0)),JSON.stringify(snapshot));
  assert.equal(choreography.closingMotion(1,0).turn,1);
  assert.equal(choreography.closingMotion(.7,0,true).turn,1);
  assert.equal(choreography.closingMotion(.7,0,true).x,-.19);
});
