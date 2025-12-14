import { clamp } from "./utils.js";

export function createState(){
  const seed = (Math.random()*1e9)|0;
  let s = seed >>> 0;
  const rng = ()=> (s = (s*1664525 + 1013904223)>>>0, (s/4294967296));

  return {
    seed,
    r: rng,

    ui: null,
    muted: false,
    audio: null,

    running: false,
    paused: false,
    t: 0,
    level: 1,

    tileSize: 32,
    mapW: 31,
    mapH: 21,
    map: [],
    theme: { name:"—", floor:"#111", wall:"#222", noise:0.2, perk:"" },

    role: "thief",
    name: "SUBJECT",
    player: {
      x: 0, y: 0,
      vx: 0, vy: 0,
      facing: 0,
      speed: 165,
      sprint: 1.35,

      hp: 100, hpMax: 100,
      sanity: 100, sanityMax: 100,

      // oxygen lasts at least ~60s baseline
      oxyTimerMax: 70,
      oxyTimer: 70,
      oxy: 100,

      ammo: 0,
      ranged: false,

      cooldown: 0,
      dashCd: 0,
      invuln: 0,
    },

    // difficulty (easier baseline)
    difficulty: {
      oxygenDrain: 1.0,     // 1x baseline (we tuned for ~60-70s)
      enemyMult: 1.0,
      spawnExtra: 0,
      keyCount: 3,
    },

    escalation: 0, // grows with noise/events

    // collectibles / objects
    pickups: [],
    entities: [],
    bullets: [],
    decals: [],

    // hallucinations / overlays
    effects: [],

    // key win condition
    keysTotal: 3,
    keysFound: 0,

    // mission/prompt (still used for peasants + lore)
    mission: { active:false, completed:false, type:"", title:"", desc:"", goal:1, progress:0, data:null },
    prompt: { active:false, text:"", a:"", b:"", timer:0, onChoose:null },

    secretsFound: 0,
  };
}

export function configureRun(state, {name, role}){
  state.name = (name && name.trim()) ? name.trim().slice(0,16).toUpperCase() : "SUBJECT";
  state.role = role;

  // randomized difficulty each run (but *not* brutal)
  const r = state.r();
  const diffTier = r < 0.33 ? 0 : r < 0.75 ? 1 : 2;

  state.difficulty.spawnExtra = diffTier;          // 0..2
  state.difficulty.enemyMult  = 0.95 + diffTier*0.12;
  state.difficulty.oxygenDrain = 0.95 + diffTier*0.12; // still ~60s+
  state.difficulty.keyCount   = 3 + diffTier;      // 3..5
  state.keysTotal = state.difficulty.keyCount;
  state.keysFound = 0;

  // role stats
  const p = state.player;
  p.hpMax = 100; p.hp = 100;
  p.sanityMax = 100; p.sanity = 100;
  p.oxyTimerMax = 70; p.oxyTimer = 70;

  p.ranged = false;
  p.ammo = 0;

  if(role === "thief"){
    p.speed = 175;
    p.sprint = 1.42;
    p.hpMax = 90; p.hp = 90;
  } else if(role === "killer"){
    p.speed = 165;
    p.sprint = 1.35;
    p.hpMax = 100; p.hp = 100;
  } else { // butcher
    p.speed = 155;
    p.sprint = 1.30;
    p.hpMax = 120; p.hp = 120;
  }
}

export function setLog(state, msg){
  if(state.ui?.log) state.ui.log.textContent = msg;
}

export function updateBars(state){
  const p = state.player;
  p.oxy = clamp((p.oxyTimer/p.oxyTimerMax)*100, 0, 100);

  if(state.ui?.barOxy){
    state.ui.barOxy.style.width = `${p.oxy}%`;
  }
  if(state.ui?.barSan){
    const s = clamp((p.sanity/p.sanityMax)*100, 0, 100);
    state.ui.barSan.style.width = `${s}%`;
  }
  if(state.ui?.stats){
    state.ui.stats.textContent = `VIT: ${Math.max(0, Math.ceil(p.hp))}%`;
  }
  if(state.ui?.ammo){
    state.ui.ammo.textContent = p.ranged ? `AMMO: ${p.ammo}` : `AMMO: —`;
  }
}

export function personalizeText(state, s){
  return (s||"")
    .replaceAll("{NAME}", state.name)
    .replaceAll("{ROLE}", state.role.toUpperCase());
}

export function setTheme(state){
  const themes = [
    { key:"asylum",   name:"ASYLUM WARD",  floor:"#121213", wall:"#2a2d33", noise:0.10, perk:"White tiles that remember screaming." },
    { key:"catacomb", name:"CATACOMBS",    floor:"#0f0c0a", wall:"#241610", noise:0.22, perk:"Bone dust in the air." },
    { key:"prison",   name:"PRISON BLOCK", floor:"#0b0b0b", wall:"#1c2a2a", noise:0.14, perk:"Bars hum with old prayers." },
    { key:"cemetery", name:"CEMETERY",     floor:"#090a08", wall:"#1b1f13", noise:0.18, perk:"Graves rearrange themselves." },
    { key:"dungeon",  name:"DUNGEON",      floor:"#0a0a0c", wall:"#1f1f28", noise:0.16, perk:"Chains count your steps." },
  ];
  state.theme = themes[(state.r()*themes.length)|0];
}


