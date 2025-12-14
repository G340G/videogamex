import { clamp, pick } from "./utils.js";
import { randomFloorCell } from "./map.js";
import { personalizeText, setLog } from "./state.js";

const CODE_TEXTS = [
  "THE CODE IS {CODE}. IT IS ALWAYS TRUE.",
  "WRITE {CODE} INTO THE ALTAR.",
  "THE NUMBER {CODE} IS A LIE TELL IT ANYWAY.",
  "REMEMBER: {CODE}. FORGET: YOUR NAME."
];

export function generatePuzzle(state){
  const r = state.r;

  // real code
  const real = (100 + (r()*900|0)).toString();
  state.puzzle.code = real;
  state.puzzle.solved = false;

  // pick terminal + code location
  const start = {x:1,y:1,d:10};
  const term = randomFloorCell(state, {x:start.x,y:start.y,d:18});
  const code = randomFloorCell(state, {x:term.x,y:term.y,d:10});

  state.puzzle.termX = (term.x + 0.5) * state.tileSize;
  state.puzzle.termY = (term.y + 0.5) * state.tileSize;
  state.puzzle.codeX = (code.x + 0.5) * state.tileSize;
  state.puzzle.codeY = (code.y + 0.5) * state.tileSize;

  // “lies” chance (illusion of choice)
  const lieChance = clamp(state.difficulty.puzzleCorrupt + state.escalation*0.05, 0, 0.80);
  state.puzzle.lies = r() < lieChance;

  // place a readable decal text (render.js draws it)
  const shown = state.puzzle.lies
    ? ((100 + (r()*900|0)).toString())
    : real;

  state.decals.push({
    type:"code",
    x: state.puzzle.codeX,
    y: state.puzzle.codeY,
    code: shown,
    line: personalizeText(state,
      pick(r, CODE_TEXTS).replace("{CODE}", shown)
    )
  });
}

export function canOpenTerminal(state){
  const p = state.player;
  const dx = state.puzzle.termX - p.x;
  const dy = state.puzzle.termY - p.y;
  return Math.hypot(dx,dy) < 52;
}

export function tryUnlock(state, guess){
  if (state.puzzle.solved) return true;

  const ok = guess === state.puzzle.code;
  if (ok){
    state.puzzle.solved = true;
    setLog(state, "ACCESS GRANTED. EXIT UNLOCKED.");
  } else {
    setLog(state, "ERROR. INVALID CREDENTIALS.");
    // punishment: small escalation + sanity tick
    state.escalation += 0.4;
    state.player.sanity = clamp(state.player.sanity - 6, 0, state.player.sanityMax);
  }
  return ok;
}

