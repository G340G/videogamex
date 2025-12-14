// state.js
import { clamp } from "./utils.js";
import { makeSpriteBank } from "./sprites.js";

export function createState(){
  return {
    running:false,
    t:0,
    dt: 1/60,

    // rendering scale
    tilePx: 32,

    // run state
    difficulty: 2,
    theme: null,

    // world
    map: null,     // 2D array 0 floor / 1 wall
    w: 0, h: 0,

    loc: "LOC: ...",
    obj: "OBJ: COLLECT KEYS",
    msg: "...",
    msgT: 0,

    hero: null,
    enemies: [],
    projectiles: [],
    keysOnMap: [],
    portal: null,
    npcs: [],          // peasants
    tanks: [],         // oxygen tank pickups
    notes: [],         // lore notes
    prompt: null,      // choice prompt

    keysCollected: 0,
    totalKeys: 0,

    input: { down:new Set(), just:new Set() },

    sprites: null,
  };
}

export function setMsg(S, text, sec=2.5){
  S.msg = text;
  S.msgT = sec;
}

// ---------- THEMES ----------
const THEMES = [
  { id:"catacombs", name:"CATACOMBS", floor:"#0a090c", wall:"#17151d", accent:"#b51f3a", fog:0.92, rain:0.00 },
  { id:"asylum",   name:"ASYLUM",   floor:"#0b0b0f", wall:"#161820", accent:"#ffcc55", fog:0.88, rain:0.00 },
  { id:"prison",   name:"PRISON",   floor:"#07080b", wall:"#14161b", accent:"#9ad1a0", fog:0.90, rain:0.00 },
  { id:"cemetery", name:"CEMETERY", floor:"#070707", wall:"#121214", accent:"#d8d8d8", fog:0.95, rain:0.10 },
  { id:"forest",   name:"FOREST",   floor:"#050607", wall:"#101416", accent:"#6ad1ff", fog:0.96, rain:0.20 },
];

function pickDifficulty(){
  // mostly easier; hard sometimes
  const r = Math.random();
  return r < 0.55 ? 1 : (r < 0.90 ? 2 : 3);
}

function pickTheme(){
  return THEMES[(Math.random()*THEMES.length)|0];
}

// ---------- MAZE GEN (braided maze = always escapable) ----------
function makeGrid(w,h,fill=1){
  const m = Array.from({length:h}, ()=> Array.from({length:w}, ()=>fill));
  return m;
}
function inBounds(S,x,y){ return x>=0 && y>=0 && x<S.w && y<S.h; }

function generateBraidedMaze(w,h){
  // ensure odd dims for nicer mazes
  if (w % 2 === 0) w++;
  if (h % 2 === 0) h++;

  const map = makeGrid(w,h,1);
  const stack = [{x:1,y:1}];
  map[1][1]=0;

  const dirs = [
    {dx: 0, dy:-2},{dx: 0, dy: 2},
    {dx:-2, dy: 0},{dx: 2, dy: 0},
  ];

  while(stack.length){
    const c = stack[stack.length-1];
    // shuffle directions
    const sd = dirs.slice().sort(()=>Math.random()-0.5);
    let carved=false;

    for(const d of sd){
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

  // braid: remove dead ends to avoid forced corridors
  for(let y=1;y<h-1;y++){
    for(let x=1;x<w-1;x++){
      if(map[y][x]!==0) continue;
      let walls=0;
      if(map[y-1][x]===1) walls++;
      if(map[y+1][x]===1) walls++;
      if(map[y][x-1]===1) walls++;
      if(map[y][x+1]===1) walls++;
      if(walls===3 && Math.random()<0.65){
        const opts=[];
        if(map[y-1][x]===1) opts.push({x, y:y-1});
        if(map[y+1][x]===1) opts.push({x, y:y+1});
        if(map[y][x-1]===1) opts.push({x:x-1, y});
        if(map[y][x+1]===1) opts.push({x:x+1, y});
        const o = opts[(Math.random()*opts.length)|0];
        if(o) map[o.y][o.x]=0;
      }
    }
  }
  return { map, w, h };
}

function randFloor(map,w,h, minManhattanFrom=null, minD=0){
  for(let i=0;i<2000;i++){
    const x = 1 + ((Math.random()*(w-2))|0);
    const y = 1 + ((Math.random()*(h-2))|0);
    if(map[y][x]!==0) continue;
    if(minManhattanFrom){
      const d = Math.abs(x-minManhattanFrom.x)+Math.abs(y-minManhattanFrom.y);
      if(d < minD) continue;
    }
    return {x,y};
  }
  // fallback scan
  for(let y=1;y<h-1;y++){
    for(let x=1;x<w-1;x++){
      if(map[y][x]===0) return {x,y};
    }
  }
  return {x:1,y:1};
}

// ---------- STORY / PROMPTS ----------
const PROMPTS = [
  (name)=>({
    q: `A thin voice: "ARE YOU HERE TO STEAL ME, ${name}?"`,
    a: `1) YES (Reveal)`,
    b: `2) NO (Oxygen)`,
    effect: (S,choice)=>{
      if(choice===1){ S.hero.reveal = Math.max(S.hero.reveal, 10); setMsg(S, `"GOOD. THEN SEE EVERYTHING."`, 3.0); }
      else { S.hero.oxy = clamp(S.hero.oxy + 40, 0, S.hero.oxyMax); setMsg(S, `"BREATHE. BUT PAY LATER."`, 3.0); S.hero.sanity = Math.max(0, S.hero.sanity-6); }
    }
  }),
  (name)=>({
    q: `A ward-light flickers: "CONFESS, ${name}."`,
    a: `1) I KILLED (Damage up / sanity down)`,
    b: `2) I RAN (Speed up / oxygen down)`,
    effect: (S,choice)=>{
      if(choice===1){
        S.hero.grief = Math.max(S.hero.grief, 10);
        S.hero.griefBuff = Math.max(S.hero.griefBuff, 7);
        S.hero.sanity = Math.max(0, S.hero.sanity-14);
        setMsg(S, `"THE BLOOD REMEMBERS."`, 3.0);
      } else {
        S.hero.speed *= 1.06;
        S.hero.oxy = Math.max(0, S.hero.oxy-18);
        setMsg(S, `"YOU CAN RUN. YOU CAN'T ESCAPE."`, 3.0);
      }
    }
  }),
];

function maybeStartPrompt(S){
  if(S.prompt) return;
  if(Math.random() < 0.006){ // rare per frame
    const p = PROMPTS[(Math.random()*PROMPTS.length)|0](S.hero.name);
    S.prompt = { ...p, t: 6.5 };
    setMsg(S, "INPUT REQUIRED (1/2).", 2.0);
  }
}

// ---------- HERO SPRITES HELPERS ----------
export function angleToDir8(a){
  const PI = Math.PI;
  const n = (a + PI) / (2 * PI);
  const idx = ((n * 8) | 0) & 7;
  return ["W","NW","N","NE","E","SE","S","SW"][idx];
}

export function updateHeroAnimHints(hero, mx, my){
  const mv = Math.hypot(mx, my);
  hero._moving = mv > 0.01;
  if(hero._moving) hero.facing = Math.atan2(my, mx);
  hero.dir8 = angleToDir8(hero.facing);
}

export function onHeroShoot(hero){
  hero.shootFlash = 0.12;
}

// ---------- LEVEL BUILD ----------
export function generateLevel(S, name, role){
  S.sprites = S.sprites || makeSpriteBank();

  S.t = 0;
  S.dt = 1/60;
  S.difficulty = pickDifficulty();
  S.theme = pickTheme();

  // map size by difficulty (but keep moderate)
  const baseW = 41, baseH = 31;
  const w = baseW + (S.difficulty===3 ? 8 : S.difficulty===2 ? 4 : 0);
  const h = baseH + (S.difficulty===3 ? 6 : S.difficulty===2 ? 2 : 0);

  const mz = generateBraidedMaze(w,h);
  S.map = mz.map;
  S.w = mz.w;
  S.h = mz.h;

  // spawn points
  const start = {x:1,y:1};
  const far = randFloor(S.map,S.w,S.h,start, (S.difficulty===1?22: (S.difficulty===2?28:34)));

  // hero stats
  const oxyMax = 100;
  const baseDrain =
    S.difficulty === 1 ? 1.05 :
    S.difficulty === 2 ? 1.20 : 1.35;

  S.hero = {
    name, role,

    x: start.x + 0.5,
    y: start.y + 0.5,
    r: 0.30, // smaller = less corner sticking

    speed: role==="thief" ? 3.25 : role==="killer" ? 3.05 : 2.90,

    hp: role==="butcher" ? 125 : role==="killer" ? 110 : 96,
    maxHp: role==="butcher" ? 125 : role==="killer" ? 110 : 96,

    oxy: oxyMax,
    oxyMax,
    oxyDrain: baseDrain,
    suffocate: 0,

    sanity: 100,

    atkCd: 0,
    facing: Math.PI/2,

    reveal: 0,
    poison: 0,
    grief: 0,
    griefBuff: 0,

    animT: 0,
    walkPhase: 0,
    dir8: "S",
    shootFlash: 0,

    _moving:false,
  };

  // objective: keys -> portal
  S.keysCollected = 0;
  S.totalKeys = S.difficulty === 1 ? 3 : (S.difficulty === 2 ? 4 : 5);

  S.keysOnMap = [];
  for(let i=0;i<S.totalKeys;i++){
    const k = randFloor(S.map,S.w,S.h,start, 10 + i*2);
    S.keysOnMap.push({x:k.x, y:k.y, taken:false});
  }

  // portal far away
  S.portal = { x: far.x, y: far.y };

  // peasants (psych peasants)
  const npcCount = S.difficulty === 1 ? 3 : (S.difficulty === 2 ? 4 : 5);
  const effects = ["reveal","oxy","poison","grief"];
  S.npcs = [];
  for(let i=0;i<npcCount;i++){
    const p = randFloor(S.map,S.w,S.h,start, 8 + i);
    S.npcs.push({
      x: p.x + 0.5,
      y: p.y + 0.5,
      used:false,
      effect: effects[(Math.random()*effects.length)|0]
    });
  }

  // oxygen tanks (MORE, as you requested)
  const tankCount = S.difficulty === 1 ? 5 : (S.difficulty === 2 ? 6 : 7);
  S.tanks = [];
  for(let i=0;i<tankCount;i++){
    const t = randFloor(S.map,S.w,S.h,start, 6 + i);
    S.tanks.push({ x:t.x+0.5, y:t.y+0.5, taken:false, amt: 40 + ((Math.random()*25)|0) });
  }

  // enemies
  const enemyCount = S.difficulty === 1 ? 3 : (S.difficulty === 2 ? 5 : 7);
  S.enemies = [];
  for(let i=0;i<enemyCount;i++){
    const e = randFloor(S.map,S.w,S.h,start, 16 + i*2);
    S.enemies.push({
      x: e.x+0.5, y: e.y+0.5,
      r: 0.32,
      alive:true,
      hp: 45 + (S.difficulty*10) + ((Math.random()*10)|0),
      speed: 2.30 + Math.random()*0.35 + (S.difficulty===3 ? 0.25 : 0),
      dmg: S.difficulty===1 ? 8 : (S.difficulty===2 ? 10 : 12),
      hitCd: 0,
      stun: 0,
      jitter: Math.random()*10,
      // death bits:
      chunks: null,
    });
  }

  // lore notes
  const noteCount = 3 + (S.difficulty===3 ? 2 : 1);
  S.notes = [];
  for(let i=0;i<noteCount;i++){
    const n = randFloor(S.map,S.w,S.h,start, 7+i);
    S.notes.push({
      x: n.x+0.5, y: n.y+0.5, taken:false,
      text: randomNote(name, role, S.theme.name)
    });
  }

  // prompt state
  S.prompt = null;

  // UI strings
  S.loc = `LOC: ${S.theme.name}`;
  S.obj = "OBJ: COLLECT KEYS → PORTAL";
  setMsg(S, introLore(name, role, S.theme.name), 4.0);
}

function introLore(name, role, loc){
  const seeds = [
    `${name}, you wake in ${loc}. Your hands smell like metal and old fruit.`,
    `They called you ${role.toUpperCase()}. In ${loc}, names are punishments.`,
    `A door closes behind you. The corridor writes your name wrong: "${name}".`,
    `You hear a lullaby in static. ${loc} is not a place. It's a sentence.`,
  ];
  return seeds[(Math.random()*seeds.length)|0];
}

function randomNote(name, role, loc){
  const notes = [
    `NOTE: "If you find the keys, the portal will pretend to forgive you."`,
    `NOTE: "${name} is not ${name}. ${role} is not a role. ${loc} is not real."`,
    `NOTE: "The peasants trade miracles for something you can't see."`,
    `NOTE: "The monster hates corners. It loves your hesitation."`,
    `NOTE: "If you confess, the maze grows quieter. If you lie, it grows teeth."`,
  ];
  return notes[(Math.random()*notes.length)|0];
}

// called by main loop (optional helper if you want)
export function tickStory(S){
  if(!S.hero) return;
  maybeStartPrompt(S);
}

