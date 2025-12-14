import { randInt } from "./utils.js";

export function generateBraidedMaze(state, w, h){
  state.mapW = w; state.mapH = h;

  const map = Array.from({length:h}, ()=> Array.from({length:w}, ()=> 1));
  const stack = [{x:1,y:1}];
  map[1][1] = 0;

  const shuffle = (arr)=>{
    for(let i=arr.length-1;i>0;i--){
      const j = (state.r()*(i+1))|0;
      [arr[i],arr[j]] = [arr[j],arr[i]];
    }
    return arr;
  };

  while(stack.length){
    const c = stack[stack.length-1];
    const dirs = shuffle([[0,-2],[0,2],[-2,0],[2,0]]);
    let carved=false;

    for(const [dx,dy] of dirs){
      const nx=c.x+dx, ny=c.y+dy;
      if(nx>0 && nx<w-1 && ny>0 && ny<h-1 && map[ny][nx]===1){
        map[ny][nx]=0;
        map[c.y+dy/2][c.x+dx/2]=0;
        stack.push({x:nx,y:ny});
        carved=true;
        break;
      }
    }
    if(!carved) stack.pop();
  }

  // braid: remove dead ends to ensure escapable loops
  for(let y=1;y<h-1;y++){
    for(let x=1;x<w-1;x++){
      if(map[y][x]!==0) continue;
      let walls=0;
      if(map[y-1][x]) walls++;
      if(map[y+1][x]) walls++;
      if(map[y][x-1]) walls++;
      if(map[y][x+1]) walls++;
      if(walls===3 && state.r() < 0.6){
        const opts = [];
        if(map[y-1][x]) opts.push([0,-1]);
        if(map[y+1][x]) opts.push([0, 1]);
        if(map[y][x-1]) opts.push([-1,0]);
        if(map[y][x+1]) opts.push([ 1,0]);
        const [dx,dy] = opts[(state.r()*opts.length)|0];
        map[y+dy][x+dx] = 0;
      }
    }
  }

  state.map = map;
}

export function isWall(state, tx, ty){
  if(tx<0||ty<0||tx>=state.mapW||ty>=state.mapH) return true;
  return state.map[ty][tx] === 1;
}

export function randomFloorCell(state, {x=1,y=1,d=10}={}){
  for(let i=0;i<1200;i++){
    const rx = randInt(state.r, 1, state.mapW-2);
    const ry = randInt(state.r, 1, state.mapH-2);
    if(state.map[ry][rx]!==0) continue;
    if(Math.abs(rx-x)+Math.abs(ry-y) < d) continue;
    return {x:rx,y:ry};
  }
  return {x:1,y:1};
}

export function themeLore(state){
  const seeds = [
    `They wrote {NAME} into the ledger, then erased the ink with teeth.`,
    `{NAME} wakes under fluorescent hum. The corridors smell like apologies.`,
    `A peasant in the corner repeats your role: {ROLE}. Like a curse.`,
    `The portal is hungry. It wants keys. It wants {NAME}.`,
    `Someone stitched a map into a mattress. The stitches are still warm.`,
  ];
  const s = seeds[(state.r()*seeds.length)|0];
  return s.replaceAll("{NAME}", state.name).replaceAll("{ROLE}", state.role.toUpperCase());
}

