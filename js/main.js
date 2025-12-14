import { createState, configureRun, setTheme, personalizeText, setLog, updateBars } from "./state.js";
import { createInput, bindInput, key, wasPressed, clearFrame } from "./input.js";
import { generateBraidedMaze, randomFloorCell, themeLore } from "./map.js";
import { createRenderer, render } from "./render.js";
import { spawnPlayer, spawnEnemy, moveWithCollision, updateEnemies } from "./entities.js";
import { setupCombatByRole, attack, updateBullets } from "./combat.js";
import { updateEffects, spawnFaceFlash } from "./hallucinations.js";
import { generatePuzzle, canOpenTerminal, tryUnlock } from "./puzzles.js";
import { createAudio } from "./audio.js";
import { clamp, dist, pick } from "./utils.js";

/* ========= DOM HOOKS ========= */
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
  diffPreview: document.getElementById("diffPreview"),
  introLore: document.getElementById("introLore"),
  btnStart: document.getElementById("btnStart"),
  btnMute: document.getElementById("btnMute"),

  terminal: document.getElementById("terminal"),
  d1: document.getElementById("d1"),
  d2: document.getElementById("d2"),
  d3: document.getElementById("d3"),
  btnExec: document.getElementById("btnExec"),
  btnAbort: document.getElementById("btnAbort"),
  termHint: document.getElementById("termHint"),

  prompt: document.getElementById("prompt"),
  promptText: document.getElementById("promptText"),
  promptA: document.getElementById("promptA"),
  promptB: document.getElementById("promptB"),
  promptBar: document.getElementById("promptBar"),

  flash: document.getElementById("flash"),
};

/* ========= STATE / INPUT / RENDERER ========= */
const state = createState();
state.ui = ui;
const input = createInput();
bindInput(input, canvas);
const R = createRenderer(canvas);

/* ========= MENU BEHAVIOR ========= */
ui.btnMute.addEventListener("click", ()=>{
  state.muted = !state.muted;
  ui.btnMute.textContent = state.muted ? "AUDIO: OFF" : "AUDIO: ON";
  if (state.audio && state.muted) state.audio.ac.suspend().catch(()=>{});
  if (state.audio && !state.muted) state.audio.resume().catch(()=>{});
});

// IMPORTANT: Clicking name input must NOT start the game.
// We start ONLY on pressing the “INITIALIZE RUN” button.
ui.btnStart.addEventListener("click", async ()=>{
  const name = ui.nameInput.value;
  const role = ui.roleSelect.value;

  configureRun(state, {name, role});
  setTheme(state);

  // audio unlock on user gesture
  state.audio = createAudio(state);
  if (!state.muted) await state.audio.resume();

  ui.menu.classList.add("hidden");
  startRun();
});

ui.roleSelect.addEventListener("change", ()=> previewLore());
ui.nameInput.addEventListener("input", ()=> previewLore());

function previewLore(){
  // lightweight preview without starting
  const tmpName = ui.nameInput.value || "SUBJECT";
  const tmpRole = ui.roleSelect.value;
  state.name = tmpName.toUpperCase().slice(0,16);
  state.role = tmpRole;

  // show random-ish, without committing seed
  ui.introLore.textContent = "…";
}

/* ========= TERMINAL ========= */
ui.btnAbort.addEventListener("click", ()=>{
  closeTerminal();
});
ui.btnExec.addEventListener("click", ()=>{
  const guess = `${ui.d1.value||""}${ui.d2.value||""}${ui.d3.value||""}`;
  const ok = tryUnlock(state, guess);
  if(ok){
    closeTerminal();
    unlockExit();
  }else{
    ui.terminal.querySelector(".panel").style.filter = "brightness(1.3)";
    setTimeout(()=> ui.terminal.querySelector(".panel").style.filter="", 120);
  }
});
for (const el of [ui.d1,ui.d2,ui.d3]){
  el.addEventListener("input", ()=>{
    el.value = (el.value||"").replace(/[^0-9]/g,"").slice(0,1);
  });
}

/* ========= PROMPT ========= */
function showPrompt(p){
  if (state.prompt.active) return;
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
  state.audio?.blip?.(0.9);
  if (fn) fn(choice);
}

/* ========= RUN SETUP ========= */
function startRun(){
  state.running = true;
  state.paused = false;
  state.level = 1;
  state.entities.length = 0;
  state.pickups.length = 0;
  state.decals.length = 0;
  state.effects.length = 0;
  state.bullets.length = 0;

  setupCombatByRole(state);
  buildLevel();
  setLog(state, personalizeText(state, "RUN STARTED: {NAME}."));
}

function buildLevel(){
  state.entities.length = 0;
  state.pickups.length = 0;
  state.decals.length = 0;
  state.bullets.length = 0;
  state.effects.length = 0;

  setTheme(state);
  generateBraidedMaze(state, 31, 21);

  spawnPlayer(state);

  // puzzle/terminal
  generatePuzzle(state);

  // exit pickup (locked until mission + terminal)
  const exitCell = randomFloorCell(state, {x:1,y:1,d:22});
  state.pickups.push({
    kind:"exit",
    x:(exitCell.x+0.5)*state.tileSize,
    y:(exitCell.y+0.5)*state.tileSize,
    locked:true,
    taken:false
  });

  // chests: unlock missions
  const chestCount = 3;
  for(let i=0;i<chestCount;i++){
    const c = randomFloorCell(state, {x:1,y:1,d:8+i*2});
    state.pickups.push({ kind:"chest", x:(c.x+0.5)*state.tileSize, y:(c.y+0.5)*state.tileSize, taken:false });
  }

  // oxygen tanks (baseline ≥ 60s, tanks make it generous)
  const tankCount = (state.role==="butcher" ? 4 : 3);
  for(let i=0;i<tankCount;i++){
    const c = randomFloorCell(state, {x:1,y:1,d:10+i});
    state.pickups.push({ kind:"oxygen", x:(c.x+0.5)*state.tileSize, y:(c.y+0.5)*state.tileSize, taken:false, val: 18 + (state.r()*10|0) });
  }

  // ammo for thief (ranged)
  if (state.player.ranged){
    const ammoCount = 4 + state.difficulty.spawnExtra;
    for(let i=0;i<ammoCount;i++){
      const c = randomFloorCell(state, {x:1,y:1,d:10+i});
      state.pickups.push({ kind:"ammo", x:(c.x+0.5)*state.tileSize, y:(c.y+0.5)*state.tileSize, taken:false, val: 4 + (state.r()*4|0) });
    }
  }

  // secret perk (optional)
  if (state.r() < 0.55){
    const c = randomFloorCell(state, {x:1,y:1,d:16});
    state.pickups.push({ kind:"perk", x:(c.x+0.5)*state.tileSize, y:(c.y+0.5)*state.tileSize, taken:false });
  }

  // enemies (increasing difficulty)
  const baseEnemies = 2 + state.level + state.difficulty.spawnExtra;
  for(let i=0;i<baseEnemies;i++){
    const far = randomFloorCell(state, {x:1,y:1,d:18});
    spawnEnemy(state, "stalker", far);
  }

  // HUD
  ui.hudLoc.textContent = `LOC: ${state.theme.name}`;
  ui.hudObj.textContent = "OBJ: FIND THE CODE + OPEN TERMINAL";
  ui.hudMission.textContent = `— ${state.theme.perk}`;
  ui.diffPreview.textContent = `DIFF: ${state.difficulty.label} · enemies x${state.difficulty.enemyMult.toFixed(2)} · oxygen drain x${state.difficulty.oxygenDrain.toFixed(2)}`;

  // intro lore line
  ui.introLore.textContent = personalizeText(state, themeLore(state));

  // reset mission
  state.mission.active = false;
  state.mission.completed = false;

  updateBars(state);
}

/* ========= MISSIONS ========= */
const MISSION_POOL = [
  {
    type:"STILL",
    title:"STILLNESS RITE",
    desc:"Stand completely still for {S}s near the code decal.",
    build:(state)=>({ S:(2.0 + state.r()*2.0) })
  },
  {
    type:"NO_SPRINT",
    title:"SILENT WALK",
    desc:"Survive {S}s without sprinting (Shift forbidden).",
    build:(state)=>({ S:(10 + (state.r()*12|0)) })
  },
  {
    type:"ECHO",
    title:"ECHO COUNT",
    desc:"Use E (pulse) exactly {N} times.",
    build:(state)=>({ N:(2 + (state.r()*3|0)), used:0 })
  }
];

function startMission(){
  const m = pick(state.r, MISSION_POOL);
  const data = m.build(state);

  state.mission.active = true;
  state.mission.completed = false;
  state.mission.type = m.type;
  state.mission.title = personalizeText(state, m.title);
  state.mission.desc = personalizeText(state, m.desc)
    .replace("{S}", (data.S??0).toFixed(1))
    .replace("{N}", (data.N??0));
  state.mission.goal = data.S ?? data.N ?? 1;
  state.mission.progress = 0;
  state.mission.data = data;

  ui.hudObj.textContent = `OBJ: ${state.mission.title}`;
  ui.hudMission.textContent = state.mission.desc;

  setLog(state, "MISSION UNSEALED.");
  state.audio?.blip?.(1.0);
}

function completeMission(){
  state.mission.active = false;
  state.mission.completed = true;
  setLog(state, "TASK COMPLETE. EXIT WEAKENED.");
  ui.hudObj.textContent = "OBJ: UNLOCK EXIT (TERMINAL)";

  // reduce immediate heat
  state.player.sanity = clamp(state.player.sanity + 8, 0, state.player.sanityMax);
}

/* ========= EXIT UNLOCK ========= */
function unlockExit(){
  // must have mission completed (or none started yet? you asked: chests unlock missions; mission needed)
  // We enforce: need mission completed + terminal solved.
  const can = state.puzzle.solved && state.mission.completed;
  if(!can){
    setLog(state, "EXIT RESISTS. COMPLETE THE TASK.");
    return;
  }
  const ex = state.pickups.find(p=>p.kind==="exit");
  if(ex) ex.locked = false;
  setLog(state, "EXIT UNSEALED.");
}

/* ========= PICKUPS / INTERACT ========= */
function interact(){
  if(state.paused) return;

  // terminal
  if(canOpenTerminal(state)){
    openTerminal();
    return;
  }

  // “pulse” / echo
  if(state.mission.active && state.mission.type==="ECHO"){
    state.mission.data.used++;
    if(state.mission.data.used > state.mission.data.N){
      // overflow resets progress
      state.mission.data.used = 0;
      setLog(state, "ECHO OVERFLOW. TRY AGAIN.");
      state.escalation += 0.6;
      state.audio?.corrupt?.();
    }
  }
  state.audio?.blip?.(0.9);
  setLog(state, "PULSE SENT.");
}

/* ========= TERMINAL OPEN/CLOSE ========= */
function openTerminal(){
  state.paused = true;
  ui.terminal.classList.remove("hidden");
  ui.termHint.textContent = state.puzzle.lies
    ? "Note: the facility sometimes lies in red."
    : "Note: the code is printed somewhere in the corridors.";
  ui.d1.value=""; ui.d2.value=""; ui.d3.value="";
  ui.d1.focus();
}
function closeTerminal(){
  ui.terminal.classList.add("hidden");
  state.paused = false;
}

/* ========= PROMPTS (lore choices) ========= */
const PROMPTS = [
  {
    text:`A speaker hisses: "{NAME}, do you want to be seen?"`,
    a:`1) YES (clarity, more enemies)`,
    b:`2) NO (safer, less oxygen)`,
    choose:(c)=>{
      if(c===1){
        state.player.sanity = clamp(state.player.sanity + 10, 0, state.player.sanityMax);
        state.enemySpawnRate += 0.25;
        setLog(state, "YOU ARE VISIBLE.");
      }else{
        state.player.oxyTimer = Math.max(0, state.player.oxyTimer - 10);
        state.escalation = Math.max(0, state.escalation - 0.4);
        setLog(state, "YOU ARE MISSING.");
      }
    }
  },
  {
    text:`A red terminal whispers: "CONFESS, {ROLE}."`,
    a:`1) CONFESS (heal, hallucinate)`,
    b:`2) LIE (ammo/tank, corruption)`,
    choose:(c)=>{
      if(c===1){
        state.player.hp = clamp(state.player.hp + 18, 0, state.player.hpMax);
        state.effects.push({type:"WALL_BREATH", t:0, dur:2.0, intensity:1});
        spawnFaceFlash(state);
        setLog(state, "CONFESSION ACCEPTED.");
      }else{
        // reward + penalty
        if(state.player.ranged) state.player.ammo += 4;
        else state.player.oxyTimer = Math.min(state.player.oxyTimerMax, state.player.oxyTimer + 8);
        state.audio?.corrupt?.();
        state.escalation += 0.9;
        setLog(state, "LIE RECORDED.");
      }
    }
  }
];

/* ========= GAME LOOP (fixed timestep for smoothness) ========= */
let last = performance.now();
let acc = 0;
const STEP = 1/60;

function loop(t){
  requestAnimationFrame(loop);
  const now = t || performance.now();
  let frame = (now - last) / 1000;
  last = now;
  frame = Math.min(frame, 0.05);
  acc += frame;

  // audio tick (even if paused, faint ambience)
  if(state.audio && !state.muted) state.audio.tickMusic(state);

  while(acc >= STEP){
    state.dt = STEP;
    update(STEP);
    acc -= STEP;
  }

  render(state, R);
  clearFrame(input);
}

/* ========= UPDATE ========= */
function update(dt){
  if(!state.running) return;

  // menu closed => game running. Paused blocks logic except prompt timers.
  if(state.prompt.active){
    state.prompt.timer -= dt;
    ui.promptBar.style.width = `${clamp((state.prompt.timer/7.0)*100, 0, 100)}%`;
    if(state.prompt.timer <= 0){
      state.prompt.active = false;
      ui.prompt.classList.add("hidden");
      setLog(state, "NO RESPONSE. THE PLACE DECIDES.");
      state.escalation += 0.5;
    }
  }
  if(state.paused) return;

  state.t++;

  // cooldowns
  const p = state.player;
  p.cooldown = Math.max(0, p.cooldown - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.invuln = Math.max(0, p.invuln - dt);

  // oxygen system: >=60s baseline, drain depends on sprint + difficulty + escalation
  const sprinting = key(input, "ShiftLeft") || key(input, "ShiftRight");
  p._sprinting = sprinting;

  const drain = (sprinting ? 1.55 : 1.0) * state.difficulty.oxygenDrain * (1 + state.escalation*0.02);
  p.oxyTimer = Math.max(0, p.oxyTimer - dt*drain);

  // convert timer to bar %
  p.oxy = (p.oxyTimer / p.oxyTimerMax) * 100;

  // if oxygen empty => hp drains slowly (not instant)
  if(p.oxyTimer <= 0){
    p.hp -= dt * (6 + state.escalation*0.8);
    p.sanity = clamp(p.sanity - dt*3, 0, p.sanityMax);
    if(Math.random()<0.02) state.audio?.corrupt?.();
  }

  // movement input (smooth velocity, normalized)
  let mx = 0, my = 0;
  if(key(input,"KeyW")||key(input,"ArrowUp")) my -= 1;
  if(key(input,"KeyS")||key(input,"ArrowDown")) my += 1;
  if(key(input,"KeyA")||key(input,"ArrowLeft")) mx -= 1;
  if(key(input,"KeyD")||key(input,"ArrowRight")) mx += 1;

  const mag = Math.hypot(mx,my) || 1;
  mx /= mag; my /= mag;

  const base = p.speed * (sprinting ? p.sprint : 1.0);
  const accel = 18.0;
  const friction = 10.5;

  // facing toward mouse
  const camX = p.x - canvas.width/2;
  const camY = p.y - canvas.height/2;
  const fx = (input.mouseX + camX) - p.x;
  const fy = (input.mouseY + camY) - p.y;
  p.facing = Math.atan2(fy, fx);

  // desired vel
  const dvx = mx * base;
  const dvy = my * base;

  // accelerate
  p.vx += (dvx - p.vx) * clamp(accel*dt, 0, 1);
  p.vy += (dvy - p.vy) * clamp(accel*dt, 0, 1);

  // friction when no input
  if(mx===0 && my===0){
    p.vx *= Math.max(0, 1 - friction*dt);
    p.vy *= Math.max(0, 1 - friction*dt);
  }

  // dash (thief)
  if(state.role==="thief" && wasPressed(input,"Space") && p.dashCd<=0 && p.cooldown<=0){
    // if ranged thief: Space attacks; dash on Shift+Space
    // keep it simple: dash on Shift+E? No. We'll do Shift+Space dash.
  }
  if(state.role==="thief" && wasPressed(input,"Space") && sprinting && p.dashCd<=0){
    p.dashCd = 1.2;
    p.invuln = 0.18;
    const k = 520;
    p.vx += Math.cos(p.facing)*k;
    p.vy += Math.sin(p.facing)*k;
    setLog(state, "DASH.");
    state.audio?.blip?.(0.55);
  }

  // move with robust collision (prevents corner attachment)
  moveWithCollision(state, p, dt);

  // interactions
  if(wasPressed(input,"KeyE")) interact();

  // attack
  if(wasPressed(input,"Space")) attack(state);

  // mission updates
  if(state.mission.active){
    if(state.mission.type==="STILL"){
      // stand near code decal
      const code = state.decals.find(d=>d.type==="code");
      const near = code && dist(p.x,p.y, code.x,code.y) < 80;
      const moving = Math.hypot(p.vx,p.vy) > 10;
      if(near && !moving) state.mission.progress += dt;
      else state.mission.progress = Math.max(0, state.mission.progress - dt*0.6);

      if(state.mission.progress >= state.mission.data.S){
        completeMission();
      }
    }
    if(state.mission.type==="NO_SPRINT"){
      if(sprinting){
        state.mission.progress = Math.max(0, state.mission.progress - dt*2.0);
      }else{
        state.mission.progress += dt;
      }
      if(state.mission.progress >= state.mission.data.S){
        completeMission();
      }
    }
    if(state.mission.type==="ECHO"){
      state.mission.progress = state.mission.data.used;
      if(state.mission.progress >= state.mission.data.N){
        completeMission();
      }
    }
  }

  // pickups collisions
  for(const it of state.pickups){
    if(it.taken) continue;
    const d = dist(p.x,p.y, it.x,it.y);
    if(d < 22){
      if(it.kind==="chest"){
        it.taken = true;
        setLog(state, "CHEST OPENED.");
        state.audio?.blip?.(1.0);

        if(!state.mission.active && !state.mission.completed){
          startMission();
        }else{
          // lore prompt sometimes
          if(state.r() < 0.55){
            const pr = pick(state.r, PROMPTS);
            showPrompt(pr);
          }
        }

        // creepy flash
        if(state.r() < 0.65) spawnFaceFlash(state);
      }

      if(it.kind==="oxygen"){
        it.taken = true;
        const gain = it.val ?? 20;
        p.oxyTimer = Math.min(p.oxyTimerMax, p.oxyTimer + gain);
        setLog(state, `OXYGEN TANK +${gain|0}s`);
        state.audio?.blip?.(0.7);
      }

      if(it.kind==="ammo"){
        it.taken = true;
        p.ammo += it.val ?? 4;
        setLog(state, `AMMO +${it.val ?? 4}`);
        state.audio?.blip?.(0.6);
      }

      if(it.kind==="perk"){
        it.taken = true;
        state.secretsFound++;
        // hidden perk: reduce oxygen drain and slightly slow escalation
        state.difficulty.oxygenDrain = Math.max(0.85, state.difficulty.oxygenDrain - 0.08);
        state.escalation = Math.max(0, state.escalation - 0.6);
        p.sanity = clamp(p.sanity + 12, 0, p.sanityMax);
        setLog(state, "HIDDEN PERK: YOUR BREATH IS LESS LOUD.");
        state.audio?.blip?.(0.9);
      }

      if(it.kind==="exit"){
        if(it.locked){
          setLog(state, "EXIT LOCKED.");
          state.audio?.blip?.(0.4);
        }else{
          // win level -> next
          state.level++;
          setLog(state, "SEQUENCE COMPLETE. DESCENDING…");
          state.audio?.blip?.(1.0);

          // increase difficulty progressively
          state.difficulty.enemyMult += 0.06;
          state.difficulty.oxygenDrain += 0.04;

          buildLevel();
          return;
        }
      }
    }
  }

  // bullets
  updateBullets(state, dt);

  // enemies
  updateEnemies(state, dt);

  // fear audio based on nearest enemy
  let nearest = 9999;
  for(const e of state.entities){
    if(!e.alive) continue;
    nearest = Math.min(nearest, dist(p.x,p.y,e.x,e.y));
  }
  const fear = clamp(1 - nearest/260, 0, 1);
  state.audio?.setFear?.(fear);

  // spawn extra enemies over time as escalation rises (but keep escapable)
  if(state.r() < (0.002 + state.enemySpawnRate*0.0005)){
    const far = randomFloorCell(state, {x:(p.x/state.tileSize)|0, y:(p.y/state.tileSize)|0, d:18});
    spawnEnemy(state, "stalker", far);
    setLog(state, "SOMETHING ENTERED THE GRID.");
  }

  // effects timers
  updateEffects(state, dt);

  // prompt input
  if(state.prompt.active){
    if(wasPressed(input,"Digit1") || wasPressed(input,"KeyY")) choosePrompt(1);
    if(wasPressed(input,"Digit2") || wasPressed(input,"KeyN")) choosePrompt(2);
  }

  // terminal unlocking check: if solved + mission completed => unlock exit
  if(state.puzzle.solved && state.mission.completed){
    const ex = state.pickups.find(p=>p.kind==="exit");
    if(ex) ex.locked = false;
  }

  // death
  if(p.hp <= 0){
    state.running = false;
    alert("CRITICAL FAILURE. SUBJECT TERMINATED.");
    location.reload();
  }

  updateBars(state);
}

/* ========= FLASH EFFECT (DOM) ========= */
function updateFlashDOM(){
  // driven by effects of type FACE_FLASH
  const fx = state.effects.find(e=>e.type==="FACE_FLASH");
  if(!fx){
    ui.flash.classList.add("hidden");
    ui.flash.style.opacity = "0";
    ui.flash.style.background = "";
    return;
  }

  // generate procedural creepy face gradients (cheap + distorted)
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

/* ========= HOOK RENDER TO FLASH DOM ========= */
const _origRender = render;
function renderHooked(state, R){
  _origRender(state, R);
  updateFlashDOM();
}
render = renderHooked; // eslint-disable-line no-func-assign

/* ========= START ========= */
ui.diffPreview.textContent = "DIFF: (randomized when you start)";
ui.introLore.textContent = "Type a name. Choose a role. Initialize.";
previewLore();
requestAnimationFrame(loop);

