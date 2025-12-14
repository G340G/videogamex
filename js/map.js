import { randInt, pick } from "./utils.js";

export const THEMES = [
  { key:"asylum",   name:"ASYLUM",   floor:"#101012", wall:"#2d323a", accent:"#cfd8dc" },
  { key:"catacomb", name:"CATACOMB", floor:"#0c0907", wall:"#2a1a12", accent:"#d7ccc8" },
  { key:"prison",   name:"PRISON",   floor:"#07090c", wall:"#1c2431", accent:"#b0bec5" },
  { key:"cemetery", name:"CEMETERY", floor:"#050707", wall:"#1a2620", accent:"#c8e6c9" },
  { key:"dungeon",  name:"DUNGEON",  floor:"#08060a", wall:"#2a1630", accent:"#e1bee7" }
];

// 0 floor, 1 wall
export function generateBraidedMaze(rng, w, h) {
  const map = Array.from({ length: h }, () => Array(w).fill(1));

  const stack = [];
  const start = { x: 1, y: 1 };
  map[start.y][start.x] = 0;
  stack.push(start);

  const dirs = [
    { dx: 0, dy: -2 }, { dx: 0, dy: 2 },
    { dx: -2, dy: 0 }, { dx: 2, dy: 0 }
  ];

  while (stack.length) {
    const c = stack[stack.length - 1];
    // shuffle dirs
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }

    let carved = false;
    for (const d of dirs) {
      const nx = c.x + d.dx, ny = c.y + d.dy;
      if (nx > 0 && nx < w - 1 && ny > 0 && ny < h - 1 && map[ny][nx] === 1) {
        map[ny][nx] = 0;
        map[c.y + (d.dy / 2)][c.x + (d.dx / 2)] = 0;
        stack.push({ x: nx, y: ny });
        carved = true;
        break;
      }
    }
    if (!carved) stack.pop();
  }

  // braid: remove dead ends (add loops)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (map[y][x] !== 0) continue;
      let walls = 0;
      if (map[y - 1][x]) walls++;
      if (map[y + 1][x]) walls++;
      if (map[y][x - 1]) walls++;
      if (map[y][x + 1]) walls++;
      if (walls === 3 && rng() < 0.65) {
        const options = [];
        if (map[y - 1][x]) options.push({ x, y: y - 1 });
        if (map[y + 1][x]) options.push({ x, y: y + 1 });
        if (map[y][x - 1]) options.push({ x: x - 1, y });
        if (map[y][x + 1]) options.push({ x: x + 1, y });
        const o = pick(rng, options);
        map[o.y][o.x] = 0;
      }
    }
  }

  return map;
}

export function isWall(map, x, y) {
  if (y < 0 || y >= map.length) return true;
  if (x < 0 || x >= map[0].length) return true;
  return map[y][x] === 1;
}

export function randomFloor(rng, map, minDistFrom, tries = 2000) {
  const h = map.length, w = map[0].length;
  for (let i = 0; i < tries; i++) {
    const x = randInt(rng, 1, w - 2);
    const y = randInt(rng, 1, h - 2);
    if (map[y][x] !== 0) continue;
    if (minDistFrom) {
      const md = Math.abs(x - minDistFrom.x) + Math.abs(y - minDistFrom.y);
      if (md < minDistFrom.d) continue;
    }
    return { x, y };
  }
  return { x: 1, y: 1 };
}
