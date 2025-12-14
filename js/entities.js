import { clamp, dist } from "./utils.js";
import { isWall } from "./map.js";

export function makeHero(role, name) {
  const base = {
    name,
    role,
    x: 1.5, y: 1.5,
    r: 0.22,         // collision radius in tiles
    speed: 3.2,      // tiles/sec
    hp: 100, maxHp: 100,
    oxy: 100, oxyMax: 100,
    sanity: 100,
    attackCd: 0,
    dmg: 18,
    knock: 0.55,
    // powerups
    reveal: 0,       // seconds
    poison: 0,       // seconds
    grief: 0         // seconds
  };

  if (role === "thief") {
    base.speed = 3.7;
    base.dmg = 14;
    base.sanity = 110;
  } else if (role === "killer") {
    base.speed = 3.3;
    base.dmg = 18;
    base.sanity = 100;
  } else if (role === "butcher") {
    base.speed = 3.0;
    base.dmg = 26;
    base.knock = 0.75;
    base.sanity = 95;
  }

  return base;
}

export function makeEnemy(x, y, kind = "stalker") {
  return {
    kind,
    x, y,
    r: 0.24,
    hp: 42,
    speed: 2.35,
    dmg: 14,
    hitCd: 0,
    stun: 0,
    alive: true
  };
}

export function makePeasant(x, y, effect) {
  return {
    kind: "peasant",
    x, y,
    r: 0.22,
    effect,     // "reveal" | "poison" | "oxy" | "calm"
    used: false
  };
}

export function tryMoveCircle(map, ent, dx, dy) {
  // Axis-separated movement + circle-vs-grid collision
  // ent.x/ent.y are in tile units.
  const r = ent.r;
  let nx = ent.x + dx;
  let ny = ent.y;

  if (!circleHitsWall(map, nx, ny, r)) ent.x = nx;

  nx = ent.x;
  ny = ent.y + dy;

  if (!circleHitsWall(map, nx, ny, r)) ent.y = ny;
}

function circleHitsWall(map, cx, cy, r) {
  // sample 4 corners of the circle's AABB
  const minX = Math.floor(cx - r), maxX = Math.floor(cx + r);
  const minY = Math.floor(cy - r), maxY = Math.floor(cy + r);

  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (isWall(map, tx, ty)) {
        // precise circle vs tile AABB
        const nearestX = clamp(cx, tx, tx + 1);
        const nearestY = clamp(cy, ty, ty + 1);
        const d = dist(cx, cy, nearestX, nearestY);
        if (d < r) return true;
      }
    }
  }
  return false;
}

export function heroAttack(state) {
  const h = state.hero;
  if (h.attackCd > 0) return false;
  h.attackCd = 0.35;

  // short range cone-ish in facing direction
  const fx = Math.cos(state.heroFacing);
  const fy = Math.sin(state.heroFacing);
  const ax = h.x + fx * 0.55;
  const ay = h.y + fy * 0.55;

  let hit = false;

  for (const e of state.enemies) {
    if (!e.alive) continue;
    const d = dist(ax, ay, e.x, e.y);
    if (d < 0.70) {
      e.hp -= h.dmg;
      e.stun = 0.25;
      // knockback
      const dx = e.x - h.x, dy = e.y - h.y;
      const len = Math.max(0.001, Math.hypot(dx, dy));
      e.x += (dx / len) * h.knock;
      e.y += (dy / len) * h.knock;

      hit = true;
      if (e.hp <= 0) {
        e.alive = false;
        // hallucination penalty
        h.sanity = Math.max(0, h.sanity - 12);
        h.grief = Math.max(h.grief, 10); // seconds of anxiety shimmer
      }
    }
  }

  return hit;
}


