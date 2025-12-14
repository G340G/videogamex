import { clamp, dist, loadImage } from "./utils.js";
import { createAudio } from "./audio.js";
import { render } from "./render.js";
import { createState, generateLevel, setMsg, maybeStartPrompt, maybeStartMission, completeMission } from "./state.js";
import { tryMoveCircle, makeProjectile, spawnGibs } from "./entities.js";
import { isWall } from "./map.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha:false });

const uiLoc = document.getElementById("hud-loc");
const uiObj = document.getElementById("hud-obj");
const uiMsg = document.getElementById("hud-msg");
const uiKeys= document.getElementById("hud-keys");
const uiRole= document.getElementById("hud-role");
const barHP = document.getElementById("bar-hp");
const barOX = document.getElementById("bar-oxy");
const barSA = document.getElementById("bar-san");

const menu = document.getElementById("menu");
const btnStart = document.getElementById("btnStart");
const nameInput = document.getElementById("nameInput");
const roleSelect = document.getElementById("roleSelect");

const S = createState();
let audio = null;

const ASSET_PATHS = {
  face1: "./assets/face1.png",
  face2: "./assets/face2.png",
  player: "./assets/player.png",
  tileset:"./assets/tileset.png",
};

async function loadAssets(){
  const [face1, face2, player, tileset] = await Promise.all([
    loadImage(ASSET_PATHS.face1),
    loadImage(ASSET_PATHS.face2),
    loadImage(ASSET_PATHS.player),
    loadImage(ASSET_PATHS.tileset),
  ]);
  return { face1, face2, player, tileset };
}

let assets = null;

// prevent “clicking name input starts game”
["pointerdown","mousedown","click","keydown"].forEach(ev=>{
  nameInput.addEventListener(ev, (e)=> e.stopPropagation());
  roleSelect.addEventListener(ev, (e)=> e.stopPropagation());
});

btnStart.addEventListener("click", async () => {
  const name = (nameInput.value || "SUBJECT").trim().slice(0,16);
  const role = roleSelect.value;

  // audio MUST start from gesture
  audio = audio || createAudio();
  await audio.resume();

  if (!assets){
    try { assets = await loadAssets(); }
    catch(e){
      console.error(e);
      alert("ASSET LOAD FAILED.\nCheck /assets filenames & case sensitivity.");
      return;
    }
  }

  menu.style.display = "none";
  S.running = true;

  generateLevel(S, name, role);
  S.assets = assets;
  uiRole.textContent = `ROLE: ${role.toUpperCase()}`;

  audio.setTheme(S.theme.key);

  last = performance.now();
  requestAnimationFrame(loop);
});

// Input
window.addEventListener("keydown", (e)=>{
  if (e.repeat) return;
  S.input.down.add(e.code);
  S.input.just.add(e.code);

  // prompt answers
  if (S.prompt.active){
    if (e.code === "Digit1" || e.code === "KeyY") choosePrompt(1);
    if (e.code === "Digit2" || e.code === "KeyN") choosePrompt(2);
  }
}, {passive:true});

window.addEventListener("keyup", (e)=>{
  S.input.down.delete(e.code);
}, {passive:true});

window.addEventListener("blur", ()=>{
  S.input.down.clear();
  S.input.just.clear();
});

function updateHUD(){
  const h = S.hero;
  uiLoc.textContent = S.loc;
  uiObj.textContent = S.obj;
  uiMsg.textContent = S.msgT > 0 ? S.msg : "...";
  uiKeys.textContent = `KEYS: ${S.keysCollected}/${S.totalKeys}`;

  barHP.style.width = `${clamp(h.hp / h.maxHp, 0, 1) * 100}%`;
  barOX.style.width = `${clamp(h.oxy / h.oxyMax, 0, 1) * 100}%`;
  barSA.style.width = `${clamp(h.sanity / 120, 0, 1) * 100}%`;
}

function lose(reason){
  S.running = false;
  alert(reason);
  location.reload();
}

function win(){
  S.running = false;
  alert(`ESCAPED.\n\nNAME: ${S.hero.name}\nROLE: ${S.hero.role.toUpperCase()}\nDIFFICULTY: ${S.difficulty}`);
  location.reload();
}

function applyPeasant(effect){
  const h = S.hero;

  if (effect === "reveal"){
    S.buffs.reveal = Math.max(S.buffs.reveal, 12);
    setMsg(S, `"I CAN SHOW YOU EVERYTHING, ${h.name}."`, 3.2);

  } else if (effect === "oxy"){
    h.oxy = clamp(h.oxy + 55, 0, h.oxyMax);
    setMsg(S, "OXYGEN TANK — lungs quiet down.", 2.8);

  } else if (effect === "poison"){
    S.curses.poison = Math.max(S.curses.poison, 14);
    setMsg(S, "POISON — the walls begin to melt.", 2.8);

  } else if (effect === "compass"){
    S.buffs.compass = Math.max(S.buffs.compass, 12);
    setMsg(S, "COMPASS — you feel the portal’s direction.", 2.8);

  } else if (effect === "calm"){
    S.buffs.calm = Math.max(S.buffs.calm, 12);
    h.sanity = clamp(h.sanity + 20, 0, 120);
    setMsg(S, "CALM — your hands stop shaking.", 2.8);

  } else {
    // grief slow + damage buff
    S.curses.grief = Math.max(S.curses.grief, 12);
    h.griefBuff = Math.max(h.griefBuff, 10);
    h.sanity = Math.max(0, h.sanity - 8);
    setMsg(S, `"GRIEF MAKES YOU STRONG."`, 2.8);
  }

  audio?.blip?.(0.9);
}

function heroShoot(){
  const h = S.hero;
  if (h.atkCd > 0) return;

  const fx = Math.cos(h.facing);
  const fy = Math.sin(h.facing);

  const dmgBuff = (S.buffs.damage > 0 ? 1.35 : 1.0) * (h.griefBuff>0 ? 1.25 : 1.0);

  if (h.role === "thief"){
    h.atkCd = 0.14;
    const spd = 11.6;
    const dmg = 11 * dmgBuff;
    S.projectiles.push(makeProjectile(h.x + fx*0.65, h.y + fy*0.65, fx*spd, fy*spd, "hero", dmg, 0.13));
    audio?.blip?.(0.45);

  } else if (h.role === "killer"){
    h.atkCd = 0.20;
    const spd = 13.0;
    const dmg = 15 * dmgBuff;
    const spread = (Math.random()*0.08 - 0.04);
    const ang = h.facing + spread;
    const vx = Math.cos(ang)*spd;
    const vy = Math.sin(ang)*spd;
    S.projectiles.push(makeProjectile(h.x + Math.cos(ang)*0.70, h.y + Math.sin(ang)*0.70, vx, vy, "hero", dmg, 0.12));
    audio?.blip?.(0.60);

  } else { // butcher
    h.atkCd = 0.32;
    const spd = 9.3;
    const dmg = 22 * dmgBuff;
    S.projectiles.push(makeProjectile(h.x + fx*0.85, h.y + fy*0.85, fx*spd, fy*spd, "hero", dmg, 0.15));
    audio?.blip?.(0.78);
  }
}

function choosePrompt(choice){
  if (!S.prompt.active) return;
  const fn = S.prompt.on;
  S.prompt.active = false;
  if (fn) fn(choice);
  audio?.blip?.(0.95);
}

function update(dt){
  S.t++;
  const h = S.hero;
  if (!h) return;

  // message timer
  if (S.msgT > 0) S.msgT -= dt;

  // prompt timer
  if (S.prompt.active){
    S.prompt.t -= dt;
    if (S.prompt.t <= 0){
      S.prompt.active = false;
      setMsg(S, "NO RESPONSE. THE MAZE DECIDES.", 2.8);
      S.curses.grief = Math.max(S.curses.grief, 8);
    }
  }

  // cooldowns & statuses
  h.atkCd = Math.max(0, h.atkCd - dt);
  h.griefBuff = Math.max(0, h.griefBuff - dt);

  // buffs/curses decay
  for (const k of Object.keys(S.buffs)) S.buffs[k] = Math.max(0, S.buffs[k] - dt);
  for (const k of Object.keys(S.curses)) S.curses[k] = Math.max(0, S.curses[k] - dt);

  // oxygen drain (nerfed + tanks abundant)
  const sprint = S.input.down.has("ShiftLeft") || S.input.down.has("ShiftRight");

  // baseline tuned to be survivable > 60s
  const baseDrain = (S.difficulty === 1 ? 0.85 : S.difficulty === 2 ? 1.05 : 1.25);
  const sprintExtra = (sprint ? 0.80 : 0);

  // calm buff reduces drain
  const calmMul = (S.buffs.calm > 0 ? 0.78 : 1.0);

  const drain = (baseDrain + sprintExtra) * calmMul;

  h.oxy = Math.max(0, h.oxy - drain * dt);

  if (h.oxy <= 0){
    h.suffocate += dt;
    h.sanity = Math.max(0, h.sanity - 12 * dt);
    if (h.suffocate > 6.0) lose("SUFFOCATION.\n\nThe maze keeps your breath.");
  } else {
    h.suffocate = 0;
    h.sanity = Math.min(120, h.sanity + 3.2 * dt);
  }

  // movement (smooth, no corner sticking)
  let mx=0, my=0;
  if (S.input.down.has("KeyW") || S.input.down.has("ArrowUp")) my -= 1;
  if (S.input.down.has("KeyS") || S.input.down.has("ArrowDown")) my += 1;
  if (S.input.down.has("KeyA") || S.input.down.has("ArrowLeft")) mx -= 1;
  if (S.input.down.has("KeyD") || S.input.down.has("ArrowRight")) mx += 1;

  const len = Math.hypot(mx,my) || 1;
  mx/=len; my/=len;

  let spd = h.speed * (sprint ? 1.25 : 1.0);

  // grief curse slows you
  if (S.curses.grief > 0) spd *= 0.78;

  if (h.oxy <= 0) spd *= 0.72;

  if (Math.abs(mx)+Math.abs(my) > 0.01) h.facing = Math.atan2(my,mx);

  tryMoveCircle(S.map, h, mx*spd*dt, my*spd*dt);

  // actions
  if (S.input.just.has("Space")) heroShoot();

  if (S.input.just.has("KeyE")){
    // talk to peasants
    for (const n of S.npcs){
      if (n.used) continue;
      if (dist(n.x,n.y,h.x,h.y) < 1.05){
        n.used = true;
        applyPeasant(n.effect);
        break;
      }
    }
    // activate shrine
    for (const sh of S.shrines){
      if (sh.used) continue;
      if (dist(sh.x,sh.y,h.x,h.y) < 1.1){
        sh.used = true;
        if (sh.kind === "question") {
          maybeStartPrompt(S);
          setMsg(S, "THE SHRINE DEMANDS AN ANSWER.", 2.4);
        } else {
          maybeStartMission(S);
          setMsg(S, "MISSION LOADED.", 2.0);
        }
        audio?.blip?.(1.0);
        break;
      }
    }
  }

  // collect notes (story)
  for (const n of S.notes){
    if (n.taken) continue;
    if (dist(n.x+0.5,n.y+0.5,h.x,h.y) < 0.9){
      n.taken = true;
      setMsg(S, n.text, 4.0);
      audio?.blip?.(0.65);
      // some notes start missions sometimes
      if (!S.mission.active && Math.random() < 0.35) maybeStartMission(S);
    }
  }

  // oxygen tanks pickup
  for (const t of S.tanks){
    if (t.taken) continue;
    if (dist(t.x+0.5,t.y+0.5,h.x,h.y) < 0.9){
      t.taken = true;
      h.oxy = clamp(h.oxy + t.amt, 0, h.oxyMax);
      setMsg(S, `OXYGEN +${t.amt}.`, 2.2);
      audio?.blip?.(0.8);
    }
  }

  // keys pickup
  for (const k of S.keysOnMap){
    if (k.taken) continue;
    if (dist(k.x+0.5,k.y+0.5,h.x,h.y) < 0.9){
      k.taken = true;
      S.keysCollected++;
      audio?.blip?.(0.85);
      setMsg(S, `KEY ACQUIRED (${S.keysCollected}/${S.totalKeys}).`, 2.2);

      // creepy “always different” whisper
      if (Math.random() < 0.55){
        setMsg(S, `THE FILE REWRITES ${h.name}.`, 2.6);
      }

      if (S.keysCollected >= S.totalKeys){
        S.obj = "OBJ: ENTER PORTAL";
        setMsg(S, `THE PORTAL ACCEPTS ${h.name}.`, 3.0);
        S.buffs.compass = Math.max(S.buffs.compass, 10);
      }
    }
  }

  // portal win
  if (S.keysCollected >= S.totalKeys){
    if (dist(S.portal.x+0.5, S.portal.y+0.5, h.x, h.y) < 1.0){
      win();
    }
  }

  // mission update
  if (S.mission.active){
    if (S.mission.type === "still"){
      if (Math.abs(mx)+Math.abs(my) < 0.01){
        S.mission.prog += dt;
        if (S.mission.prog >= S.mission.goal) completeMission(S);
      } else {
        S.mission.prog = Math.max(0, S.mission.prog - dt*1.5);
      }
    }
    if (S.mission.type === "norun"){
      if (sprint){
        S.mission.prog = Math.max(0, S.mission.prog - dt*2.4);
        if (Math.random()<0.02) setMsg(S, "TOO LOUD.", 1.4);
      } else {
        S.mission.prog += dt;
        if (S.mission.prog >= S.mission.goal) completeMission(S);
      }
    }
    if (S.mission.type === "note"){
      // complete when any note taken; we approximate via count
      const taken = S.notes.filter(n=>n.taken).length;
      S.mission.prog = taken > 0 ? 1 : 0;
      if (S.mission.prog >= 1) completeMission(S);
    }
  }

  // enemies update (damage + can kill)
  let nearest = 99;
  for (const e of S.enemies){
    if (!e.alive) continue;

    e.hitCd = Math.max(0, e.hitCd - dt);
    e.stun = Math.max(0, e.stun - dt);

    const d = dist(e.x,e.y,h.x,h.y);
    nearest = Math.min(nearest, d);

    if (e.stun > 0) continue;

    const hear = sprint ? 7.5 : 5.6;
    if (d < hear){
      const vx = (h.x - e.x) / Math.max(0.001, d);
      const vy = (h.y - e.y) / Math.max(0.001, d);
      const wob = Math.sin((S.t*0.06) + e.jitter) * 0.22;
      const lx = -vy * wob;
      const ly =  vx * wob;

      // slow down near hero to avoid “body-block corridors”
      let es = e.speed;
      if (d < 1.25) es *= 0.52;

      tryMoveCircle(S.map, e, (vx+lx)*es*dt, (vy+ly)*es*dt);
    }

    // melee
    if (d < 0.88 && e.hitCd <= 0){
      e.hitCd = 0.65;
      h.hp = Math.max(0, h.hp - e.dmg);
      h.sanity = Math.max(0, h.sanity - 6);

      audio?.blip?.(1.0);
      if (Math.random() < 0.5) setMsg(S, `IT BITES, ${h.name}.`, 1.8);

      if (h.hp <= 0) lose("VITALS LOST.\n\nYou become part of the floor.");
    }
  }

  // fear-driven audio
  audio?.setFear?.(clamp(1 - nearest/7, 0, 1));

  // face flash near enemies
  if ((!S.fx.faceFlash || S.fx.faceFlash.t >= S.fx.faceFlash.dur) && nearest < 2.2 && Math.random() < 0.07){
    S.fx.faceFlash = { t:0, dur:0.55, which: Math.random()<0.5?1:2 };
  }
  if (S.fx.faceFlash) S.fx.faceFlash.t += dt;

  // shock decay
  S.fx.shock = Math.max(0, S.fx.shock - dt*1.3);

  // projectiles update
  for (const pr of S.projectiles){
    if (!pr.alive) continue;
    pr.t += dt;
    pr.life -= dt;
    if (pr.life <= 0){ pr.alive = false; continue; }

    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;

    if (isWall(S.map, Math.floor(pr.x), Math.floor(pr.y))){
      pr.alive = false;
      continue;
    }

    if (pr.from === "hero"){
      for (const e of S.enemies){
        if (!e.alive) continue;
        if (dist(pr.x,pr.y,e.x,e.y) < (e.r + pr.r)){
          e.hp -= pr.dmg;
          e.stun = 0.25;
          pr.alive = false;

          audio?.blip?.(0.5);

          if (e.hp <= 0){
            e.alive = false;

            // SHATTER INTO PIECES
            spawnGibs(S, e.x, e.y, 1.0 + S.difficulty*0.25);

            // killing has consequence: hallucination + grief
            S.curses.poison = Math.max(S.curses.poison, 6);
            S.curses.ghost = Math.max(S.curses.ghost, 5);
            setMsg(S, "TARGET DOWN. SOMETHING FOLLOWS YOU NOW.", 3.0);

            // tiny shock
            S.fx.shock = Math.max(S.fx.shock, 0.9);
          }
          break;
        }
      }
    }
  }

  // gibs update
  for (const g of S.gibs){
    g.life -= dt;
    g.x += g.vx * dt * 0.10;
    g.y += g.vy * dt * 0.10;
    g.vx *= 0.96;
    g.vy *= 0.96;
  }
  S.gibs = S.gibs.filter(g=>g.life > 0);

  // clear just-pressed
  S.input.just.clear();

  updateHUD();
}

let last = performance.now();
function loop(now){
  if (!S.running) return;
  const dt = Math.min(0.033, (now - last)/1000);
  last = now;

  update(dt);
  render(ctx, S);

  requestAnimationFrame(loop);
}


