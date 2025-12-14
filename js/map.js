import { randInt, pick } from "./utils.js";

export const THEMES = [
  { key:"dungeon",  name:"DUNGEON",  floor:"#0b0a0d", wall:"#24202c", accent:"#ff2a4a", moss:"#204029" },
  { key:"catacomb", name:"CATACOMB", floor:"#090604", wall:"#2a1a12", accent:"#ffd45a", moss:"#3b2d10" },
  { key:"prison",   name:"PRISON",   floor:"#07090c", wall:"#1c2431", accent:"#72d6ff", moss:"#10202a" },
  { key:"asylum",   name:"ASYLUM",   floor:"#0c0c0f", wall:"#2d323a", accent:"#cfead6", moss:"#21313a" },
  { key:"cemetery", name:"CEMETERY", floor:"#050707", wall:"#1a2620", accent:"#a7ffb5", moss:"#183320" },
];

export function isWall(map, x, y) {
  if (!map) return true;
  if (y < 0 || y >= map.length) return true;
  if (x < 0 || x >= map[0].length) return true;
  return map[y][x] === 1;
}

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
    // shuffle
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

  // braid dead ends (lots of loops => “always escapable”)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (map[y][x] !== 0) continue;
      let walls = 0;
      if (map[y - 1][x]) walls++;
      if (map[y + 1][x]) walls++;
      if (map[y][x - 1]) walls++;
      if (map[y][x + 1]) walls++;
      if (walls === 3 && rng() < 0.85) {
        const opts = [];
        if (map[y - 1][x]) opts.push({ x, y: y - 1 });
        if (map[y + 1][x]) opts.push({ x, y: y + 1 });
        if (map[y][x - 1]) opts.push({ x: x - 1, y });
        if (map[y][x + 1]) opts.push({ x: x + 1, y });
        const o = pick(rng, opts);
        map[o.y][o.x] = 0;
      }
    }
  }

  return map;
}

export function randomFloor(rng, map, minFrom, tries = 4000) {
  const h = map.length, w = map[0].length;
  for (let i = 0; i < tries; i++) {
    const x = randInt(rng, 1, w - 2);
    const y = randInt(rng, 1, h - 2);
    if (map[y][x] !== 0) continue;

    if (minFrom) {
      const md = Math.abs(x - minFrom.x) + Math.abs(y - minFrom.y);
      if (md < minFrom.d) continue;
    }
    return { x, y };
  }
  return { x: 1, y: 1 };
}
