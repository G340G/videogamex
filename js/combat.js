import { clamp, dist } from "./utils.js";

export function setupCombatByRole(state){
  const p = state.player;
  p.cooldown = 0;

  if(state.role === "thief"){
    p.ranged = false;
  } else if(state.role === "killer"){
    p.ranged = false;
  } else { // butcher
    p.ranged = false;
  }
}

export function attack(state){
  const p = state.player;
  if(p.cooldown > 0) return;

  // role-based attacks (effective but not OP)
  let range = 38;
  let dmg = 22;
  let cd  = 0.32;
  let cleave = 0.45;

  if(state.role === "thief"){
    range = 34; dmg = 18; cd = 0.25; cleave = 0.30;
  }
  if(state.role === "killer"){
    range = 40; dmg = 22; cd = 0.22; cleave = 0.55;
  }
  if(state.role === "butcher"){
    range = 48; dmg = 30; cd = 0.48; cleave = 0.80;
  }

  p.cooldown = cd;

  // hit enemies in front cone
  const ax = p.x + Math.cos(p.facing)*18;
  const ay = p.y + Math.sin(p.facing)*18;

  for(const e of state.entities){
    if(!e.alive) continue;
    if(e.kind==="peasant") continue;

    const d = dist(ax,ay,e.x,e.y);
    if(d > range) continue;

    // simple “cone” check
    const vx = e.x - p.x;
    const vy = e.y - p.y;
    const ang = Math.atan2(vy,vx);
    let da = Math.abs(ang - p.facing);
    da = Math.min(da, Math.PI*2 - da);

    if(da < cleave){
      e.hp -= dmg;
      state.audio?.hit?.(0.6);
      state.effects.push({type:"SLASH", t:0, dur:0.12, intensity:1});

      if(e.hp <= 0){
        e.alive = false;
        state.escalation += 0.6;
        // killing causes hallucinations
        state.effects.push({type:"GRIEF", t:0, dur:1.3, intensity:0.8});
      }
    }
  }

  // tiny sanity cost for violence (keeps it tense)
  p.sanity = clamp(p.sanity - 0.6, 0, p.sanityMax);
}

export function updateBullets(){ /* not used in this build */ }
