import { clamp, hashStr, rng } from "./utils.js";
import { THEMES } from "./map.js";

export function createState(){
  return {
    // runtime
    running:false,
    paused:false,
    muted:false,
    t:0,
    dt:0,
    seed: (Math.random()*1e9)|0,
    r: null,

    // run setup
    name:"SUBJECT",
    role:"thief",
    difficulty: {
      label:"…",
      enemyMult:1.0,
      puzzleCorrupt:0.0,
      oxygenDrain:1.0,
      missionHard:0.0,
      spawnExtra:0
    },

    // world
    level:1,
    themeKey:"asylum",
    theme: THEMES.asylum,
    map:null, // filled by map.js
    tiles:null,
    w:0, h:0,
    tileSize:32,

    // player
    player:{
      x:0, y:0,
      vx:0, vy:0,
      r:10, // radius for collision
      speed:140,
      sprint:1.45,
      hp:100, hpMax:100,
      sanity:100, sanityMax:100,
      oxy:100, oxyMax:100, // oxygen percent
      oxyTimer:60.0, // seconds baseline (>= 60s), refilled by tanks
      oxyTimerMax:60.0,
      ammo:0,
      cooldown:0,
      dashCd:0,
      invuln:0,
      damage:18,
      ranged:false,
      facing:0
    },

    // entities
    entities:[],   // enemies
    bullets:[],    // projectiles
    pickups:[],    // items, chests, oxygen, ammo, perks
    decals:[],     // codes, notes, gore
    effects:[],    // hallucinations, flashes, screen stuff

    // progression
    kills:0,
    escalation:0,          // goes up on killing
    enemySpawnRate:0.0,    // grows with escalation
    secretsFound:0,

    // missions and prompts
    mission:{
      active:false,
      title:"",
      desc:"",
      type:"",
      progress:0,
      goal:1,
      data:null,
      completed:false
    },
    prompt:{
      active:false,
      text:"",
      a:"",
      b:"",
      timer:0,
      onChoose:null
    },
    puzzle:{
      code:"000",
      solved:false,
      termX:0, termY:0,
      codeX:0, codeY:0,
      lies:false
    },

    // UI hooks (populated in main.js)
    ui:null,

    // audio handle (audio.js)
    audio:null
  };
}

export function configureRun(state, {name, role}){
  state.name = (name && name.trim()) ? name.trim().slice(0,16).toUpperCase() : "SUBJECT";
  state.role = role;

  // seeded RNG uses name+role to feel “personal”
  state.seed = (hashStr(state.name + "::" + role) ^ ((Math.random()*1e9)|0)) >>> 0;
  state.r = rng(state.seed);

  // randomized difficulty per run
  const r = state.r;
  const roll = r();
  const d = state.difficulty;

  if (roll < 0.25){
    d.label = "FRAIL SIGNAL";
    d.enemyMult = 0.95;
    d.oxygenDrain = 0.90;
    d.puzzleCorrupt = 0.10;
    d.missionHard = 0.10;
    d.spawnExtra = 0;
  } else if (roll < 0.60){
    d.label = "NORMAL DECAY";
    d.enemyMult = 1.10;
    d.oxygenDrain = 1.00;
    d.puzzleCorrupt = 0.18;
    d.missionHard = 0.20;
    d.spawnExtra = 1;
  } else if (roll < 0.85){
    d.label = "BLACKOUT LOOP";
    d.enemyMult = 1.25;
    d.oxygenDrain = 1.10;
    d.puzzleCorrupt = 0.28;
    d.missionHard = 0.35;
    d.spawnExtra = 2;
  } else {
    d.label = "CULT HOSTILE";
    d.enemyMult = 1.40;
    d.oxygenDrain = 1.20;
    d.puzzleCorrupt = 0.40;
    d.missionHard = 0.50;
    d.spawnExtra = 3;
  }

  // role stats
  const p = state.player;
  p.hpMax = 100;
  p.sanityMax = 100;
  p.oxyTimerMax = 60.0;     // >= 60 seconds baseline
  p.oxyTimer = p.oxyTimerMax;
  p.ammo = 0;
  p.ranged = false;
  p.damage = 18;
  p.speed = 140;
  p.sprint = 1.45;

  if (role === "thief"){
    p.speed = 160;
    p.damage = 14;
    p.ranged = false;
    p.ammo = 0;
  } else if (role === "killer"){
    p.speed = 145;
    p.damage = 22;
    p.ranged = false;
    p.sanityMax = 90;
  } else if (role === "butcher"){
    p.speed = 130;
    p.damage = 28;
    p.ranged = false;
    // butcher gets more oxygen tanks (handled in pickups spawn)
    p.oxyTimerMax = 75.0;
    p.oxyTimer = p.oxyTimerMax;
    p.hpMax = 115;
  }

  p.hp = p.hpMax;
  p.sanity = p.sanityMax;
  p.oxy = 100;
  p.cooldown = 0;
  p.dashCd = 0;
  p.invuln = 0;

  state.escalation = 0;
  state.kills = 0;
  state.enemySpawnRate = 0;
  state.secretsFound = 0;
}

export function setTheme(state){
  const keys = Object.keys(THEMES);
  const r = state.r;
  const themeKey = keys[(r()*keys.length)|0];
  state.themeKey = themeKey;
  state.theme = THEMES[themeKey];
}

export function personalizeText(state, text){
  // simple personalization tokens
  return text
    .replaceAll("{NAME}", state.name)
    .replaceAll("{ROLE}", state.role.toUpperCase())
    .replaceAll("{LOC}", state.theme?.name ?? "UNKNOWN");
}

export function setLog(state, msg){
  if (!state.ui) return;
  state.ui.log.textContent = msg;
  state.ui.log.style.opacity = "1";
  clearTimeout(state.ui._logTO);
  state.ui._logTO = setTimeout(()=> state.ui.log.style.opacity = "0.65", 1800);
}

export function updateBars(state){
  if (!state.ui) return;
  const p = state.player;
  state.ui.barOxy.style.width = `${clamp(p.oxy,0,100)}%`;
  state.ui.barSan.style.width = `${clamp((p.sanity/p.sanityMax)*100,0,100)}%`;

  state.ui.stats.textContent =
    `${state.name} / ${state.role.toUpperCase()} · LVL ${state.level} · DIFF: ${state.difficulty.label}`;

  // ammo / cooldown readout
  const ammo = p.ranged ? `AMMO: ${p.ammo}` : `BLADE: READY`;
  state.ui.ammo.textContent = `${ammo} · KILLS: ${state.kills}`;
}

