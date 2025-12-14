import { createState, configureRun, setTheme, personalizeText, setLog, updateBars } from "./state.js";
import { createInput, bindInput, key, wasPressed, clearFrame } from "./input.js";
import { generateBraidedMaze, randomFloorCell, themeLore } from "./map.js";
import { createRenderer, render } from "./render.js";
import { spawnPlayer, spawnEnemy, spawnPeasant, moveWithCollision, updateEnemies, nearestPeasant } from "./entities.js";
import { setupCombatByRole, attack } from "./combat.js";
import { updateEffects, spawnFaceFlash } from "./hallucinations.js";
import { clamp, dist, pick } from "./utils.js";
import { createAudio } from "./audio.js";

/* ========= DOM ========= */
const canvas = document.getElementById("game");
const ui = {
  hudLoc: document.getElementById("hud-loc"),
  hudObj: document.getElementById("hud-obj"),
  hudMission: document.getElementById("hud-mission"),
  barOxy: document.getElementById("bar-oxy"),
  barSan: document.getElementById("bar-san"),
  stats: document.getElementById("hud-stats"),
  log: document.getElementById("hud-log"),
  ammo: document.getElementById("hud-ammo"),

  menu: document.getElementById("menu"),
  nameInput: document.getElementById("nameInput"),
  roleSelect: document.getElementById("roleSelect"),
  introLore: document.getElementById("introLore"),
  btnStart: document.getElementById("btnStart"),
  btnMute: document.getElementById("btnMute"),

  prompt: document.getElementById("prompt"),
  promptText: document.getElementById("promptText"),
  promptA: document.getElementById("promptA"),
  promptB: document.getElementById("promptB"),
  promptBar: document.getElementById("promptBar"),

  flash: document.getElementById("flash"),
};

const state = createState();
state.ui = ui;

const input = createInput();
bindInput(input, canvas);

const R = createRenderer(canvas);

/* ========= AUDIO TOGGLE ========= */
ui.btnMute.addEventListener("click", ()=>{
  state.muted = !state.muted;
  ui.btnMute.textContent = state.muted ? "AUDIO: OFF" : "AUDIO: ON";
  if (state.audio && state.muted) state.audio.ac.suspend().catch(()=>{});
  if (state.audio && !state.muted) state.audio.resume().catch(()=>{});
});

/* ========= START ========= */
ui.btnStart.addEventListener("click", async ()=>{
  configureRun(state, { name: ui.nameInput.value, role: ui.roleSelect.value });
  setTheme(state);

  state.audio = createAudio(state);
  if(!state.muted) await state.audio.resume();

  ui.menu.classList.add("hidden");
  startRun();
});

function startRun(){
  state.running = true;
  state.paused = false;
  state.level = 1;
  state.escalation = 0;
  state.keysFound = 0;
  setupCombatByRole(state);
  buildLevel();
  setLog(state, personalizeText(state, "RUN STARTED: {NAME}."));
}

/* ========= PROMPT (peasants + lore choice) ========= */
function showPrompt(p){
  if(state.prompt.active) return;
  state.prompt.active = true;
  state.prompt.text = personalizeText(state, p.text);
  state.prompt.a = personalizeText(state, p.a);
  state.prompt.b = personalizeText(state, p.b);
  state.prompt.timer = p.time ?? 7.0;
  state.prompt.onChoose = p.choose;

  ui.promptText.textContent = state.prompt.text;
  ui.promptA.textContent = state.prompt.a;
  ui.promptB.textContent = state.prompt.b;
  ui.promptBar.style.width = "100%";
  ui.prompt.classList.remove("hidden");

  setLog(state, "INPUT REQUIRED.");
  state.audio?.blip?.(0.8);
}

function choosePrompt(choice){
  if(!state.prompt.active) return;
  const fn = state.prompt.onChoose;
  state.prompt.active = false;
  ui.prompt.classList.add("hidden");
  state.audio?.blip?.(0.8);
  if(fn) fn(choice);
}

/* ========= PEASANT PROMPTS ========= */
function peasantPrompt(state, npc){
  const offer = npc.offer;
  showPrompt({
    text: offer.text,
    a: offer.a,
    b: offer.b,
    time: 9.0,
    choose:(c)=>{
      if(c===1){
        offer.apply(state);
        setLog(state, `PEASANT: ${offer.title}`);
        state.audio?.blip?.(1.0);
        npc.used = true;
        npc.alive = false; // vanishes
      } else {
        setLog(state, "YOU REFUSED.");
        state.escalation += 0.2;
      }
    }
  });
}

/* ========= LEVEL BUILD ========= */
function buildLevel(){
  state.entities.length = 0;
  state.pickups.length = 0;
  state.decals.length = 0;
  state.effects.length = 0;

  setTheme(state);
  generateBraidedMaze(state, 31, 21);
  spawnPlayer(state);

  // reset per level
  state.keysFound = 0;

  // place KEYS
  const keyCount = state.keysTotal;
  for(let i=0;i<keyCount;i++){
    const c = randomFloorCell(state, {x:1,y:1,d:10+i*2});
    state.pickups.push({ kind:"key", x:(c.x+0.5)*state.tileSize, y:(c.y+0.5)*state.tileSize, taken:false });
  }

  // place PORTAL (locked until keys collected)
  const portalCell = randomFloorCell(state, {x:1,y:1,d:20});
  state.pickups.push({ kind:"portal", x:(portalCell.x+0.5)*state.tileSize, y:(portalCell.y+0.5)*state.tileSize, taken:false, locked:true });

  // oxygen tanks (more generous)
  const tankCount = 4 + state.difficulty.spawnExtra;
  for(let i=0;i<tankCount;i++){
    const c = randomFloorCell(state, {x:1,y:1,d:8+i});
    state.pickups.push({ kind:"oxygen", x:(c.x+0.5)*state.tileSize, y:(c.y+0.5)*state.tileSize, taken:false, val: 16 + (state.r()*12|0) });
  }

  // secret perk sometimes
  if(state.r() < 0.70){
    const c = randomFloorCell(state, {x:1,y:1,d:16});
    state.pickups.push({ kind:"perk", x:(c.x+0.5)*state.tileSize, y:(c.y+0.5)*state.tileSize, taken:false });
  }

  // spawn “psych peasants”
  const peasantCount = 2 + (state.r()<0.5 ? 1 : 0);
  for(let i=0;i<peasantCount;i++){
    const c = randomFloorCell(state, {x:1,y:1,d:12+i*3});
    spawnPeasant(state, c);
  }

  // enemies: easier early, still scaling
  const baseEnemies = Math.max(1, 1 + state.difficulty.spawnExtra + (state.level>1 ? 1 : 0));
  for(let i=0;i<baseEnemies;i++){
    const far = randomFloorCell(state, {x:1,y:1,d:18});
    spawnEnemy(state, "stalker", far);
  }

  ui.hudLoc.textContent = `LOC: ${state.theme.name}`;
  ui.hudMission.textContent = `— ${state.theme.perk}`;
  ui.hudObj.textContent = `OBJ: COLLECT KEYS (${state.keysFound}/${state.keysTotal})`;

  ui.introLore.textContent = personalizeText(state, themeLore(state));

  setLog(state, "FIND THE KEYS. THE PORTAL IS CLOSED.");
  updateBars(state);
}

/* ========= PICKUP + PORTAL LOGIC ========= */
function onKeyCollected(){
  state.keysFound++;
  setLog(state, `KEY ACQUIRED (${state.keysFound}/${state.keysTotal}).`);
  state.audio?.blip?.(0.85);

  // creep boost but mild
  state.escalation += 0.15;
  if(state.r()<0.22) spawnFaceFlash(state);

  if(state.keysFound >= state.keysTotal){
    const portal = state.pickups.find(p=>p.kind==="portal");
    if(portal) portal.locked = false;
    ui.hudObj.textContent = "OBJ: ENTER THE PORTAL";
    setLog(state, "ALL KEYS. PORTAL OPEN.");
    state.audio?.blip?.(1.0);
  } else {
    ui.hudObj.textContent = `OBJ: COLLECT KEYS (${state.keysFound}/${state.keysTotal})`;
  }
}

function onPortalEntered(){
  // level clear
  state.level++;
  state.escalation = Math.max(0, state.escalation - 0.6);

  // difficulty ramps slowly
  state.difficulty.enemyMult += 0.06;
  state.difficulty.oxygenDrain += 0.04;

  setLog(state, "SEQUENCE COMPLETE. DESCENDING…");
  state.audio?.blip?.(1.0);
  buildLevel();
}

/* ========= FLASH DOM ========= */
function updateFlashDOM(){
  const fx = state.effects.find(e=>e.type==="FACE_FLASH");
  if(!fx){
    ui.flash.classList.add("hidden");
    ui.flash.style.opacity = "0";
    ui.flash.style.background = "";
    ui.flash.style.transform = "";
    return;
  }
  const a = 1 - (fx.t/fx.dur);
  const op = clamp(a*0.85, 0, 0.85);
  const skew = (Math.random()*12-6)|0;

  ui.flash.classList.remove("hidden");
  ui.flash.style.opacity = String(op);
  ui.flash.style.transform = `translate(${skew}px, ${(Math.random()*10-5)|0}px) skewX(${(Math.random()*10-5)|0}deg)`;
  ui.flash.style.background = `
    radial-gradient(circle at ${40+Math.random()*20}% ${40+Math.random()*20}%,
      rgba(255,42,42,0.55), rgba(0,0,0,0) 55%),
    radial-gradient(circle at ${60+Math.random()*20}% ${45+Math.random()*20}%,
      rgba(255,255,255,0.12), rgba(0,0,0,0) 55%),
    linear-gradient(${(Math.random()*40-20)|0}deg,
      rgba(0,0,0,0), rgba(255,42,42,0.18), rgba(0,0,0,0))
  `;
}

/* ========= MAIN LOOP ========= */
let last = performance.now();
let acc = 0;
const STEP = 1/60;

function loop(t){
  requestAnimationFrame(loop);
  const now = t || performance.now();
  let frame = (now-last)/1000;
  last = now;
  frame = Math.min(frame, 0.05);
  acc += frame;

  if(state.audio && !state.muted) state.audio.tickMusic(state);

  while(acc >= STEP){
    update(STEP);
    acc -= STEP;
  }

  render(state, R);
  updateFlashDOM();
  clearFrame(input);
}

function update(dt){
  if(!state.running) return;

  // prompt
  if(state.prompt.active){
    state.prompt.timer -= dt;
    ui.promptBar.style.width = `${clamp((state.prompt.timer/9.0)*100, 0, 100)}%`;
    if(state.prompt.timer <= 0){
      state.prompt.active = false;
      ui.prompt.classList.add("hidden");
      setLog(state, "NO RESPONSE. IT CHOOSES FOR YOU.");
      state.escalation += 0.3;
    }
  }

  // prompt choices
  if(state.prompt.active){
    if(wasPressed(input,"Digit1") || wasPressed(input,"KeyY")) choosePrompt(1);
    if(wasPressed(input,"Digit2") || wasPressed(input,"KeyN")) choosePrompt(2);
  }

  // movement & oxygen
  const p = state.player;
  p.cooldown = Math.max(0, p.cooldown - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.invuln = Math.max(0, p.invuln - dt);

  const sprinting = key(input,"ShiftLeft") || key(input,"ShiftRight");
  p._sprinting = sprinting;

  const drain = (sprinting ? 1.55 : 1.0) * state.difficulty.oxygenDrain * (1 + state.escalation*0.02);
  p.oxyTimer = Math.max(0, p.oxyTimer - dt*drain);

  // suffocation is slower now
  if(p.oxyTimer <= 0){
    p.hp -= dt * (4.2 + state.level*0.3);
    p.sanity = clamp(p.sanity - dt*2.2, 0, p.sanityMax);
    if(state.r()<0.02) state.audio?.corrupt?.();
  } else {
    // recover tiny sanity when breathing is OK
    p.sanity = clamp(p.sanity + dt*0.6, 0, p.sanityMax);
  }

  // smoother movement
  let mx=0,my=0;
  if(key(input,"KeyW")||key(input,"ArrowUp")) my -= 1;
  if(key(input,"KeyS")||key(input,"ArrowDown")) my += 1;
  if(key(input,"KeyA")||key(input,"ArrowLeft")) mx -= 1;
  if(key(input,"KeyD")||key(input,"ArrowRight")) mx += 1;

  const mag = Math.hypot(mx,my) || 1;
  mx/=mag; my/=mag;

  const base = p.speed * (sprinting ? p.sprint : 1);
  const accel = 18;
  const friction = 11;

  // facing from mouse
  const camX = p.x - canvas.width/2;
  const camY = p.y - canvas.height/2;
  const fx = (input.mouseX + camX) - p.x;
  const fy = (input.mouseY + camY) - p.y;
  p.facing = Math.atan2(fy, fx);

  const dvx = mx*base;
  const dvy = my*base;

  p.vx += (dvx - p.vx) * clamp(accel*dt, 0, 1);
  p.vy += (dvy - p.vy) * clamp(accel*dt, 0, 1);

  if(mx===0 && my===0){
    p.vx *= Math.max(0, 1 - friction*dt);
    p.vy *= Math.max(0, 1 - friction*dt);
  }

  // thief dash
  if(state.role==="thief" && wasPressed(input,"Space") && sprinting && p.dashCd<=0){
    p.dashCd = 1.2;
    p.invuln = 0.18;
    const k = 520;
    p.vx += Math.cos(p.facing)*k;
    p.vy += Math.sin(p.facing)*k;
    setLog(state, "DASH.");
    state.audio?.blip?.(0.55);
  }

  moveWithCollision(state, p, dt);

  // interact and attack
  if(wasPressed(input,"KeyE")){
    const {npc, d} = nearestPeasant(state);
    if(npc && d < 56 && !state.prompt.active){
      peasantPrompt(state, npc);
    } else {
      setLog(state, "NO RESPONSE.");
      state.audio?.blip?.(0.25);
    }
  }
  if(wasPressed(input,"Space")) attack(state);

  // pickups
  for(const it of state.pickups){
    if(it.taken) continue;

    const d = dist(p.x,p.y,it.x,it.y);
    if(d < 20){
      if(it.kind==="key"){
        it.taken = true;
        onKeyCollected();
      }
      if(it.kind==="oxygen"){
        it.taken = true;
        const gain = it.val ?? 20;
        p.oxyTimer = Math.min(p.oxyTimerMax, p.oxyTimer + gain);
        setLog(state, `OXYGEN +${gain|0}s`);
        state.audio?.blip?.(0.6);
      }
      if(it.kind==="perk"){
        it.taken = true;
        state.secretsFound++;
        state.difficulty.oxygenDrain = Math.max(0.85, state.difficulty.oxygenDrain - 0.08);
        state.escalation = Math.max(0, state.escalation - 0.7);
        p.sanity = clamp(p.sanity + 12, 0, p.sanityMax);
        setLog(state, "HIDDEN PERK: QUIETER BREATH.");
        state.audio?.blip?.(0.9);
      }
      if(it.kind==="portal"){
        if(it.locked){
          setLog(state, "PORTAL LOCKED. KEYS REQUIRED.");
          state.audio?.blip?.(0.25);
        } else {
          onPortalEntered();
          return;
        }
      }
    }
  }

  // if peasant “GRIEF” asked for bonus key spawn
  if(state._spawnBonusKey){
    state._spawnBonusKey = false;
    const c = randomFloorCell(state, {x:1,y:1,d:14});
    state.pickups.push({ kind:"key", x:(c.x+0.5)*state.tileSize, y:(c.y+0.5)*state.tileSize, taken:false });
    state.keysTotal += 1; // but keep goal consistent: keysTotal increases too
    ui.hudObj.textContent = `OBJ: COLLECT KEYS (${state.keysFound}/${state.keysTotal})`;
    setLog(state, "A NEW KEY APPEARS.");
  }

  updateEnemies(state, dt);
  updateEffects(state, dt);

  // fear
  let nearest = 9999;
  for(const e of state.entities){
    if(!e.alive || e.kind==="peasant") continue;
    nearest = Math.min(nearest, dist(p.x,p.y,e.x,e.y));
  }
  const fear = clamp(1 - nearest/260, 0, 1);
  state.audio?.setFear?.(fear);

  // death
  if(p.hp <= 0){
    state.running = false;
    alert("CRITICAL FAILURE. SUBJECT TERMINATED.");
    location.reload();
  }

  updateBars(state);
}

/* boot */
requestAnimationFrame(loop);
