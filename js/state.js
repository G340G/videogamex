import { makeRng, randInt, pick, clamp, dist } from "./utils.js";
import { THEMES, generateBraidedMaze, randomFloor, isWall } from "./map.js";
import { makeHero, makeEnemy, makeProjectile, makePeasant, tryMoveCircle } from "./entities.js";

export function createState(seed = ((Math.random()*1e9)|0)) {
  return {
    rng: makeRng(seed),
    seed,
    t: 0,
    running: false,

    tilePx: 32,
    mapW: 31,
    mapH: 23,
    map: null,
    theme: THEMES[0],
    baseFov: 7.2,

    hero: null,
    enemies: [],
    npcs: [],
    projectiles: [],

    keysOnMap: [],
    totalKeys: 0,
    keysCollected: 0,
    portal: null,

    difficulty: 1,
    level: 1,

    msg: "...",
    obj: "--",
    loc: "--",
    msgT: 0,

    input: { down: new Set(), just: new Set() }
  };
}

export function setMsg(S, txt, ttl = 2.4) {
  S.msg = txt;
  S.msgT = ttl;
}

export function generateLevel(S, name, role) {
  const rng = S.rng;

  S.t = 0;
  S.difficulty = randInt(rng, 1, 3);

  S.theme = pick(rng, THEMES);
  S.loc = `LOC: ${S.theme.name}`;

  S.map = generateBraidedMaze(rng, S.mapW, S.mapH);

  // hero
  S.hero = makeHero(role, name);
  S.hero.x = 1.5;
  S.hero.y = 1.5;

  // oxygen tuning by difficulty (still not “frenetic”)
  // Easy: slower drain, Hard: faster drain
  S.hero.oxyMax = 100;
  S.hero.oxy = 100;

  // keys (make win achievable)
  S.keysCollected = 0;
  const keyCount = clamp(3 + S.difficulty + randInt(rng, 0, 1), 3, 6);
  S.totalKeys = keyCount;

  S.keysOnMap = [];
  for (let i=0;i<keyCount;i++){
    const p = randomFloor(rng, S.map, {x:1,y:1,d:10});
    S.keysOnMap.push({x:p.x, y:p.y, taken:false});
  }

  // portal far
  S.portal = randomFloor(rng, S.map, {x:1,y:1,d:18});

  // peasants (REQUIRED)
  const effects = ["reveal","oxy","poison","grief"];
  const npcCount = 2 + randInt(rng, 0, 2);
  S.npcs = [];
  for (let i=0;i<npcCount;i++){
    const p = randomFloor(rng, S.map, {x:1,y:1,d:7});
    S.npcs.push(makePeasant(p.x+0.5, p.y+0.5, pick(rng, effects)));
  }

  // enemies
  const enemyCount = clamp(1 + S.difficulty + (S.level>1?1:0), 1, 5);
  S.enemies = [];
  for (let i=0;i<enemyCount;i++){
    const p = randomFloor(rng, S.map, {x:1,y:1,d:16});
    S.enemies.push(makeEnemy(p.x+0.5, p.y+0.5, S.difficulty));
  }

  S.projectiles = [];

  // objective
  S.obj = "OBJ: COLLECT KEYS → PORTAL";

  const lore = [
    `${name} is recorded as ${role.toUpperCase()}. The walls repeat it.`,
    `The dungeon wants your name. Don’t give it your lungs.`,
    `A peasant is watching. It may trade you air for truth.`,
    `Keys hum in the dark. The portal only opens for the counted.`,
  ];
  setMsg(S, pick(rng, lore), 4.0);
}
