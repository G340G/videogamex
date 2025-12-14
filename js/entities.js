import { clamp, dist, pick } from "./utils.js";
import { isSolid } from "./map.js";

export function spawnPlayer(state){
  const p = state.player;
  p.x = state.tileSize * 1.5;
  p.y = state.tileSize * 1.5;
  p.vx = p.vy = 0;
}

export function spawnEnemy(state, kind="stalker", atCell=null){
  const r = state.r;
  const ts = state.tileSize;
  const cell = atCell ?? {x: (r()*(state.w-2)|0)+1, y:(r()*(state.h-2)|0)+1};

  const e = {
    type:"enemy",
    kind,
    x: (cell.x + 0.5) * ts,
    y: (cell.y + 0.5) * ts,
    vx:0, vy:0,
    r: 12,
    hp: 55 + (state.level*6),
    alive:true,
    stagger:0,
    atkCd:0,
    // behavior
    mode:"ROAM",
    think: 0,
    targetX:0,
    targetY:0,
    speed: 85 * state.difficulty.enemyMult,
    damage: 10 * state.difficulty.enemyMult
  };
  state.entities.push(e);
  return e;
}

// Smooth collision (circle) against tile walls: resolves “corner sticking”
export function moveWithCollision(state, obj, dt){
  const ts = state.tileSize;
  const r = obj.r ?? 10;

  // integrate velocity
  let nx = obj.x + obj.vx * dt;
  let ny = obj.y + obj.vy * dt;

  // attempt move X then Y (slide)
  // sample 4 points around circle for collision
  const collide = (x,y)=>{
    const pts = [
      [x-r, y-r],[x+r, y-r],[x-r, y+r],[x+r, y+r]
    ];
    for(const [px,py] of pts){
      if(isSolid(state, px, py)) return true;
    }
    return false;
  };

  // X
  if(!collide(nx, obj.y)){
    obj.x = nx;
  } else {
    // push out of wall along X
    const step = Math.sign(obj.vx) || 1;
    for(let i=0;i<8;i++){
      const tx = obj.x + step * (-(i+1));
      if(!collide(tx, obj.y)){ obj.x = tx; break; }
    }
    obj.vx = 0;
  }

  // Y
  if(!collide(obj.x, ny)){
    obj.y = ny;
  } else {
    const step = Math.sign(obj.vy) || 1;
    for(let i=0;i<8;i++){
      const ty = obj.y + step * (-(i+1));
      if(!collide(obj.x, ty)){ obj.y = ty; break; }
    }
    obj.vy = 0;
  }
}

export function updateEnemies(state, dt){
  const p = state.player;

  for(const e of state.entities){
    if(!e.alive) continue;

    // stagger / stun
    if(e.stagger > 0){
      e.stagger -= 1;
      e.vx *= 0.85; e.vy *= 0.85;
      moveWithCollision(state, e, dt);
      continue;
    }

    if(e.atkCd > 0) e.atkCd -= dt;

    // Think
    e.think -= dt;
    if(e.think <= 0){
      e.think = 0.25 + state.r()*0.30;

      const d = dist(e.x,e.y, p.x,p.y);
      const hear = (p._sprinting ? 320 : 210) + state.escalation*10;

      if(d < hear){
        e.mode = "CHASE";
        e.targetX = p.x;
        e.targetY = p.y;
      } else {
        e.mode = "ROAM";
        // roam: pick a random point nearby that’s floor-ish
        const ang = state.r() * Math.PI * 2;
        e.targetX = e.x + Math.cos(ang) * (120 + state.r()*160);
        e.targetY = e.y + Math.sin(ang) * (120 + state.r()*160);
      }
    }

    // Avoid “hard blocking”: if very close, strafe instead of sitting in corridor
    const dx = (p.x - e.x);
    const dy = (p.y - e.y);
    const d = Math.max(0.0001, Math.hypot(dx,dy));

    let tx = e.targetX, ty = e.targetY;

    if(e.mode === "CHASE" && d < 90){
      // strafe angle to create passable gaps
      const side = (state.r()<0.5 ? -1 : 1);
      tx = p.x + (-dy/d)*side*80;
      ty = p.y + ( dx/d)*side*80;
    }

    const mx = tx - e.x;
    const my = ty - e.y;
    const md = Math.max(0.0001, Math.hypot(mx,my));
    const sp = e.speed * (1 + 0.04*state.level + 0.03*state.escalation);

    e.vx = (mx/md) * sp;
    e.vy = (my/md) * sp;

    moveWithCollision(state, e, dt);

    // Attack if close (with cooldown), actually damages player
    const hitD = dist(e.x,e.y, p.x,p.y);
    if(hitD < (e.r + p.r + 10) && e.atkCd <= 0 && p.invuln <= 0){
      e.atkCd = 0.55 + state.r()*0.25;
      p.hp -= e.damage;
      p.invuln = 0.35;
      state.effects.push({type:"HIT_FLASH", t:0, dur:0.20, intensity:1.0});

      // sanity damage too
      p.sanity = clamp(p.sanity - (4 + state.escalation*0.6), 0, p.sanityMax);

      // knockback (gives escape window)
      const k = 220;
      p.vx += (dx/d) * k;
      p.vy += (dy/d) * k;
    }
  }
}

