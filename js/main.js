import { clamp, dist } from "./utils.js";
import { createAudio } from "./audio.js";
import { render } from "./render.js";
import { createState, generateLevel, setMsg } from "./state.js";
import { tryMoveCircle, makeProjectile } from "./entities.js";
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

// prevent “clicking name input starts game”
["pointerdown","mousedown","click","keydown"].forEach(ev=>{
  nameInput.addEventListener(ev, (e)=> e.stopPropagation());
});

btnStart.addEventListener("click", async () => {
  const name = (nameInput.value || "SUBJECT").trim().slice(0,16);
  const role = roleSelect.value;

  audio = audio || createAudio();
  await audio.resume();

  menu.style.display = "none";
  S.running = true;

  generateLevel(S, name, role);
  uiRole.textContent = `ROLE: ${role.toUpperCase()}`;

  last = performance.now();
  requestAnimationFrame(loop);
});

// Input
window.addEventListener("keydown", (e)=>{
  if (e.repeat) return;
  S.input.down.add(e.code);
  S.input.just.add(e.code);
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
    h.reveal = Math.max(h.reveal, 10);
    setMsg(S, `"I CAN SHOW YOU EVERYTHING, ${h.name}."`, 3.2);
  } else if (effect === "oxy"){
    h.oxy = clamp(h.oxy + 55, 0, h.oxyMax);
    setMsg(S, "OXYGEN TANK — lungs quiet down.", 2.8);
  } else if (effect === "poison"){
    h.poison = Math.max(h.poison, 9);
    setMsg(S, "POISON — the walls begin to melt.", 2.8);
  } else {
    // grief: anxiety + DAMAGE BUFF (trade)
    h.grief = Math.max(h.grief, 10);
    h.griefBuff = Math.max(h.griefBuff, 6);
    h.sanity = Math.max(0, h.sanity - 10);
    setMsg(S, `"GRIEF MAKES YOU STRONG."`, 2.8);
  }
  audio?.blip?.(0.9);
}

function heroShoot(){
  const h = S.hero;
  if (h.atkCd > 0) return;

  const role = h.role;
  const fx = Math.cos(h.facing);
  const fy = Math.sin(h.facing);

  // base damage + grief buff
  const buff = h.griefBuff > 0 ? 1.35 : 1.0;

  if (role === "thief"){
    h.atkCd = 0.16;
    const spd = 11.0;
    const dmg = 12 * buff;
    S.projectiles.push(makeProjectile(h.x + fx*0.55, h.y + fy*0.55, fx*spd, fy*spd, "hero", dmg, 0.55));
    audio?.blip?.(0.4);

  } else if (role === "killer"){
    h.atkCd = 0.22;
    const spd = 13.0;
    const dmg = 16 * buff;
    // slight random spread
    const spread = (Math.random()*0.06 - 0.03);
    const ang = h.facing + spread;
    const vx = Math.cos(ang)*spd;
    const vy = Math.sin(ang)*spd;
    S.projectiles.push(makeProjectile(h.x + Math.cos(ang)*0.6, h.y + Math.sin(ang)*0.6, vx, vy, "hero", dmg, 0.5));
    audio?.blip?.(0.55);

  } else { // butcher
    h.atkCd = 0.35;
    const spd = 9.5;
    const dmg = 22 * buff;
    // shockwave “cleaver air”
    S.projectiles.push(makeProjectile(h.x + fx*0.7, h.y + fy*0.7, fx*spd, fy*spd, "hero", dmg, 0.35));
    audio?.blip?.(0.75);
  }
}

function update(dt){
  S.t++;

  const h = S.hero;
  if (!h) return;

  // message timer
  if (S.msgT > 0) S.msgT -= dt;

  // cooldowns & statuses
  h.atkCd = Math.max(0, h.atkCd - dt);
  h.reveal = Math.max(0, h.reveal - dt);
  h.poison = Math.max(0, h.poison - dt);
  h.grief = Math.max(0, h.grief - dt);
  h.griefBuff = Math.max(0, h.griefBuff - dt);

  // oxygen drain (you MUST be able to lose)
  const sprint = S.input.down.has("ShiftLeft") || S.input.down.has("ShiftRight");
  const baseDrain = (S.difficulty === 1 ? 1.35 : S.difficulty === 2 ? 1.65 : 1.95); // >= ~50–75s baseline
  const drain = baseDrain + (sprint ? 0.95 : 0);
  h.oxy = Math.max(0, h.oxy - drain * dt);

  if (h.oxy <= 0) {
    h.suffocate += dt;
    h.sanity = Math.max(0, h.sanity - 14 * dt);
    if (h.suffocate > 6.0) lose("SUFFOCATION.\n\nThe maze keeps your breath.");
  } else {
    h.suffocate = 0;
    h.sanity = Math.min(120, h.sanity + 3.0 * dt);
  }

  // movement (smooth)
  let mx=0, my=0;
  if (S.input.down.has("KeyW") || S.input.down.has("ArrowUp")) my -= 1;
  if (S.input.down.has("KeyS") || S.input.down.has("ArrowDown")) my += 1;
  if (S.input.down.has("KeyA") || S.input.down.has("ArrowLeft")) mx -= 1;
  if (S.input.down.has("KeyD") || S.input.down.has("ArrowRight")) mx += 1;

  const len = Math.hypot(mx,my) || 1;
  mx/=len; my/=len;

  let spd = h.speed * (sprint ? 1.25 : 1.0);
  if (h.oxy <= 0) spd *= 0.75;

  // face direction
  if (Math.abs(mx)+Math.abs(my) > 0.01) h.facing = Math.atan2(my,mx);

  tryMoveCircle(S.map, h, mx*spd*dt, my*spd*dt);

  // actions
  if (S.input.just.has("Space")) heroShoot();

  if (S.input.just.has("KeyE")) {
    // interact with peasants
    for (const n of S.npcs){
      if (n.used) continue;
      if (dist(n.x,n.y,h.x,h.y) < 1.05) {
        n.used = true;
        applyPeasant(n.effect);
        break;
      }
    }
  }

  // pick keys
  for (const k of S.keysOnMap){
    if (k.taken) continue;
    if (dist(k.x+0.5,k.y+0.5,h.x,h.y) < 0.9){
      k.taken = true;
      S.keysCollected++;
      audio?.blip?.(0.8);
      setMsg(S, `KEY ACQUIRED (${S.keysCollected}/${S.totalKeys}).`, 2.2);
      if (S.keysCollected >= S.totalKeys) {
        S.obj = "OBJ: ENTER PORTAL";
        setMsg(S, `THE PORTAL ACCEPTS ${h.name}.`, 3.0);
      }
    }
  }

  // portal win
  if (S.keysCollected >= S.totalKeys) {
    if (dist(S.portal.x+0.5, S.portal.y+0.5, h.x, h.y) < 1.0) {
      win();
    }
  }

  // update enemies (they DO damage and CAN kill)
  let nearest = 99;
  for (const e of S.enemies) {
    if (!e.alive) continue;

    e.hitCd = Math.max(0, e.hitCd - dt);
    e.stun = Math.max(0, e.stun - dt);

    const d = dist(e.x,e.y,h.x,h.y);
    nearest = Math.min(nearest, d);

    if (e.stun > 0) continue;

    const hear = sprint ? 7.5 : 5.6;
    if (d < hear) {
      // chase with slight lateral wobble (less “blocking”)
      const vx = (h.x - e.x) / Math.max(0.001, d);
      const vy = (h.y - e.y) / Math.max(0.001, d);
      const wob = Math.sin((S.t*0.06) + e.jitter) * 0.22;
      const lx = -vy * wob;
      const ly =  vx * wob;

      let es = e.speed;
      if (d < 1.25) es *= 0.55; // prevents “hard wall” body-block feeling

      tryMoveCircle(S.map, e, (vx+lx)*es*dt, (vy+ly)*es*dt);
    }

    // melee hit
    if (d < 0.85 && e.hitCd <= 0) {
      e.hitCd = 0.65;
      h.hp = Math.max(0, h.hp - e.dmg);
      h.grief = Math.max(h.grief, 6);
      audio?.blip?.(1.0);
      setMsg(S, `IT BITES, ${h.name}.`, 1.8);
      if (h.hp <= 0) lose("VITALS LOST.\n\nYou become part of the floor.");
    }
  }

  // fear-driven audio
  audio?.setFear?.(clamp(1 - nearest/7, 0, 1));

  // projectiles update + collisions
  for (const pr of S.projectiles) {
    if (!pr.alive) continue;

    pr.t += dt;
    pr.life -= dt;
    if (pr.life <= 0) { pr.alive = false; continue; }

    // move
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;

    // wall hit
    if (isWall(S.map, Math.floor(pr.x), Math.floor(pr.y))) {
      pr.alive = false;
      continue;
    }

    if (pr.from === "hero") {
      // hit enemy
      for (const e of S.enemies) {
        if (!e.alive) continue;
        if (dist(pr.x,pr.y,e.x,e.y) < (e.r + pr.r)) {
          e.hp -= pr.dmg;
          e.stun = 0.25;
          pr.alive = false;
          audio?.blip?.(0.45);

          if (e.hp <= 0) {
            e.alive = false;
            // killing increases hallucinations
            h.grief = Math.max(h.grief, 8);
            setMsg(S, "TARGET DOWN. THE AIR IS LOUDER NOW.", 2.4);
          }
          break;
        }
      }
    }
  }

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

