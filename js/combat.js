import { clamp, dist } from "./utils.js";
import { moveWithCollision } from "./entities.js";
import { triggerHallucination, spawnFaceFlash } from "./hallucinations.js";

export function setupCombatByRole(state){
  const p = state.player;
  if (state.role === "thief"){
    p.ranged = true;
    p.ammo = 8;
    p.damage = 16;
  } else if (state.role === "killer"){
    p.ranged = false;
    p.ammo = 0;
    p.damage = 26;
  } else if (state.role === "butcher"){
    p.ranged = false;
    p.ammo = 0;
    p.damage = 34;
  }
}

export function attack(state){
  const p = state.player;
  if (state.paused || !state.running) return;
  if (p.cooldown > 0) return;

  // oxygen cost per attack (small, not frantic)
  p.oxyTimer = Math.max(0, p.oxyTimer - 0.8);

  if (p.ranged){
    if (p.ammo <= 0) return;
    p.ammo -= 1;
    p.cooldown = 0.22;

    // bullet
    const sp = 430;
    state.bullets.push({
      x:p.x, y:p.y,
      vx: Math.cos(p.facing)*sp,
      vy: Math.sin(p.facing)*sp,
      life:0.9,
      r:3,
      dmg: p.damage
    });
    state.audio?.blip?.(0.45);
  } else {
    p.cooldown = (state.role === "butcher") ? 0.38 : 0.28;
    const reach = (state.role === "butcher") ? 70 : 56;

    // melee arc hit
    const ax = p.x + Math.cos(p.facing)*26;
    const ay = p.y + Math.sin(p.facing)*26;

    for(const e of state.entities){
      if(!e.alive) continue;
      const d = dist(ax,ay, e.x,e.y);
      if(d < reach){
        damageEnemy(state, e, p.damage);
        // shove enemy away to prevent “blocking”
        const dx = e.x - p.x, dy = e.y - p.y;
        const dd = Math.max(0.0001, Math.hypot(dx,dy));
        e.vx += (dx/dd)*220;
        e.vy += (dy/dd)*220;
        e.stagger = 18;
      }
    }

    // small “lunge” helps combat feel responsive
    p.vx += Math.cos(p.facing)*120;
    p.vy += Math.sin(p.facing)*120;
    state.audio?.blip?.(0.35);
  }
}

export function updateBullets(state, dt){
  for(let i=state.bullets.length-1;i>=0;i--){
    const b = state.bullets[i];
    b.life -= dt;
    if(b.life <= 0){ state.bullets.splice(i,1); continue; }

    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // collide with walls via small object collision
    const tmp = {x:b.x, y:b.y, vx:0, vy:0, r: b.r};
    if (collidesWall(state, tmp)){
      state.bullets.splice(i,1);
      continue;
    }

    // hit enemies
    for(const e of state.entities){
      if(!e.alive) continue;
      const d = dist(b.x,b.y, e.x,e.y);
      if(d < (e.r + b.r + 4)){
        damageEnemy(state, e, b.dmg);
        state.bullets.splice(i,1);
        break;
      }
    }
  }
}

function collidesWall(state, obj){
  // quick sample using moveWithCollision trick
  const beforeX = obj.x, beforeY = obj.y;
  const test = { ...obj, vx:0, vy:0 };
  // if any corner samples are solid, treat as collision:
  // reuse moveWithCollision by attempting 0 move isn't helpful; do direct sample:
  const r = test.r;
  const pts = [
    [test.x-r, test.y-r],[test.x+r, test.y-r],[test.x-r, test.y+r],[test.x+r, test.y+r]
  ];
  for(const [px,py] of pts){
    // lazy import avoided: entities.js uses isSolid; we can just call moveWithCollision?
    // We'll do a small probe by moving a tiny amount and see if it zeroes velocity is messy.
    // Instead: rely on map sampler from state.tiles.
    const tx = (px/state.tileSize)|0;
    const ty = (py/state.tileSize)|0;
    if(tx<0||ty<0||tx>=state.w||ty>=state.h) return true;
    if(state.tiles[ty][tx]===1) return true;
  }
  return false;
}

export function damageEnemy(state, enemy, amount){
  enemy.hp -= amount;
  enemy.stagger = 14 + (state.role==="butcher"?10:0);

  state.effects.push({type:"BLOOD", x:enemy.x, y:enemy.y, t:0, dur:0.35, intensity:1});
  state.audio?.hit?.(0.35);

  if(enemy.hp <= 0){
    enemy.alive = false;
    state.kills++;
    state.escalation += 1;

    // killing causes hallucinations + world retaliation
    triggerHallucination(state);
    if (state.r() < 0.65) spawnFaceFlash(state);

    // increase spawns + puzzle corruption
    state.enemySpawnRate += 0.12;
    state.puzzle.lies = state.r() < clamp(state.difficulty.puzzleCorrupt + state.escalation*0.04, 0, 0.75);

    // sanity cost (but not instant doom)
    const p = state.player;
    p.sanity = clamp(p.sanity - (6 + state.escalation*1.1), 0, p.sanityMax);
  }
}

