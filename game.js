import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { connectRoom } from "./firebase-config.js";

const canvas = document.querySelector("#game-canvas");
const menu = document.querySelector("#menu");
const pausePanel = document.querySelector("#pause-panel");
const controls = document.querySelector("#controls");
const hud = document.querySelector("#hud");
const menuMessage = document.querySelector("#menu-message");
const onlineOptions = document.querySelector("#online-options");
const roomInput = document.querySelector("#room-code");
const toast = document.querySelector("#toast");
const rotateHint = document.querySelector("#rotate-hint");

let renderer, scene, camera, clock;
let running = false, paused = false, online = false, matchStartedAt = 0;
let roomConnection = null, roomCode = "", myId = null, roomPlayers = [];
let scoreHome = 0, scoreAway = 0, lastScoreAt = 0;
let homePlayers = [], awayPlayers = [], ball, ballVelocity = new THREE.Vector3();
let activeIndex = 0, selectedAction = "", toastTimer;
const keys = new Set();
const actions = { sprint:false, tackle:false, pass:false, shoot:false, through:false, switch:false };
const input = { x:0, y:0, sprint:false };
const FIELD = { width: 34, length: 54 };
const mats = {};
const clockEl = document.querySelector("#match-clock");
const homeScoreEl = document.querySelector("#home-score");
const awayScoreEl = document.querySelector("#away-score");
const modeLabel = document.querySelector("#mode-label");

function material(color, roughness=.8) { return new THREE.MeshStandardMaterial({ color, roughness }); }
function makeMat(name, color, roughness=.8) { mats[name] = material(color, roughness); return mats[name]; }

function init3D() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8ac6e6);
  scene.fog = new THREE.Fog(0x8ac6e6, 75, 150);
  camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, .1, 220);
  camera.position.set(0, 35, 45);
  camera.lookAt(0, 0, 0);
  clock = new THREE.Clock();

  scene.add(new THREE.HemisphereLight(0xd8edff, 0x29452b, 2.0));
  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.position.set(-18, 35, 15);
  scene.add(sun);

  makeMat("grass1", 0x267b3c); makeMat("grass2", 0x218039);
  makeMat("line", 0xffffff); makeMat("home", 0xc9ff45);
  makeMat("away", 0x244fe8); makeMat("skin", 0xd4a078);
  makeMat("shorts", 0x101c16); makeMat("keeper", 0xffa21a);
  makeMat("ball", 0xf7f7ef); makeMat("dark", 0x111a16);
  makeMat("goal", 0xe8eee9, .4);

  buildPitch();
  buildTeams();
  buildBall();
  window.addEventListener("resize", onResize);
  animate();
  menuMessage.textContent = "Ready. Start an offline match or configure online mode.";
}

function buildPitch() {
  const base = new THREE.Mesh(new THREE.PlaneGeometry(100, 120), material(0x193c2a));
  base.rotation.x = -Math.PI/2; base.position.y = -.12; scene.add(base);
  const stripeGeo = new THREE.PlaneGeometry(FIELD.width, FIELD.length/10);
  for (let i=0;i<10;i++) {
    const stripe = new THREE.Mesh(stripeGeo, material(i%2 ? 0x247d3b : 0x2b8741));
    stripe.rotation.x = -Math.PI/2;
    stripe.position.set(0, -.04, -FIELD.length/2 + FIELD.length/20 + i*FIELD.length/10);
    scene.add(stripe);
  }
  const lineMat = mats.line;
  function line(x1,z1,x2,z2) {
    const dx=x2-x1, dz=z2-z1, len=Math.hypot(dx,dz);
    const m = new THREE.Mesh(new THREE.BoxGeometry(.11,.035,len), lineMat);
    m.position.set((x1+x2)/2,.015,(z1+z2)/2);
    m.rotation.y = -Math.atan2(dx,dz); scene.add(m);
  }
  line(-FIELD.width/2,-FIELD.length/2, FIELD.width/2,-FIELD.length/2);
  line(-FIELD.width/2, FIELD.length/2, FIELD.width/2, FIELD.length/2);
  line(-FIELD.width/2,-FIELD.length/2,-FIELD.width/2,FIELD.length/2);
  line(FIELD.width/2,-FIELD.length/2,FIELD.width/2,FIELD.length/2);
  line(-FIELD.width/2,0,FIELD.width/2,0);
  const circle = new THREE.Mesh(new THREE.TorusGeometry(5.5,.07,5,64), lineMat);
  circle.rotation.x = Math.PI/2; circle.position.y=.035; scene.add(circle);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(.16,16), lineMat);
  dot.rotation.x=-Math.PI/2; dot.position.y=.04; scene.add(dot);
  for (const z of [-FIELD.length/2+5.5, FIELD.length/2-5.5]) {
    line(-9,z-5.5,9,z-5.5); line(-9,z-5.5,-9,z+5.5); line(9,z-5.5,9,z+5.5);
    line(-4,z-2.5,4,z-2.5); line(-4,z-2.5,-4,z+2.5); line(4,z-2.5,4,z+2.5);
  }
  createGoal(-FIELD.length/2); createGoal(FIELD.length/2);
  // Stadium lights and simple stands
  for (const x of [-24,24]) for (const z of [-25,0,25]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.13,.22,12,8), material(0x5b6a63));
    pole.position.set(x,6,z); scene.add(pole);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.8,.55,.5), material(0xf6ffe5));
    lamp.position.set(x,12,z); scene.add(lamp);
  }
}
function createGoal(z) {
  const goal = new THREE.Group();
  const frameMat = mats.goal;
  const depth = z < 0 ? -1 : 1;
  const goalZ = z + depth*1.5;
  const postGeo = new THREE.CylinderGeometry(.13,.13,2.5,8);
  for (const x of [-3.7,3.7]) {
    const post = new THREE.Mesh(postGeo,frameMat); post.position.set(x,1.25,goalZ); goal.add(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,7.4,8),frameMat);
  bar.rotation.z=Math.PI/2; bar.position.set(0,2.5,goalZ); goal.add(bar);
  const net = new THREE.Mesh(new THREE.BoxGeometry(7.2,2.4,2.8), new THREE.MeshBasicMaterial({color:0xffffff,wireframe:true,transparent:true,opacity:.2}));
  net.position.set(0,1.2,z+depth*1.4); goal.add(net);
  scene.add(goal);
}
function makePlayer(team, x,z,index, goalkeeper=false) {
  const group = new THREE.Group();
  const shirt = goalkeeper ? mats.keeper : (team==="home" ? mats.home : mats.away);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.42,.65,3,7), shirt);
  torso.position.y=1.25; group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.25,8,8),mats.skin); head.position.y=2.02; group.add(head);
  const shorts = new THREE.Mesh(new THREE.BoxGeometry(.64,.3,.48),mats.shorts); shorts.position.y=.72; group.add(shorts);
  for (const lx of [-.2,.2]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.12,.45,2,5),mats.shorts);
    leg.position.set(lx,.35,0); group.add(leg);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(.18,.12,.32),mats.dark);
    boot.position.set(lx,.1,-.08); group.add(boot);
  }
  group.position.set(x,0,z);
  group.userData={team,index,goalkeeper,homeX:x,homeZ:z, speed:7, target:null};
  scene.add(group);
  return group;
}
function buildTeams() {
  [...homePlayers,...awayPlayers].forEach(p=>scene.remove(p));
  homePlayers=[]; awayPlayers=[];
  const homeSpots=[[-4,10],[4,10],[-9,1],[0,2],[9,1],[-5,-9],[5,-9]];
  const awaySpots=[[-4,-10],[4,-10],[-9,-1],[0,-2],[9,-1],[-5,9],[5,9]];
  homeSpots.forEach((p,i)=>homePlayers.push(makePlayer("home",p[0],p[1],i,i===0)));
  awaySpots.forEach((p,i)=>awayPlayers.push(makePlayer("away",p[0],p[1],i,i===0)));
}
function buildBall() {
  ball = new THREE.Mesh(new THREE.SphereGeometry(.42,14,10),mats.ball);
  ball.position.set(0,.42,0); scene.add(ball);
  const seams = new THREE.Mesh(new THREE.IcosahedronGeometry(.425,0),new THREE.MeshBasicMaterial({color:0x202020,wireframe:true}));
  ball.add(seams);
}
function resetPositions() {
  homePlayers.forEach(p=>p.position.set(p.userData.homeX,0,p.userData.homeZ));
  awayPlayers.forEach(p=>p.position.set(p.userData.homeX,0,p.userData.homeZ));
  ball.position.set(0,.42,0); ballVelocity.set(0,0,0);
  activeIndex=3;
}
function showToast(text) {
  toast.textContent=text; toast.classList.remove("hidden");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.add("hidden"),1800);
}
function startMatch(isOnline=false) {
  online=isOnline; running=true; paused=false; scoreHome=0; scoreAway=0; matchStartedAt=performance.now(); lastScoreAt=0;
  resetPositions();
  menu.classList.add("hidden"); pausePanel.classList.add("hidden");
  controls.classList.remove("hidden"); hud.classList.remove("hidden");
  document.querySelector("#footer-hint").classList.remove("hidden");
  modeLabel.textContent=online ? "ONLINE ROOM" : "OFFLINE MATCH";
  updateScore(); menuMessage.textContent="";
  showToast(online ? "ONLINE MATCH STARTED" : "KICK OFF!");
}
function stopMatch() {
  running=false; paused=false; controls.classList.add("hidden"); hud.classList.add("hidden");
  document.querySelector("#footer-hint").classList.add("hidden");
  pausePanel.classList.add("hidden"); menu.classList.remove("hidden");
  if (roomConnection) { roomConnection.cleanup(); roomConnection=null; }
}
function updateScore() {
  homeScoreEl.textContent=scoreHome; awayScoreEl.textContent=scoreAway;
}
function onResize() {
  if (!renderer) return;
  camera.aspect=window.innerWidth/window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  rotateHint.classList.toggle("hidden", window.innerWidth >= window.innerHeight || window.innerWidth > 700);
}

function playerDirection() {
  let x=input.x, y=input.y;
  if (keys.has("a")||keys.has("arrowleft")) x-=1;
  if (keys.has("d")||keys.has("arrowright")) x+=1;
  if (keys.has("w")||keys.has("arrowup")) y-=1;
  if (keys.has("s")||keys.has("arrowdown")) y+=1;
  const len=Math.hypot(x,y);
  if (len>1) {x/=len;y/=len;}
  return {x,y};
}
function getGamepad() {
  const pads=navigator.getGamepads ? navigator.getGamepads() : [];
  for (const pad of pads) if (pad && pad.connected) return pad;
  return null;
}
function updateGamepad() {
  const pad=getGamepad(); if(!pad) return;
  if (Math.abs(pad.axes[0]||0)>.15) input.x=pad.axes[0];
  if (Math.abs(pad.axes[1]||0)>.15) input.y=pad.axes[1];
  if (pad.axes[0]===0) input.x=0;
  if (pad.axes[1]===0) input.y=0;
  input.sprint=!!(pad.buttons[7]?.pressed || pad.buttons[6]?.pressed);
  if (pad.buttons[0]?.pressed) actions.shoot=true; // A / Cross
  if (pad.buttons[1]?.pressed) actions.pass=true;  // B / Circle
  if (pad.buttons[2]?.pressed) actions.through=true;
  if (pad.buttons[3]?.pressed) actions.switch=true;
  if (pad.buttons[4]?.pressed) actions.tackle=true;
}
function nearestBallPlayer() {
  return homePlayers[activeIndex] || homePlayers[3];
}
function movePlayer(p, dx,dz, speed, dt) {
  p.position.x=THREE.MathUtils.clamp(p.position.x+dx*speed*dt,-FIELD.width/2+1,FIELD.width/2-1);
  p.position.z=THREE.MathUtils.clamp(p.position.z+dz*speed*dt,-FIELD.length/2+1,FIELD.length/2-1);
  if(Math.hypot(dx,dz)>.05) p.rotation.y=Math.atan2(dx,dz);
}
function actionKick(power, lift=0) {
  const p=nearestBallPlayer();
  const d=p.position.distanceTo(ball.position);
  if(d>3.2) { showToast("MOVE CLOSER TO THE BALL"); return; }
  let dx=Math.sin(p.rotation.y), dz=Math.cos(p.rotation.y);
  if(Math.abs(dx)+Math.abs(dz)<.1) dz=-1;
  // Home team attacks toward the negative-Z goal.
  ballVelocity.set(dx*power, lift, dz*power);
  showToast(power>12 ? "SHOT!" : "PASS!");
}
function handleActions() {
  if(actions.shoot){ actionKick(19,5); actions.shoot=false; }
  if(actions.pass){ actionKick(10,2); actions.pass=false; }
  if(actions.through){ actionKick(14,1.5); actions.through=false; }
  if(actions.switch){ activeIndex=(activeIndex+1)%homePlayers.length; actions.switch=false; showToast("PLAYER "+(activeIndex+1)); }
  if(actions.tackle) {
    const p=nearestBallPlayer();
    if(p.position.distanceTo(ball.position)<3.4){ ballVelocity.set((Math.random()-.5)*3,2,-8); showToast("TACKLE!"); }
    else showToast("GET CLOSER TO TACKLE");
    actions.tackle=false;
  }
}
function updateBall(dt) {
  ballVelocity.y-=17*dt;
  ball.position.addScaledVector(ballVelocity,dt);
  if(ball.position.y<.42){ball.position.y=.42; if(Math.abs(ballVelocity.y)>1.2)ballVelocity.y*=-.34;else ballVelocity.y=0;}
  ballVelocity.multiplyScalar(Math.pow(.988,dt*60));
  if(ball.position.x < -FIELD.width/2+.5 || ball.position.x > FIELD.width/2-.5) ballVelocity.x*=-.7;
  ball.position.x=THREE.MathUtils.clamp(ball.position.x,-FIELD.width/2+.5,FIELD.width/2-.5);
  if(ball.position.z < -FIELD.length/2-.2 && Math.abs(ball.position.x)<3.8) {
    if(performance.now()-lastScoreAt>1500){scoreHome++; scored("GOAL! HOME TEAM");}
  } else if(ball.position.z > FIELD.length/2+.2 && Math.abs(ball.position.x)<3.8) {
    if(performance.now()-lastScoreAt>1500){scoreAway++; scored("GOAL! AWAY TEAM");}
  }
  if(ball.position.z < -FIELD.length/2+1 || ball.position.z > FIELD.length/2-1) {
    if(Math.abs(ball.position.x)>3.8) ballVelocity.z*=-.72;
  }
}
function scored(message) {
  lastScoreAt=performance.now(); updateScore(); showToast(message); resetPositions();
}
function updateAI(dt) {
  const target=ball.position;
  // Simple opposing AI chases the ball and occasionally kicks it.
  for(let i=0;i<awayPlayers.length;i++){
    const p=awayPlayers[i];
    if(i===0) { p.position.x += (target.x-p.position.x)*Math.min(1,dt*.7); p.position.z += (target.z-p.position.z)*Math.min(1,dt*.7); }
    else {
      const followX=THREE.MathUtils.clamp(target.x*.55+p.userData.homeX*.45,-14,14);
      const followZ=THREE.MathUtils.clamp(target.z*.5+p.userData.homeZ*.5,-24,24);
      p.position.x+=(followX-p.position.x)*Math.min(1,dt*.45);
      p.position.z+=(followZ-p.position.z)*Math.min(1,dt*.45);
    }
    const dist=p.position.distanceTo(ball.position);
    if(dist<1.6 && Math.random()<dt*.8) ballVelocity.set((Math.random()-.5)*7,2.5,10);
  }
  // Home teammates drift into passing lanes.
  homePlayers.forEach((p,i)=>{
    if(i===activeIndex)return;
    const tx=THREE.MathUtils.clamp(p.userData.homeX+ball.position.x*.15,-15,15);
    const tz=THREE.MathUtils.clamp(p.userData.homeZ+ball.position.z*.12,-24,24);
    p.position.x+=(tx-p.position.x)*Math.min(1,dt*.25);
    p.position.z+=(tz-p.position.z)*Math.min(1,dt*.25);
  });
}
function syncOnline(dt) {
  if(!online || !roomConnection) return;
  const p=nearestBallPlayer();
  if(roomPlayers.length>1) {
    const opponent=roomPlayers.find(r=>r.id!==myId);
    if(opponent && opponent.x!=null) {
      // Render the remote user as the first away player.
      awayPlayers[1].position.set(opponent.x,0,opponent.z);
    }
  }
  if(Math.random()<.08) roomConnection.updatePlayer({x:p.position.x,z:p.position.z,rot:p.rotation.y,team:"home"}).catch(()=>{});
  // The current prototype synchronizes player positions; match simulation stays client-side.
}
function animate() {
  requestAnimationFrame(animate);
  if(!renderer) return;
  const dt=Math.min(clock.getDelta(),.04);
  if(running && !paused) {
    updateGamepad();
    const dir=playerDirection();
    const p=nearestBallPlayer();
    const speed=(input.sprint || keys.has("shift")) ? 10.5 : 7;
    movePlayer(p,dir.x,-dir.y,speed,dt);
    handleActions();
    updateBall(dt);
    if(online) syncOnline(dt); else updateAI(dt);
    const elapsed=Math.floor((performance.now()-matchStartedAt)/1000);
    clockEl.textContent=String(Math.floor(elapsed/60)).padStart(2,"0")+":"+String(elapsed%60).padStart(2,"0");
    const target=new THREE.Vector3(p.position.x*.45,0,p.position.z+4);
    camera.position.lerp(new THREE.Vector3(p.position.x*.38,31,p.position.z+35),Math.min(1,dt*2));
    camera.lookAt(target);
  }
  renderer.render(scene,camera);
}

document.querySelector("#offline-btn").addEventListener("click",()=>startMatch(false));
document.querySelector("#online-btn").addEventListener("click",()=>{
  onlineOptions.classList.toggle("hidden");
  menuMessage.textContent="Online mode needs a separate Firebase project and configuration.";
});
document.querySelector("#join-room-btn").addEventListener("click",async()=>{
  roomCode=roomInput.value.trim().toUpperCase().replace(/[^A-Z0-9-]/g,"").slice(0,12);
  if(roomCode.length<3){menuMessage.textContent="Enter a room code with at least 3 characters.";return;}
  menuMessage.textContent="Connecting…";
  try{
    roomConnection=await connectRoom(roomCode, state=>{
      if(state.players){roomPlayers=state.players;myId=state.myId;}
    }, status=>{menuMessage.textContent=status;});
    startMatch(true);
  }catch(err){menuMessage.textContent=err.message || "Could not connect. Check Firebase settings and database rules.";roomConnection=null;}
});
document.querySelector("#pause-btn").addEventListener("click",()=>{paused=true;pausePanel.classList.remove("hidden");});
document.querySelector("#resume-btn").addEventListener("click",()=>{paused=false;pausePanel.classList.add("hidden");});
document.querySelector("#restart-btn").addEventListener("click",()=>{scoreHome=0;scoreAway=0;updateScore();matchStartedAt=performance.now();resetPositions();paused=false;pausePanel.classList.add("hidden");});
document.querySelector("#menu-btn").addEventListener("click",stopMatch);

window.addEventListener("keydown",e=>{
  keys.add(e.key.toLowerCase());
  if([" ","arrowup","arrowdown","arrowleft","arrowright"].includes(e.key.toLowerCase()))e.preventDefault();
  if(e.repeat)return;
  if(e.key===" "||e.key.toLowerCase()==="j")actions.shoot=true;
  if(e.key.toLowerCase()==="k")actions.pass=true;
  if(e.key.toLowerCase()==="l")actions.through=true;
  if(e.key.toLowerCase()==="q")actions.switch=true;
  if(e.key.toLowerCase()==="e")actions.tackle=true;
});
window.addEventListener("keyup",e=>keys.delete(e.key.toLowerCase()));
window.addEventListener("gamepadconnected",()=>showToast("GAMEPAD CONNECTED"));
window.addEventListener("gamepaddisconnected",()=>showToast("GAMEPAD DISCONNECTED"));

const joyZone=document.querySelector("#joystick-zone");
const joyKnob=document.querySelector("#joystick-knob");
let joyPointer=null, joyCenter={x:0,y:0};
function setJoystick(e){
  const rect=joyZone.getBoundingClientRect();
  const cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
  let dx=e.clientX-cx, dy=e.clientY-cy;
  const max=42, len=Math.hypot(dx,dy);
  if(len>max){dx=dx/len*max;dy=dy/len*max;}
  joyKnob.style.transform=`translate(${dx}px,${dy}px)`;
  input.x=dx/max; input.y=dy/max;
}
function releaseJoystick(){
  joyPointer=null; input.x=0; input.y=0; joyKnob.style.transform="translate(0px,0px)";
}
joyZone.addEventListener("pointerdown",e=>{joyPointer=e.pointerId;joyZone.setPointerCapture(e.pointerId);setJoystick(e);});
joyZone.addEventListener("pointermove",e=>{if(joyPointer===e.pointerId)setJoystick(e);});
joyZone.addEventListener("pointerup",releaseJoystick);
joyZone.addEventListener("pointercancel",releaseJoystick);
document.querySelectorAll(".action-btn").forEach(btn=>{
  const action=btn.dataset.action;
  const down=e=>{e.preventDefault();if(action==="sprint")input.sprint=true;else actions[action]=true;};
  const up=e=>{e.preventDefault();if(action==="sprint")input.sprint=false;};
  btn.addEventListener("pointerdown",down);
  btn.addEventListener("pointerup",up);
  btn.addEventListener("pointercancel",up);
  btn.addEventListener("pointerleave",up);
});

onResize();
try { init3D(); } catch(err) { menuMessage.textContent="3D could not start. Open this game in a modern browser with WebGL enabled."; console.error(err); }
