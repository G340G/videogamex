// state.js
import { clamp } from "./utils.js";
import { makeSpriteBank } from "./sprites.js";

let SPR = null;

export function createState(){
  return {
    running:false,
    t:0,
    dt: 1/60,

    difficulty: 2,
    theme: null,
    map: null,

    loc: "LOC: ...",
    obj: "OBJ: ...",
    msg: "...",
    msgT: 0,

    hero: null,
    enemies: [],
    projectiles: [],
    keysOnMap: [],
    portal: null,
    npcs: [],

    keysCollected: 0,
    totalKeys: 0,

    input: { down:new Set(), just:new Set() },

    sprites: null, // sprite bank for render
  };
}

export function setMsg(S, text, sec=2.5){
  S.msg = text;
  S.msgT = sec;
}

function pickDifficulty(){
  // weighted: easier most of the time
  const r = Math.random();
  return r < 0.50 ? 1 : (r < 0.88 ? 2 : 3);
}

export function angleToDir8(a){
  // atan2 gives -PI..PI
  const PI = Math.PI;
  const n = (a + PI) / (2 * PI);  // 0..1
  const idx = ((n * 8) | 0) & 7;
  // W, NW, N, NE, E, SE, S, SW
  return ["W","NW","N","NE","E","SE","S","SW"][idx];
}

export function generateLevel(S, name, role){
  SPR = SPR || makeSpriteBank();
  S.sprites = SPR;

  S.t = 0;
  S.difficulty = pickDifficulty();

  // IMPORTANT:
  // This function is called by main.js. Your existing level generation logic
  // (map, enemies, keys, portal, npcs) should already exist in your repo.
  // If you currently build those in another module, keep using it there.
  //
  // In *this file*, we only ensure hero is initialized consistently for sprites.

  const oxyMax = 100;

  // oxygen drain tuned to be survivable (~60s baseline, more with tanks)
  const baseDrain =
    S.difficulty === 1 ? 1.05 :
    S.difficulty === 2 ? 1.25 : 1.45;

  S.hero = {
    name,
    role,

    // world units (tile units) - keep consistent with your code
    x: 2.5,
    y: 2.5,

    // collision radius (in tile units) - slightly smaller to avoid corner-sticking
    r: 0.30,

    speed: role === "thief" ? 3.30 : role === "killer" ? 3.10 : 2.90,

    hp: role === "butcher" ? 120 : role === "killer" ? 108 : 96,
    maxHp: role === "butcher" ? 120 : role === "killer" ? 108 : 96,

    oxy: oxyMax,
    oxyMax,
    oxyDrain: baseDrain,
    suffocate: 0,

    sanity: 100,

    // combat cadence
    atkCd: 0,
    facing: 0,

    // statuses
    reveal: 0,
    poison: 0,
    grief: 0,
    griefBuff: 0,

    // animation state (render uses this)
    animT: 0,
    walkPhase: 0,
    dir8: "S",
    shootFlash: 0,

    // movement hint flags set by main loop
    _mvLen: 0,
    _moving: false,
  };

  S.keysCollected = 0;

  setMsg(S, `WAKE UP, ${name}. YOUR ROLE IS A LIE.`, 3.2);
}

export function updateHeroAnimHints(hero, mx, my){
  const mv = Math.hypot(mx, my);
  hero._mvLen = mv;
  hero._moving = mv > 0.01;
  if (hero._moving) hero.facing = Math.atan2(my, mx);
  hero.dir8 = angleToDir8(hero.facing);
}

export function onHeroShoot(hero){
  // brief pose switch
  hero.shootFlash = 0.12;
}

