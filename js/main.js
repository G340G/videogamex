// main.js
import { clamp, dist } from "./utils.js";
import { createAudio } from "./audio.js";
import { render } from "./render.js";
import { createState, generateLevel, setMsg, tickStory, updateHeroAnimHints, onHeroShoot } from "./state.js";
import { tryMoveCircle, makeProjectile } from "./entities.js";
import { isWall } from "./map.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });

const uiLoc  = document.getElementById("hud-loc");
const uiObj  = document.getElementById("hud-obj");
const uiMsg  = document.getElementById("hud-msg");
const uiKeys = document.getElementById("hud-keys");
const uiRole = document.getElementById("hud-role");

const barHP = document.getElementById("bar-hp");
const barOX = document.getElementById("bar-oxy");
const barSA = document.getElementById("bar-san");

const menu = document.getElementById("menu");
const btnStart = document.getElementById("btnStart");
const nameInput = document.getElementById("nameInput");
const roleSelect = document.getElementById("roleSelect");

const S = createState();
let audio = null;

function fitCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const w = Math.max(320, Math.floor(rect.width * dpr));
  const h = Math.max(240, Math.floor(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}
window.addEventListener("resize", fitCanvas);
fitCanvas();

// Prevent “typing name starts game”
["pointerdown","mousedown","click","keydown","keyup"].forEach(ev=>{
  nameInput?.addEventListener(ev, (e)=> e.stopPropagation());
  roleSelect?.addEventListener(ev, (e)=> e.stopPropagation());
});

// -------- INPUT --------
window.addEventListener("keydown", (e)=>{
  if (e.repeat) return;
  S.input.down.add(e.code);
  S.input.just.add(e.code);
}, { passive:true });

window.addEventListener("keyup", (e)=>{
  S.input.down.delete(e.code);
}, { passive:true });

window.addEventListener("blur", ()=>{
  S.input.down.clear();
  S.input.just.clear();
});

// -------- START --------
btnStart.addEventListener("click", async ()=>{
  const name = (nameInput.value || "SUBJECT").trim().slice(0, 16);
  const role = (roleSelect.value || "thief");

  audio = audio || createAudio();
  await audio.resume();

  // Start run
  menu.style.display = "none";
  S.running = true;

  generateLevel(S, name, role);
  uiRole.textContent = `ROLE: ${role.toUpperCase()}`;

  last = performance.now();
  requestAnimationFrame(loop);
});

// -------- HUD --------
function updateHUD(){
  const h = S.hero;
  if (!h) return;

  uiLoc.textContent = S.loc || "LOC: ...";
  uiObj.textContent = S.obj || "OBJ: ...";
  uiMsg.textContent = (S.msgT > 0) ? S.msg : "...";
  uiKeys.textContent = `KEYS: ${S.keysCollected}/${S.totalKeys}`;

  barHP.style.width = `${clamp(h.hp / h.maxHp, 0, 1) * 100}%`;
  barOX.style.width = `${clamp(h.oxy / h.oxyMax, 0, 1) * 100}%`;
  barSA.style.width = `${clamp(h.sanity / 120, 0, 1) * 100}%`;
}

// -------- END STATES --------
function lose(reason){
  S.running = false;
  alert(reason);
  location.reload();
}

function win(){
  S.running = false;
  alert(
    `ESCAPED.\n\nNAME: ${S.hero.name}\nROLE: ${S.hero.role.toUpperCase()}\nDIFFICULTY: ${S.difficulty}\nTHEME: ${S.theme?.name || "UNKNOWN"}`
  );
  location.reload();
}

// -------- PEASANTS --------
function applyPeasant(effect){
  const h = S.hero;

  if (effect === "reveal"){
    h.reveal = Math.max(h.reveal, 12);
    setMsg(S, `"I CAN SHOW YOU EVERYTHING, ${h.name}."`, 3.2);

  } else if (effect === "oxy"){
    h.oxy = clamp(h.oxy + 55, 0, h.oxyMax);
    setMsg(S, "OXYGEN TANK — lungs quiet down.", 2.8);

  } else if (effect === "poison"){
    h.poison = Math.max(h.poison, 10);
    setMsg(S, "POISON — the walls begin to melt.", 2.8);

  } else {
    // grief: anxiety + temporary damage buff (tradeoff)
    h.grief = Math.max(h.grief, 10);
    h.griefBuff = Math.max(h.griefBuff, 7);
    h.sanity = Math.max(0, h.sanity - 12);
    setMsg(S, `"GRIEF MAKES YOU STRONG."`, 2.8);
  }

  audio?.blip?.(0.9);
}

// -------- COMBAT --------
function heroShoot(){
  const h = S.hero;
  if (h.atkCd > 0) return;

  const fx = Math.cos(h.facing);
  const fy = Math.sin(h.facing);

  // grief buff
  const buff = h.griefBuff > 0 ? 1.35 : 1.0;

  if (h.role === "thief"){
    h.atkCd = 0.16;
    const spd = 11.0;
    const dmg = 10 * buff;
    S.projectiles.push(makeProjectile(
      h.x + fx*0.55, h.y + fy*0.55,
      fx*spd, fy*spd,
      "hero", dmg, 0.10
    ));
    audio?.blip?.(0.35);

  } else if (h.role === "killer"){
    h.atkCd = 0.22;
    const spd = 12.5;
    const dmg = 14 * buff;
    const spread = (Math.random()*0.08 - 0.04);
    const ang = h.facing + spread;
    const vx = Math.cos(ang)*spd;
    const vy = Math.sin(ang)*spd;

    S.projectiles.push(makeProjectile(
      h.x + Math.cos(ang)*0.58, h.y + Math.sin(ang)*0.58,
      vx, vy,
      "hero", dmg, 0.10
    ));
    audio?.blip?.(0.55);

  } else { // butcher
    h.atkCd = 0.34;
    const spd = 9.5;
    const dmg = 20 * buff;
    S.projectiles.push(makeProjectile(
      h.x + fx*0.70, h.y + fy*0.70,
      fx*spd, fy*spd,
      "hero", dmg, 0.12
    ));
    audio?.blip?.(0.75);
  }

  onHeroShoot(h);
}

// -------- UPDATE LOOP --------
function update(dt){
  S.t++;

  const h = S.hero;
  if (!h || !S.map) return;

  // timers
  if (S.msgT > 0) S.msgT -= dt;

  h.atkCd = Math.max(0, h.atkCd - dt);
  h.reveal = Math.max(0, h.reveal - dt);
  h.poison = Math.max(0, h.poison - dt);
  h.grief = Math.max(0, h.grief - dt);
  h.griefBuff = Math.max(0, h.griefBuff - dt);
  h.shootFlash = Math.max(0, h.shootFlash - dt);

  // story tick (may open prompts)
  tickStory(S);

  // handle prompt answers (1/2) + timeout
  if (S.prompt){
    S.prompt.t -= dt;

    if (S.input.just.has("Digit1")){
      S.prompt.effect(S, 1);
      audio?.blip?.(0.8);
      S.prompt = null;
    } else if (S.input.just.has("Digit2")){
      S.prompt.effect(S, 2);
      audio?.blip?.(0.8);
      S.prompt = null;
    } else if (S.prompt.t <= 0){
      setMsg(S, "NO RESPONSE. THE MAZE MARKS YOU.", 2.2);
      h.sanity = Math.max(0, h.sanity - 10);
      S.prompt = null;
    }
  }

  // movement input
  let mx = 0, my = 0;
  if (S.input.down.has("KeyW") || S.input.down.has("ArrowUp")) my -= 1;
  if (S.input.down.has("KeyS") || S.input.down.has("ArrowDown")) my += 1;
  if (S.input.down.has("KeyA") || S.input.down.has("ArrowLeft")) mx -= 1;
  if (S.input.down.has("KeyD") || S.input.down.has("ArrowRight")) mx += 1;

  const len = Math.hypot(mx, my) || 1;
  mx /= len; my /= len;

  const sprint = S.input.down.has("ShiftLeft") || S.input.down.has("ShiftRight");

  // oxygen drain tuned so baseline lasts > 60 seconds
  // (100 oxy / ~1.05-1.35 drain per second = 74–95s baseline)
  const baseDrain = h.oxyDrain || 1.2;
  const drain = baseDrain + (sprint ? 0.70 : 0);
  h.oxy = Math.max(0, h.oxy - drain * dt);

  if (h.oxy <= 0){
    h.suffocate += dt;
    h.sanity = Math.max(0, h.sanity - 10 * dt);
    if (h.suffocate > 6.0){
      lose("SUFFOCATION.\n\nThe maze keeps your breath.");
      return;
    }
  } else {
    h.suffocate = 0;
    h.sanity = Math.min(120, h.sanity + 2.5 * dt);
  }

  // speed
  let spd = h.speed * (sprint ? 1.20 : 1.0);
  if (h.oxy <= 0) spd *= 0.78;

  // update facing + animation hints
  updateHeroAnimHints(h, mx, my);

  // move with circle collision (prevents corner sticking)
  if (Math.abs(mx) + Math.abs(my) > 0.001){
    tryMoveCircle(S.map, h, mx * spd * dt, my * spd * dt);
  }

  // actions
  if (S.input.just.has("Space")) heroShoot();

  // interact (E) with peasants / notes
  if (S.input.just.has("KeyE")){
    // peasants
    for (const n of S.npcs){
      if (!n || n.used) continue;
      if (dist(n.x, n.y, h.x, h.y) < 1.05){
        n.used = true;
        applyPeasant(n.effect);
        break;
      }
    }
  }

  // pickups: oxygen tanks
  for (const t of S.tanks){
    if (!t || t.taken) continue;
    if (dist(t.x, t.y, h.x, h.y) < 0.85){
      t.taken = true;
      h.oxy = clamp(h.oxy + (t.amt || 45), 0, h.oxyMax);
      audio?.blip?.(0.5);
      setMsg(S, `OXYGEN +${t.amt || 45}.`, 1.8);
    }
  }

  // pickups: notes (lore)
  for (const n of S.notes){
    if (!n || n.taken) continue;
    if (dist(n.x, n.y, h.x, h.y) < 0.85){
      n.taken = true;
      audio?.blip?.(0.35);
      setMsg(S, n.text, 4.0);
      // small sanity perturbation
      h.sanity = clamp(h.sanity + (Math.random()<0.55 ? 4 : -4), 0, 120);
    }
  }

  // pickups: keys
  for (const k of S.keysOnMap){
    if (!k || k.taken) continue;
    if (dist(k.x + 0.5, k.y + 0.5, h.x, h.y) < 0.90){
      k.taken = true;
      S.keysCollected++;
      audio?.blip?.(0.8);

      setMsg(S, `KEY ACQUIRED (${S.keysCollected}/${S.totalKeys}).`, 2.2);

      if (S.keysCollected >= S.totalKeys){
        S.obj = "OBJ: ENTER PORTAL";
        setMsg(S, `THE PORTAL ACCEPTS ${h.name}.`, 3.0);
      }
    }
  }

  // win condition: portal
  if (S.keysCollected >= S.totalKeys && S.portal){
    if (dist(S.portal.x + 0.5, S.portal.y + 0.5, h.x, h.y) < 1.0){
      win();
      return;
    }
  }

  // enemies update (they damage + can kill)
  let nearest = 99;

  for (const e of S.enemies){
    if (!e || !e.alive) continue;

    e.hitCd = Math.max(0, e.hitCd - dt);
    e.stun  = Math.max(0, e.stun  - dt);

    const d = dist(e.x, e.y, h.x, h.y);
    nearest = Math.min(nearest, d);

    if (e.stun > 0) continue;

    const hear = sprint ? 7.2 : 5.6;

    if (d < hear){
      // chase with lateral wobble to reduce body-block feel
      const vx = (h.x - e.x) / Math.max(0.001, d);
      const vy = (h.y - e.y) / Math.max(0.001, d);

      const wob = Math.sin((S.t * 0.06) + (e.jitter || 0)) * 0.20;
      const lx = -vy * wob;
      const ly =  vx * wob;

      let es = e.speed || 2.4;
      if (d < 1.25) es *= 0.55;

      tryMoveCircle(S.map, e, (vx + lx) * es * dt, (vy + ly) * es * dt);
    }

    // melee hit
    if (d < 0.85 && e.hitCd <= 0){
      e.hitCd = 0.70;

      h.hp = Math.max(0, h.hp - (e.dmg || 10));
      h.grief = Math.max(h.grief, 6);

      audio?.blip?.(1.0);
      setMsg(S, `IT BITES, ${h.name}.`, 1.6);

      if (h.hp <= 0){
        lose("VITALS LOST.\n\nYou become part of the floor.");
        return;
      }
    }
  }

  // audio fear control
  audio?.setFear?.(clamp(1 - nearest/7, 0, 1));

  // projectiles update + collisions
  for (const pr of S.projectiles){
    if (!pr || !pr.alive) continue;

    pr.t += dt;
    pr.life -= dt;
    if (pr.life <= 0){
      pr.alive = false;
      continue;
    }

    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;

    // wall collision
    if (isWall(S.map, Math.floor(pr.x), Math.floor(pr.y))){
      pr.alive = false;
      continue;
    }

    if (pr.from === "hero"){
      // hit enemy
      for (const e of S.enemies){
        if (!e || !e.alive) continue;
        if (dist(pr.x, pr.y, e.x, e.y) < ((e.r || 0.32) + (pr.r || 0.10))){
          e.hp -= (pr.dmg || 10);
          e.stun = 0.22;
          pr.alive = false;
          audio?.blip?.(0.4);

          if (e.hp <= 0){
            e.alive = false;

            // mild “kill hallucination” effect
            h.grief = Math.max(h.grief, 8);
            h.sanity = Math.max(0, h.sanity - 6);

            setMsg(S, "TARGET DOWN. THE AIR IS LOUDER NOW.", 2.4);
          }
          break;
        }
      }
    }
  }

  // cleanup: clear just-pressed
  S.input.just.clear();

  // update HUD
  updateHUD();
}

// -------- LOOP --------
let last = performance.now();
function loop(now){
  if (!S.running) return;

  fitCanvas();

  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  update(dt);
  render(ctx, S);

  requestAnimationFrame(loop);
}



