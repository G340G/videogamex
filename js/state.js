import { clamp, dist, pick, randInt } from "./utils.js";
import { generateBraidedMaze } from "./map.js";

const THEMES = [
  { key:"forest",   name:"DROWNED FOREST",  fog:0.78, rain:0.55, haze:0.22, floor:"#0b120b", wall:"#0a0f0a", accent:"#5cff7a" },
  { key:"cemetery", name:"CEMETERY GRID",   fog:0.83, rain:0.20, haze:0.30, floor:"#0b0b10", wall:"#151523", accent:"#ff4466" },
  { key:"asylum",   name:"ASYLUM WARD",     fog:0.76, rain:0.10, haze:0.18, floor:"#101014", wall:"#2a2a34", accent:"#baffff" },
  { key:"catacombs",name:"CATACOMBS",       fog:0.88, rain:0.05, haze:0.35, floor:"#0a0806", wall:"#1a110c", accent:"#ffd38a" },
  { key:"prison",   name:"PRISON BLOCK",    fog:0.80, rain:0.25, haze:0.25, floor:"#0b0e10", wall:"#1a1f25", accent:"#aaddaa" },
];

const LORE_SNIPS = [
  "A woman was taken but the file says you volunteered.",
  "The cult calls you a tool. The maze calls you a name.",
  "Your hands remember doors you never opened.",
  "The portal is a mouth pretending to be light.",
  "Every key is a tooth. Every tooth is a confession.",
  "You are not lost. You are being arranged."
];

const NOTES = [
  "NOTE: If the rain stops, listen for your own footsteps.",
  "NOTE: The peasants can lie. Sometimes the lie is the power.",
  "NOTE: The ghost follows the strongest choice you made.",
  "NOTE: The shrines accept oxygen as currency.",
  "NOTE: If you kill it, count the pieces. You will forget one."
];

const QUESTIONS = [
  {
    q: "A cracked speaker asks: “WHO ARE YOU SAVING?”",
    a1:"1) HER", a2:"2) MYSELF",
    on:(S,c)=>{
      if (c===1){ S.hero.sanity = clamp(S.hero.sanity+10,0,120); S.curses.ghost = Math.max(S.curses.ghost, 8); S.msg="A GHOST ACCEPTS YOUR PROMISE."; S.msgT=3; }
      else { S.buffs.damage = Math.max(S.buffs.damage, 10); S.hero.sanity = clamp(S.hero.sanity-8,0,120); S.msg="SELFISHNESS SHARPENS YOU."; S.msgT=3; }
    }
  },
  {
    q:"A shrine pulses: “BLEED TO SEE?”",
    a1:"1) YES", a2:"2) NO",
    on:(S,c)=>{
      if (c===1){ S.hero.hp = Math.max(1, S.hero.hp-18); S.buffs.reveal = Math.max(S.buffs.reveal, 12); S.msg="VISION BOUGHT."; S.msgT=3; }
      else { S.curses.grief = Math.max(S.curses.grief, 10); S.msg="YOU KEEP YOUR BLOOD. YOU LOSE YOUR SPEED."; S.msgT=3; }
    }
  },
  {
    q:"A peasant whispers: “TAKE THE POISON?”",
    a1:"1) DRINK", a2:"2) REFUSE",
    on:(S,c)=>{
      if (c===1){ S.curses.poison = Math.max(S.curses.poison, 14); S.buffs.damage = Math.max(S.buffs.damage, 10); S.msg="THE WALLS MELT. YOUR SHOTS BITE."; S.msgT=3; }
      else { S.buffs.oxy = Math.max(S.buffs.oxy, 1); S.hero.oxy = clamp(S.hero.oxy+40,0,S.hero.oxyMax); S.msg="YOU CHOOSE AIR."; S.msgT=3; }
    }
  }
];

// missions: do weird tasks to gain powers or lift curses
const MISSIONS = [
  () => ({
    title:"STILLNESS RITE",
    desc:"Stand still in the mist for 4 seconds.\nReward: REVEAL",
    type:"still",
    t:0, goal:4,
    reward:(S)=>{ S.buffs.reveal = Math.max(S.buffs.reveal, 12); }
  }),
  () => ({
    title:"NO RUN",
    desc:"Survive 12 seconds without sprinting.\nReward: OXYGEN",
    type:"norun",
    t:0, goal:12,
    reward:(S)=>{ S.hero.oxy = clamp(S.hero.oxy+55,0,S.hero.oxyMax); }
  }),
  () => ({
    title:"CONFESS",
    desc:"Collect a NOTE.\nReward: DAMAGE / Curse: GHOST",
    type:"note",
    t:0, goal:1,
    reward:(S)=>{ S.buffs.damage = Math.max(S.buffs.damage, 12); if (Math.random()<0.45) S.curses.ghost = Math.max(S.curses.ghost, 10); }
  }),
];

export function createState(){
  return {
    running:false,
    t:0,

    tile: 24,   // render scale in pixels per tile
    mapW: 33,
    mapH: 25,
    map: null,

    theme: null,
    loc: "LOC: …",
    obj: "OBJ: …",
    msg: "…",
    msgT: 0,

    difficulty: 1,

    camX:0, camY:0,

    assets: null,

    input: { down: new Set(), just: new Set() },

    hero: null,

    keysOnMap: [],
    totalKeys: 0,
    keysCollected: 0,
    portal: null,

    tanks: [],       // oxygen tanks
    npcs: [],        // peasants
    shrines: [],     // missions/questions
    notes: [],       // lore notes

    enemies: [],
    projectiles: [],
    gibs: [],

    fx: {
      faceFlash: null,
      shock: 0,
      rainT: 0,
      mist: 0,
    },

    buffs: { reveal:0, damage:0, compass:0, calm:0, oxy:0 },
    curses:{ poison:0, grief:0, ghost:0 },

    prompt: { active:false, q:"", a1:"", a2:"", on:null, t:0, max:6.5 },

    mission: { active:false, title:"", desc:"", type:"", prog:0, goal:1 },

    loreSeed: ""
  };
}

function randFloor(map, w, h){
  for (let i=0;i<1200;i++){
    const x = randInt(1,w-2), y = randInt(1,h-2);
    if (map[y][x]===0) return {x,y};
  }
  return {x:1,y:1};
}
function far(map,w,h, fromX, fromY, man=10){
  for (let i=0;i<2500;i++){
    const p = randFloor(map,w,h);
    if (Math.abs(p.x-fromX)+Math.abs(p.y-fromY) >= man) return p;
  }
  return randFloor(map,w,h);
}

export function setMsg(S, text, secs=2.6){
  S.msg = text;
  S.msgT = secs;
}

export function generateLevel(S, name, role){
  // difficulty roll (still fair)
  S.difficulty = pick([1,1,2,2,2,3]); // biased toward 2, fewer 3
  S.theme = pick(THEMES);
  S.loc = `LOC: ${S.theme.name}`;
  S.obj = "OBJ: COLLECT KEYS + ENTER PORTAL";

  S.map = generateBraidedMaze(S.mapW, S.mapH);

  const start = {x:1, y:1};
  const startP = { x: start.x+0.5, y:start.y+0.5 };

  // hero stats
  const baseOxy = 70 + (S.difficulty===1?25 : S.difficulty===2?15 : 10); // baseline 80–95 sec-ish
  const hero = {
    name,
    role,
    x:startP.x, y:startP.y,
    r:0.42,
    speed: (role==="thief"?3.0 : role==="killer"?2.7 : 2.35),
    facing: 0,
    hp: (role==="butcher"?135 : role==="killer"?115 : 95),
    maxHp: (role==="butcher"?135 : role==="killer"?115 : 95),
    oxyMax: baseOxy,
    oxy: baseOxy,
    sanity: 110,
    atkCd: 0,
    suffocate: 0,
    griefBuff: 0
  };
  S.hero = hero;

  // lore seed
  S.loreSeed = `${pick(LORE_SNIPS)} ${pick(LORE_SNIPS)}`;
  setMsg(S, `FILE: ${hero.name}. ${S.loreSeed}`, 4.2);

  // keys + portal
  S.keysCollected = 0;
  S.totalKeys = (S.difficulty===1?3 : S.difficulty===2?4 : 5);
  S.keysOnMap = [];
  for (let i=0;i<S.totalKeys;i++){
    const p = far(S.map,S.mapW,S.mapH, start.x,start.y, 9+i);
    S.keysOnMap.push({ x:p.x, y:p.y, taken:false });
  }
  const port = far(S.map,S.mapW,S.mapH, start.x,start.y, 14);
  S.portal = { x:port.x, y:port.y };

  // oxygen tanks: MORE (you asked)
  // tuned to make oxygen not punishing
  const tankCount = (S.difficulty===1?5 : S.difficulty===2?6 : 7);
  S.tanks = [];
  for (let i=0;i<tankCount;i++){
    const p = far(S.map,S.mapW,S.mapH, start.x,start.y, 6);
    S.tanks.push({ x:p.x, y:p.y, taken:false, amt: 28 + randInt(0,18) });
  }

  // peasants: give power or curse
  const npcCount = 2 + (S.difficulty===3 ? 2 : 1);
  const npcEffects = ["reveal","oxy","poison","grief","compass","calm"];
  S.npcs = [];
  for (let i=0;i<npcCount;i++){
    const p = far(S.map,S.mapW,S.mapH, start.x,start.y, 7);
    S.npcs.push({ x:p.x+0.5, y:p.y+0.5, used:false, effect: pick(npcEffects) });
  }

  // shrines: missions/questions
  const shrineCount = 2 + (S.difficulty>=2?1:0);
  S.shrines = [];
  for (let i=0;i<shrineCount;i++){
    const p = far(S.map,S.mapW,S.mapH, start.x,start.y, 8);
    S.shrines.push({ x:p.x+0.5, y:p.y+0.5, used:false, kind: (Math.random()<0.55?"question":"mission") });
  }

  // notes (story)
  const noteCount = 4 + (S.difficulty===3?2:1);
  S.notes = [];
  for (let i=0;i<noteCount;i++){
    const p = far(S.map,S.mapW,S.mapH, start.x,start.y, 5);
    S.notes.push({ x:p.x, y:p.y, taken:false, text: pick(NOTES) });
  }

  // enemies
  const enemyCount = (S.difficulty===1 ? 2 : S.difficulty===2 ? 3 : 4) + randInt(0,1);
  S.enemies = [];
  for (let i=0;i<enemyCount;i++){
    const p = far(S.map,S.mapW,S.mapH, start.x,start.y, 14);
    S.enemies.push({
      x:p.x+0.5, y:p.y+0.5,
      r:0.42,
      alive:true,
      hp: 38 + S.difficulty*14,
      speed: 2.05 + Math.random()*0.35 + (S.difficulty-1)*0.22,
      dmg: 9 + S.difficulty*3,
      hitCd: 0,
      stun: 0,
      jitter: Math.random()*10,
      facePick: Math.random()<0.5?1:2
    });
  }

  // reset fx/buffs/curses/prompts/missions
  S.projectiles = [];
  S.gibs = [];
  S.fx.faceFlash = null;
  S.fx.shock = 0;
  S.fx.rainT = 0;
  S.fx.mist = 0;

  S.buffs = { reveal:0, damage:0, compass:0, calm:0, oxy:0 };
  S.curses= { poison:0, grief:0, ghost:0 };

  S.prompt = { active:false, q:"", a1:"", a2:"", on:null, t:0, max:6.5 };
  S.mission = { active:false, title:"", desc:"", type:"", prog:0, goal:1 };
}

export function maybeStartPrompt(S){
  if (S.prompt.active) return;
  const q = pick(QUESTIONS);
  S.prompt.active = true;
  S.prompt.q = q.q;
  S.prompt.a1 = q.a1;
  S.prompt.a2 = q.a2;
  S.prompt.on = (c)=>q.on(S,c);
  S.prompt.t = S.prompt.max;
}

export function maybeStartMission(S){
  if (S.mission.active) return;
  const m = pick(MISSIONS)();
  S.mission.active = true;
  S.mission.title = m.title;
  S.mission.desc = m.desc;
  S.mission.type = m.type;
  S.mission.prog = 0;
  S.mission.goal = m.goal;
  S.mission._reward = m.reward;
}

export function completeMission(S){
  if (!S.mission.active) return;
  const r = S.mission._reward;
  S.mission.active = false;
  if (r) r(S);
  setMsg(S, "MISSION COMPLETE. SOMETHING CHANGES.", 3.0);
  // mild “shock”
  S.fx.shock = Math.max(S.fx.shock, 0.75);
}
