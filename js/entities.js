import { clamp, dist } from "./utils.js";
import { isWall } from "./map.js";

// robust circle sliding to avoid "corner sticking"
export function tryMoveCircle(map, ent, dx, dy){
  const r = ent.r || 0.38;

  const tryAxis = (adx, ady) => {
    const nx = ent.x + adx;
    const ny = ent.y + ady;

    // check 4 sample points around circle
    const pts = [
      [nx - r, ny - r],
      [nx + r, ny - r],
      [nx - r, ny + r],
      [nx + r, ny + r],
    ];
    for (const [px, py] of pts){
      if (isWall(map, Math.floor(px), Math.floor(py))) return false;
    }
    ent.x = nx; ent.y = ny;
    return true;
  };

  // move both, then slide
  if (!tryAxis(dx, dy)){
    if (!tryAxis(dx, 0)) tryAxis(0, dy);
  }
}

export function makeProjectile(x,y,vx,vy,from,dmg,r=0.12){
  return { x,y,vx,vy,from,dmg,r,life:0.85,alive:true,t:0 };
}

export function spawnGibs(S, x, y, power=1){
  const n = 14 + ((Math.random()*10)|0);
  for (let i=0;i<n;i++){
    const a = Math.random()*Math.PI*2;
    const sp = (2 + Math.random()*6) * power;
    S.gibs.push({
      x, y,
      vx: Math.cos(a)*sp,
      vy: Math.sin(a)*sp,
      life: 0.8 + Math.random()*0.7,
      sz: 1 + Math.random()*2.5,
      col: Math.random()<0.6 ? "#ff3355" : "#ddd"
    });
  }
}


