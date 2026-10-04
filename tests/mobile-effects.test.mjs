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
test('Phone lens uploads only edge pictures, caps resolution and frees them offscreen',()=>{
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
  assert.equal(photos.onScreen(),true);photos.update();assert.equal(photos.group.children.length,4);
  assert.ok(canvases.every(c=>c.width===512&&c.height===512));
  const textures=photos.group.children.map(m=>m.material.uniforms.uMap.value);
  assert.ok(textures.every(t=>t.generateMipmaps===false));
  rt.scroll=1400;assert.equal(photos.onScreen(),false);assert.equal(photos.group.children.length,0);
  assert.ok(entries.every(e=>e.dataset.gl===undefined));assert.ok(textures.every(t=>t.disposed));photos.dispose();
});
