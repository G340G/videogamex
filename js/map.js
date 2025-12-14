import { clamp, pick } from "./utils.js";

export const THEMES = {
  asylum:   { name:"ASYLUM WARD",    floor:"#141414", wall:"#3a3a44", accent:"#d0f0d0", noise:0.12, perk:"False doors whisper." },
  prison:   { name:"PRISON BLOCK",   floor:"#0d1012", wall:"#2a3b44", accent:"#ffee88", noise:0.16, perk:"Patrols prefer corners." },
  catacombs:{ name:"OLD CATACOMBS",  floor:"#140b08", wall:"#2a1510", accent:"#ff6677", noise:0.20, perk:"Echo puzzles." },
  cemetery: { name:"CEMETERY PATH",  floor:"#070a08", wall:"#102015", accent:"#aaffaa", noise:0.22, perk:"Things return if ignored." },
  cult:     { name:"CULT FACILITY",  floor:"#0a070a", wall:"#1c0f1c", accent:"#ff2a2a", noise:0.28, perk:"Illusion of choice." }
};

// 1=wall 0=floor
export function generateBraidedMaze(state, w, h){
  const r = state.r;
  const map = Array.from({length:h}, ()=> Array(w).fill(1));

  // ensure odd cells for maze carving
  const start = {x:1, y:1};
  map[start.y][start.x] = 0;
  const stack=[start];

  const dirs = [
    {dx:0, dy:-2},{dx:0, dy:2},{dx:-2, dy:0},{dx:2, dy:0}
  ];

  while(stack.length){
    const c = stack[stack.length-1];
    // shuffle dirs
    const shuffled = dirs.slice().sort(()=> r() - 0.5);
    let carved=false;
    for(const d of shuffled){
      const nx = c.x + d.dx;
      const ny = c.y + d.dy;
      if(nx>0 && nx<w-1 && ny>0 && ny<h-1 && map[ny][nx]===1){
        map[ny][nx]=0;
        map[c.y + d.dy/2][c.x + d.dx/2]=0;
        stack.push({x:nx,y:ny});
        carved=true;
        break;
      }
    }
    if(!carved) stack.pop();
  }

  // braid: remove dead ends aggressively (loops => escapable)
  for(let y=1;y<h-1;y++){
    for(let x=1;x<w-1;x++){
      if(map[y][x]!==0) continue;
      let walls=0;
      const n = map[y-1][x]===1, s = map[y+1][x]===1, w0 = map[y][x-1]===1, e = map[y][x+1]===1;
      if(n) walls++; if(s) walls++; if(w0) walls++; if(e) walls++;
      if(walls===3 && r() < 0.85){ // strong braiding
        // open one wall neighbor randomly
        const opts=[];
        if(n) opts.push({x, y:y-1});
        if(s) opts.push({x, y:y+1});
        if(w0) opts.push({x:x-1, y});
        if(e) opts.push({x:x+1, y});
        const p = opts[(r()*opts.length)|0];
        map[p.y][p.x]=0;
      }
    }
  }

  state.map = map;
  state.w = w;
  state.h = h;
  state.tiles = map;

  return map;
}

export function isSolid(state, x, y){
  const tx = (x / state.tileSize) | 0;
  const ty = (y / state.tileSize) | 0;
  if(tx<0 || ty<0 || tx>=state.w || ty>=state.h) return true;
  return state.tiles[ty][tx] === 1;
}

export function randomFloorCell(state, minDistFrom=null){
  const r = state.r;
  for(let i=0;i<2000;i++){
    const x = 1 + ((r()*(state.w-2))|0);
    const y = 1 + ((r()*(state.h-2))|0);
    if(state.tiles[y][x]!==0) continue;
    if(minDistFrom){
      const dx = x - minDistFrom.x;
      const dy = y - minDistFrom.y;
      if(Math.abs(dx)+Math.abs(dy) < minDistFrom.d) continue;
    }
    return {x,y};
  }
  // fallback scan
  for(let y=1;y<state.h-1;y++){
    for(let x=1;x<state.w-1;x++){
      if(state.tiles[y][x]===0) return {x,y};
    }
  }
  return {x:1,y:1};
}

export function themeLore(state){
  const r = state.r;
  const base = [
    `"{NAME}, you woke up in {LOC}. The air tastes like wet tape."`,
    `"Your role is {ROLE}. The facility already wrote that into you."`,
    `"Someone is calling your name from behind the walls. It is not a person."`,
    `"A red door is promised. Promises are how it hunts."`,
    `"They ran experiments on attention. Now attention runs experiments on you."`
  ];
  const cult = [
    `"A choir counts your breaths. It never reaches zero."`,
    `"You signed the consent form in a dream. Your signature is still bleeding."`,
    `"The terminals are altars. The codes are prayers that don’t work."`
  ];
  const cemetery = [
    `"The ground is soft. It remembers the shape of bodies."`,
    `"Every silence is a shovel."`
  ];
  const pool = base.concat(
    state.themeKey==="cult" ? cult :
    state.themeKey==="cemetery" ? cemetery : []
  );
  return pick(r, pool);
}

