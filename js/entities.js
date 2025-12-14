import { clamp, dist } from "./utils.js";
import { isWall } from "./map.js";

export function makeHero(role, name) {
  const h = {
    name,
    role,
    x: 1.5, y: 1.5,
    r: 0.30,          // BIGGER body collision (brutal)
    speed: 3.0,       // tiles/sec
    hp: 110, maxHp: 110,
    oxy: 100, oxyMax: 100,
    sanity: 100,
    // combat
    atkCd: 0,
    facing: 0,
    // status effects
    reveal: 0,
    poison: 0,
    grief: 0,
    griefBuff: 0,     // damage boost while “grief”
    // suffocation
    suffocate: 0,     // seconds since oxygen hit 0
  };

  if (role === "thief") {
    h.speed = 3.6;
    h.hp = h.maxHp = 95;
  } else if (role === "killer") {
    h.speed = 3.1;
    h.hp = h.maxHp = 110;
  } else if (role === "butcher") {
    h.speed = 2.8;
    h.hp = h.maxHp = 135;
  }

  return h;
}

export function makeEnemy(x, y, tier = 1) {
  return {
    kind: "enemy",
    x, y,
    r: 0.30,
    hp: 55 + tier * 18,
    speed: 2.1 + tier * 0.25,
    dmg: 12 + tier * 3,
    hitCd: 0,
    stun: 0,
    alive: true,
    // cosmetic jitter
    jitter: Math.random() * 1000
  };
}

export function makeProjectile(x, y, vx, vy, from, dmg, life = 0.55) {
  return {
    kind: "proj",
    x, y,
    vx, vy,
    r: 0.12,
    from,  // "hero"|"enemy"
    dmg,
    life,
    alive: true,
    // trail
    t: 0
  };
}

export function makePeasant(x, y, effect) {
  return { kind: "peasant", x, y, r: 0.28, effect, used: false };
}

export function tryMoveCircle(map, ent, dx, dy) {
  const r = ent.r;

  let nx = ent.x + dx;
  let ny = ent.y;
  if (!circleHits(map, nx, ny, r)) ent.x = nx;

  nx = ent.x;
  ny = ent.y + dy;
  if (!circleHits(map, nx, ny, r)) ent.y = ny;
}

function circleHits(map, cx, cy, r) {
  const minX = Math.floor(cx - r), maxX = Math.floor(cx + r);
  const minY = Math.floor(cy - r), maxY = Math.floor(cy + r);

  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (isWall(map, tx, ty)) {
        const nearestX = clamp(cx, tx, tx + 1);
        const nearestY = clamp(cy, ty, ty + 1);
        if (dist(cx, cy, nearestX, nearestY) < r) return true;
      }
    }
  }
  return false;
}

