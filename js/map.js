import { randInt } from "./utils.js";

export function isWall(map, tx, ty){
  if (!map || !map[0]) return true;
  if (ty < 0 || tx < 0 || ty >= map.length || tx >= map[0].length) return true;
  return map[ty][tx] === 1;
}

// braided maze: never single unavoidable corridor
export function generateBraidedMaze(w, h){
  const map = Array.from({length:h}, () => Array.from({length:w}, () => 1));

  const stack = [];
  const start = {x:1, y:1};
  map[start.y][start.x] = 0;
  stack.push(start);

  while (stack.length){
    const c = stack[stack.length - 1];
    const dirs = [
      {dx:0, dy:-2}, {dx:0, dy:2}, {dx:-2, dy:0}, {dx:2, dy:0}
    ].sort(()=>Math.random()-0.5);

    let carved = false;
    for (const d of dirs){
      const nx = c.x + d.dx, ny = c.y + d.dy;
      if (nx>0 && ny>0 && nx<w-1 && ny<h-1 && map[ny][nx] === 1){
        map[ny][nx] = 0;
        map[c.y + d.dy/2][c.x + d.dx/2] = 0;
        stack.push({x:nx, y:ny});
        carved = true;
        break;
      }
    }
    if (!carved) stack.pop();
  }

  // braid: open dead-ends
  for (let y=1;y<h-1;y++){
    for (let x=1;x<w-1;x++){
      if (map[y][x] !== 0) continue;
      let walls = 0;
      if (map[y-1][x]===1) walls++;
      if (map[y+1][x]===1) walls++;
      if (map[y][x-1]===1) walls++;
      if (map[y][x+1]===1) walls++;
      if (walls === 3 && Math.random() < 0.65){
        const options = [];
        if (map[y-1][x]===1) options.push([x,y-1]);
        if (map[y+1][x]===1) options.push([x,y+1]);
        if (map[y][x-1]===1) options.push([x-1,y]);
        if (map[y][x+1]===1) options.push([x+1,y]);
        const [ox,oy] = options[randInt(0, options.length-1)];
        map[oy][ox] = 0;
      }
    }
  }

  return map;
}

