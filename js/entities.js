import { clamp, dist, pick } from "./utils.js";
import { isWall } from "./map.js";

export function spawnPlayer(state){
  const ts = state.tileSize;
  state.player.x = ts*1.5;
  state.player.y = ts*1.5;
  state.player.vx = 0;
  state.player.vy = 0;
}

export function spawnEnemy(state, kind, cell){
  const ts = state.tileSize;
  const e = {
    kind,
    x: (cell.x+0.5)*ts,
    y: (cell.y+0.5)*ts,
    vx: 0, vy: 0,
    alive: true,
    hp: 60 + (state.level*6|0),
    speed: (65 + state.level*4) * state.difficulty.enemyMult,
    aggro: 0.85 + state.r()*0.25,
    cd: 0,
  };
  state.entities.push(e);
  return e;
}

export function spawnPeasant(state, cell){
  const ts = state.tileSize;
  const npc = {
    kind: "peasant",
    x: (cell.x+0.5)*ts,
    y: (cell.y+0.5)*ts,
    vx: 0, vy: 0,
    alive: true,
    mood: pick(state.r, ["weeping","smiling","empty"]),
    offer: rollPeasantOffer(state),
    used: false,
    wanderT: 0,
    wanderA: state.r()*Math.PI*2,
  };
  state.entities.push(npc);
  return npc;
}

function rollPeasantOffer(state){
  // “psych peasant” offers: powers/objects with tradeoffs
  const offers = [
    {
      id:"LUMEN",
      title:"LUMEN BEAM",
      text:"A peasant offers a cold beam. It reveals everything.",
      a:"1) ACCEPT (8s full-vision)",
      b:"2) REFUSE",
      apply:(state)=>{
        state.effects.push({type:"LUMEN", t:0, dur:8.0, intensity:1});
        state.player.sanity = clamp(state.player.sanity - 6, 0, state.player.sanityMax);
      }
    },
    {
      id:"POISON",
      title:"POISON",
      text:"A vial labeled: POISON. It distorts you. It slows them.",
      a:"1) DRINK (warp vision, slow enemies 10s)",
      b:"2) REFUSE",
      apply:(state)=>{
        state.effects.push({type:"POISON", t:0, dur:10.0, intensity:1});
        // slow enemies globally while poison effect runs (handled in updateEnemies)
      }
    },
    {
      id:"GRIEF",
      title:"GRIEF",
      text:"He hands you GRIEF. It makes you anxious. It makes you lucky.",
      a:"1) TAKE (anxiety +1 key appears)",
      b:"2) REFUSE",
      apply:(state)=>{
        state.escalation += 1.1;
        state.effects.push({type:"GRIEF", t:0, dur:12.0, intensity:1});
        // spawn a bonus key somewhere (main.js handles if needed; here we mark flag)
        state._spawnBonusKey = true;
      }
    },
    {
      id:"OXY",
      title:"BREATH RELIEF",
      text:"A sack of oxygen tanks. It smells like rust.",
      a:"1) TAKE (+25s oxygen)",
      b:"2) REFUSE",
      apply:(state)=>{
        state.player.oxyTimer = Math.min(state.player.oxyTimerMax, state.player.oxyTimer + 25);
      }
    },
  ];
  return offers[(state.r()*offers.length)|0];
}

export function moveWithCollision(state, ent, dt){
  const ts = state.tileSize;

  // circle collider (prevents corner snagging)
  const r = 9; // collision radius in px

  const tryAxis = (nx, ny)=>{
    const tx1 = Math.floor((nx - r)/ts), tx2 = Math.floor((nx + r)/ts);
    const ty1 = Math.floor((ny - r)/ts), ty2 = Math.floor((ny + r)/ts);
    for(let ty=ty1; ty<=ty2; ty++){
      for(let tx=tx1; tx<=tx2; tx++){
        if(isWall(state, tx, ty)) return false;
      }
    }
    ent.x = nx; ent.y = ny;
    return true;
  };

  // attempt x then y, with tiny “slide assist”
  const nx = ent.x + ent.vx*dt;
  const ny = ent.y + ent.vy*dt;

  if(!tryAxis(nx, ent.y)){
    // slide assist: reduce x velocity when hitting corner
    ent.vx *= 0.2;
  }
  if(!tryAxis(ent.x, ny)){
    ent.vy *= 0.2;
  }
}

export function updateEnemies(state, dt){
  const p = state.player;

  const poisonActive = state.effects.some(e=>e.type==="POISON");
  const poisonSlow = poisonActive ? 0.55 : 1.0;

  for(const e of state.entities){
    if(!e.alive) continue;

    if(e.kind==="peasant"){
      // wander slowly, harmless
      if(e.used) continue;
      e.wanderT -= dt;
      if(e.wanderT <= 0){
        e.wanderT = 0.7 + state.r()*1.6;
        e.wanderA += (state.r()*2-1)*1.2;
      }
      const sp = 18;
      e.vx = Math.cos(e.wanderA)*sp;
      e.vy = Math.sin(e.wanderA)*sp;
      moveWithCollision(state, e, dt);
      continue;
    }

    // stalker-like chase
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.max(1, Math.hypot(dx,dy));

    const hear = (p._sprinting ? 320 : 220);
    const sees = d < hear;

    const speed = (e.speed * e.aggro) * poisonSlow;

    if(sees){
      e.vx = (dx/d)*speed;
      e.vy = (dy/d)*speed;
    }else{
      // drift
      e.cd -= dt;
      if(e.cd <= 0){
        e.cd = 0.6 + state.r()*1.3;
        const ang = state.r()*Math.PI*2;
        e.vx = Math.cos(ang)*speed*0.35;
        e.vy = Math.sin(ang)*speed*0.35;
      }
    }

    moveWithCollision(state, e, dt);

    // damage + close-range face flash
    const hit = d < 18;
    if(hit && p.invuln<=0){
      p.hp -= dt * (9 + state.level*0.7);
      p.sanity = clamp(p.sanity - dt*6, 0, p.sanityMax);
      state.escalation += dt*0.25;
      if(state.r() < 0.10){
        state.effects.push({type:"FACE_FLASH", t:0, dur:0.45, intensity:1});
      }
    }
  }
}

export function nearestPeasant(state){
  let best=null, bestD=999999;
  for(const e of state.entities){
    if(!e.alive || e.kind!=="peasant" || e.used) continue;
    const d = dist(state.player.x, state.player.y, e.x, e.y);
    if(d < bestD){
      bestD = d; best = e;
    }
  }
  return {npc:best, d:bestD};
}

