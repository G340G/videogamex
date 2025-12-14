import { makeRng, clamp, dist, pick, randInt } from "./utils.js";
import { THEMES, generateBraidedMaze, randomFloor } from "./map.js";
import { makeHero, makeEnemy, makePeasant, tryMoveCircle, heroAttack } from "./entities.js";
import { render } from "./render.js";
import { createAudio } from "./audio.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });

const uiLoc = document.getElementById("hud-loc");
const uiObj = document.getElementById("hud-obj");
const uiMsg = document.getElementById("hud-msg");
const uiKeys = document.getElementById("hud-keys");

const barOxy = document.getElementById("bar-oxy");
const barSan = document.getElementById("bar-san");

const menu = document.getElementById("menu");
const btnStart = document.getElementById("btnStart");
const nameInput = document.getElementById("nameInput");
const roleSelect = document.getElementById("roleSelect");

const TILE_PX = 32;
const MAP_W = 31; // odd
const MAP_H = 23; // odd

const state = {
  running: false,
  t: 0,
  rng: makeRng((Math.random() * 1e9) | 0),
  theme: THEMES[0],
  map: null,
  tilePx: TILE_PX,
  baseFov: 7.5, // tiles
  heroFacing: 0,

  hero: null,
  enemies: [],
  npcs: [],
  keysOnMap: [],
  portal: null,
  totalKeys: 0,
  keysCollected: 0,

  // difficulty
  difficulty: 1,     // 1..3 randomized
  enemyCount: 1,
  msgTimer: 0,

  input: {
    down: new Set(),
    justPressed: new Set()
  },

  audio: null,
};

function setMsg(s, ttl = 2.2) {
  uiMsg.textContent = s;
  state.msgTimer = ttl;
}

function bindInput() {
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    state.input.down.add(e.code);
    state.input.justPressed.add(e.code);
  }, { passive: true });

  window.addEventListener("keyup", (e) => {
    state.input.down.delete(e.code);
  }, { passive: true });

  // keep focus stable
  window.addEventListener("blur", () => {
    state.input.down.clear();
    state.input.justPressed.clear();
  });
}
bindInput();

// IMPORTANT: clicking inside the name input must NOT start the game
nameInput.addEventListener("pointerdown", (e) => e.stopPropagation());
nameInput.addEventListener("mousedown", (e) => e.stopPropagation());
nameInput.addEventListener("keydown", (e) => e.stopPropagation());

// start ONLY via button
btnStart.addEventListener("click", async () => {
  const nm = (nameInput.value || "SUBJECT").trim().slice(0, 16);
  const role = roleSelect.value;

  state.audio = state.audio || createAudio();
  await state.audio.resume();

  startRun(nm, role);
});

function startRun(name, role) {
  state.running = true;
  menu.style.display = "none";

  state.hero = makeHero(role, name);

  // randomized difficulty each run
  state.difficulty = randInt(state.rng, 1, 3); // 1 easy..3 harder
  setMsg(`RUN SEED: ???  | DIFFICULTY: ${state.difficulty}`);

  generateLevel();
  requestAnimationFrame(loop);
}

function generateLevel() {
  state.t = 0;
  state.keysCollected = 0;

  state.theme = pick(state.rng, THEMES);
  uiLoc.textContent = `LOC: ${state.theme.name}`;
  uiObj.textContent = `OBJ: COLLECT KEYS`;

  state.map = generateBraidedMaze(state.rng, MAP_W, MAP_H);

  // place hero
  state.hero.x = 1.5;
  state.hero.y = 1.5;

  // oxygen lasts at least 60s at normal drain
  state.hero.oxyMax = 100;
  state.hero.oxy = 100;

  // keys
  const keyCount = clamp(3 + state.difficulty + randInt(state.rng, 0, 2), 3, 7);
  state.totalKeys = keyCount;
  state.keysOnMap = [];

  for (let i = 0; i < keyCount; i++) {
    const p = randomFloor(state.rng, state.map, { x: 1, y: 1, d: 12 });
    state.keysOnMap.push({ x: p.x, y: p.y, taken: false });
  }

  // portal far away
  state.portal = randomFloor(state.rng, state.map, { x: 1, y: 1, d: 18 });

  // enemies: more with difficulty, but not unfair
  state.enemyCount = clamp(1 + state.difficulty, 1, 4);
  state.enemies = [];
  for (let i = 0; i < state.enemyCount; i++) {
    const p = randomFloor(state.rng, state.map, { x: 1, y: 1, d: 16 });
    const e = makeEnemy(p.x + 0.5, p.y + 0.5);
    // tune per difficulty
    e.speed += 0.25 * (state.difficulty - 1);
    e.hp += 8 * (state.difficulty - 1);
    state.enemies.push(e);
  }

  // psych peasants (helpful weirdness)
  state.npcs = [];
  const effects = ["reveal", "poison", "oxy", "calm"];
  const npcCount = 2 + randInt(state.rng, 0, 2);
  for (let i = 0; i < npcCount; i++) {
    const p = randomFloor(state.rng, state.map, { x: 1, y: 1, d: 8 });
    state.npcs.push(makePeasant(p.x + 0.5, p.y + 0.5, pick(state.rng, effects)));
  }

  // lore injection
  const lines = [
    `${state.hero.name}, you wake up in a place that uses your thoughts as building material.`,
    `They called you ${state.hero.role.toUpperCase()}. They wrote it into the walls.`,
    `Collect the KEYS. The portal is real. The exit is not.`
  ];
  setMsg(lines[(state.rng() * lines.length) | 0], 4.0);

  updateHUD();
}

function updateHUD() {
  const h = state.hero;
  barOxy.style.width = `${clamp(h.oxy / h.oxyMax, 0, 1) * 100}%`;
  barSan.style.width = `${clamp(h.sanity / 120, 0, 1) * 100}%`;
  uiKeys.textContent = `KEYS: ${state.keysCollected}/${state.totalKeys}`;
}

function applyPeasantEffect(effect) {
  const h = state.hero;
  if (effect === "reveal") {
    h.reveal = Math.max(h.reveal, 12);
    setMsg(`A peasant smiles: "I CAN REMOVE THE FOG, ${h.name}."`, 3.2);
  } else if (effect === "poison") {
    h.poison = Math.max(h.poison, 10);
    setMsg(`He offers poison: "DRINK. SEE THE MAZE'S TRUE COLORS."`, 3.2);
  } else if (effect === "oxy") {
    h.oxy = clamp(h.oxy + 45, 0, h.oxyMax);
    setMsg(`OXYGEN TANK FOUND. Breathe slower.`, 2.8);
  } else {
    h.sanity = clamp(h.sanity + 22, 0, 120);
    setMsg(`He whispers: "CALM IS A KNIFE. HOLD IT."`, 2.8);
  }
  state.audio?.blip?.(0.8);
  updateHUD();
}

function update(dt) {
  const h = state.hero;

  // message timer fade
  if (state.msgTimer > 0) {
    state.msgTimer -= dt;
    if (state.msgTimer <= 0) uiMsg.textContent = "...";
  }

  // timers
  h.attackCd = Math.max(0, h.attackCd - dt);
  h.reveal = Math.max(0, h.reveal - dt);
  h.poison = Math.max(0, h.poison - dt);
  h.grief  = Math.max(0, h.grief - dt);

  // oxygen drain: >= 60s baseline
  // baseline drain 100 / 60 per sec = 1.666.. per sec
  const sprint = state.input.down.has("ShiftLeft") || state.input.down.has("ShiftRight");
  const drain = sprint ? 2.6 : 1.65; // still survivable; sprint costs extra
  h.oxy = Math.max(0, h.oxy - drain * dt);

  if (h.oxy <= 0) {
    // suffocation affects sanity + speed, but not instant death
    h.sanity = Math.max(0, h.sanity - 10 * dt);
  } else {
    // slow sanity recovery in safe moments
    h.sanity = Math.min(120, h.sanity + 2.2 * dt);
  }

  // movement (smooth)
  let mx = 0, my = 0;
  if (state.input.down.has("KeyW") || state.input.down.has("ArrowUp")) my -= 1;
  if (state.input.down.has("KeyS") || state.input.down.has("ArrowDown")) my += 1;
  if (state.input.down.has("KeyA") || state.input.down.has("ArrowLeft")) mx -= 1;
  if (state.input.down.has("KeyD") || state.input.down.has("ArrowRight")) mx += 1;

  // normalize
  const mLen = Math.hypot(mx, my) || 1;
  mx /= mLen; my /= mLen;

  let spd = h.speed;
  if (sprint) spd *= 1.25;
  if (h.oxy <= 0) spd *= 0.78;

  const dx = mx * spd * dt;
  const dy = my * spd * dt;
  tryMoveCircle(state.map, h, dx, dy);

  // facing (based on movement, fallback keep last)
  if (Math.abs(mx) + Math.abs(my) > 0.01) {
    state.heroFacing = Math.atan2(my, mx);
  }

  // attack
  if (state.input.justPressed.has("Space")) {
    const hit = heroAttack(state);
    if (hit) {
      setMsg(`${h.name} strikes. The air remembers.`, 1.8);
      state.audio?.blip?.(0.6);
    }
  }

  // interact with peasants (E)
  if (state.input.justPressed.has("KeyE")) {
    for (const n of state.npcs) {
      if (n.used) continue;
      if (dist(n.x, n.y, h.x, h.y) < 1.0) {
        n.used = true;
        applyPeasantEffect(n.effect);
        break;
      }
    }
  }

  // pick keys
  for (const k of state.keysOnMap) {
    if (k.taken) continue;
    if (dist(k.x + 0.5, k.y + 0.5, h.x, h.y) < 0.75) {
      k.taken = true;
      state.keysCollected++;
      setMsg(`KEY ACQUIRED (${state.keysCollected}/${state.totalKeys}).`, 2.0);
      state.audio?.blip?.(0.9);
      updateHUD();

      if (state.keysCollected >= state.totalKeys) {
        uiObj.textContent = `OBJ: ENTER PORTAL`;
        setMsg(`The portal recognizes your name: ${h.name}.`, 3.2);
      }
    }
  }

  // enemies chase but not “hard block”
  // since maze is braided (loops), you can always route around
  let nearestEnemyDist = 99;

  for (const e of state.enemies) {
    if (!e.alive) continue;

    e.stun = Math.max(0, e.stun - dt);
    e.hitCd = Math.max(0, e.hitCd - dt);

    const d = dist(e.x, e.y, h.x, h.y);
    nearestEnemyDist = Math.min(nearestEnemyDist, d);

    // if far, drift slightly (not perfect homing)
    const hear = sprint ? 7.0 : 5.0;
    if (e.stun > 0) continue;

    if (d < hear) {
      const vx = (h.x - e.x) / Math.max(0.001, d);
      const vy = (h.y - e.y) / Math.max(0.001, d);

      // “avoid hard blocking”: if too close, enemy slows and jitters sideways
      let s = e.speed;
      if (d < 1.2) s *= 0.55;

      // slight lateral wobble
      const wob = (Math.sin(state.t * 0.02 + e.x * 2.1) * 0.22);
      const lx = -vy * wob;
      const ly = vx * wob;

      tryMoveCircle(state.map, e, (vx + lx) * s * dt, (vy + ly) * s * dt);
    }

    // damage hero if touching
    if (d < 0.65 && e.hitCd <= 0) {
      e.hitCd = 0.55;
      h.hp = Math.max(0, h.hp - e.dmg);
      h.grief = Math.max(h.grief, 8);

      setMsg(`IT TOUCHES YOU, ${h.name}.`, 2.2);
      state.audio?.blip?.(1.0);
    }
  }

  // fear-driven audio
  const fear = clamp(1 - nearestEnemyDist / 7, 0, 1);
  state.audio?.setFear?.(fear);

  // win: portal after keys
  if (state.portal && state.keysCollected >= state.totalKeys) {
    if (dist(state.portal.x + 0.5, state.portal.y + 0.5, h.x, h.y) < 0.9) {
      win();
    }
  }

  // lose (not instant oxygen death; only if HP gone)
  if (h.hp <= 0) {
    lose();
  }

  updateHUD();
}

function win() {
  state.running = false;
  setMsg(`SEQUENCE COMPLETE. ${state.hero.name} IS UPLOADED.`, 6);
  alert(`YOU ESCAPED.\n\nNAME: ${state.hero.name}\nROLE: ${state.hero.role.toUpperCase()}\nDIFFICULTY: ${state.difficulty}`);
  location.reload();
}

function lose() {
  state.running = false;
  alert(`SUBJECT LOST.\n\nTHE MAZE KEEPS YOUR NAME.`);
  location.reload();
}

let last = performance.now();
function loop(now) {
  if (!state.running) return;

  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  state.t++;
  update(dt);
  render(ctx, state);

  // clear justPressed each frame
  state.input.justPressed.clear();
  requestAnimationFrame(loop);
}

