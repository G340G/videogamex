// sprites.js
// Procedural pixel-art protagonists (no external images).
// Exports: makeSpriteBank()

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

function put(g, x, y, col, a = 1) {
  g.globalAlpha = a;
  g.fillStyle = col;
  g.fillRect(x | 0, y | 0, 1, 1);
  g.globalAlpha = 1;
}

function drawMask(g, mask, colors) {
  // mask is array of strings (same width), chars:
  // '.' empty, 'B' body, 'D' detail, 'E' eye, 'S' shadow, 'G' gore
  for (let y = 0; y < mask.length; y++) {
    const row = mask[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === ".") continue;
      if (ch === "B") put(g, x, y, colors.body);
      else if (ch === "D") put(g, x, y, colors.detail);
      else if (ch === "E") put(g, x, y, colors.eye);
      else if (ch === "S") put(g, x, y, colors.shadow, 0.95);
      else if (ch === "G") put(g, x, y, colors.gore);
    }
  }
}

function mirrorMask(mask) {
  return mask.map(r => r.split("").reverse().join(""));
}

function roleColors(role) {
  // Lo-fi grim palette + saturated accents.
  if (role === "thief") {
    return { body:"#243028", detail:"#496154", eye:"#ff2a5c", shadow:"#070808", gore:"#7a0d1c" };
  }
  if (role === "killer") {
    return { body:"#1d232a", detail:"#5b656f", eye:"#ffd45a", shadow:"#07090b", gore:"#8a0e22" };
  }
  // butcher
  return { body:"#2a1f20", detail:"#6a3a3a", eye:"#ff2a2a", shadow:"#080606", gore:"#b10f2f" };
}

// 12x12 base masks (RIGHT-facing). We mirror for LEFT.
// These are intentionally “character silhouettes”, not icons on a square.
const MASKS = {
  thief_idle_r: [
    "....SSSS....",
    "...SBBBBS...",
    "..SBDDBBBS..",
    "..SBEBDBBS..",
    "..SBBBBBBS..",
    "...SBBBBS...",
    "....SBBBS...",
    "..DD.SB.S...",
    "..DD.S..S...",
    ".....S..S...",
    "....S....S..",
    "...S......S."
  ],
  thief_walk_r: [
    "....SSSS....",
    "...SBBBBS...",
    "..SBDDBBBS..",
    "..SBEBDBBS..",
    "..SBBBBBBS..",
    "...SBBBBS...",
    "....SBBBS...",
    "..DD.SB.S...",
    ".DD..S..S...",
    ".....S..S...",
    "...S....S...",
    "..S......S.."
  ],
  thief_shoot_r: [
    "....SSSS....",
    "...SBBBBS...",
    "..SBDDBBBS..",
    "..SBEBDBBS..",
    "..SBBBBBBS..",
    "...SBBBBS...",
    "...DSBBBS...",
    "..DDDSB.S...",
    "..DD.S..S...",
    ".....S..S...",
    "....S....S..",
    "...S......S."
  ],

  killer_idle_r: [
    "....SSSS....",
    "...SBBBBS...",
    "..SBBBBBBS..",
    "..SBEBDDBS..",
    "..SBBBBBBS..",
    "...SBBBBS...",
    "....SBBBS...",
    "..DD.SB.S...",
    "..DD.S..S...",
    "...G.S..S...",
    "....S....S..",
    "...S......S."
  ],
  killer_walk_r: [
    "....SSSS....",
    "...SBBBBS...",
    "..SBBBBBBS..",
    "..SBEBDDBS..",
    "..SBBBBBBS..",
    "...SBBBBS...",
    "....SBBBS...",
    ".DD..SB.S...",
    "..DD.S..S...",
    "...G.S..S...",
    "...S....S...",
    "..S......S.."
  ],
  killer_shoot_r: [
    "....SSSS....",
    "...SBBBBS...",
    "..SBBBBBBS..",
    "..SBEBDDBS..",
    "..SBBBBBBS..",
    "...SBBBBS...",
    "...DSBBBS...",
    "..DDDSB.S...",
    "..DD.S..S...",
    "...G.S..S...",
    "....S....S..",
    "...S......S."
  ],

  butcher_idle_r: [
    "....SSSS....",
    "...SBBBBS...",
    "..SBDDBBBS..",
    "..SBEBDDBS..",
    "..SBBBBBBS..",
    "...SBBBBS...",
    "....SBBBS...",
    "..DDDSB.S...",
    "..DD.S..S...",
    "..G..S..S...",
    "....S....S..",
    "...S......S."
  ],
  butcher_walk_r: [
    "....SSSS....",
    "...SBBBBS...",
    "..SBDDBBBS..",
    "..SBEBDDBS..",
    "..SBBBBBBS..",
    "...SBBBBS...",
    "....SBBBS...",
    "..DDDSB.S...",
    ".DD..S..S...",
    "..G..S..S...",
    "...S....S...",
    "..S......S.."
  ],
  butcher_shoot_r: [
    "....SSSS....",
    "...SBBBBS...",
    "..SBDDBBBS..",
    "..SBEBDDBS..",
    "..SBBBBBBS..",
    "...SBBBBS...",
    "...DDBBBS...",
    "..DDDDSB.S..",
    "..DD.S..S...",
    "..G..S..S...",
    "....S....S..",
    "...S......S."
  ],
};

function renderMask(mask, colors) {
  const c = makeCanvas(12, 12);
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  drawMask(g, mask, colors);
  return c;
}

// “tilt” creates convincing directional variants without cheap rotation.
function tilt(src, dx, dy, colors) {
  const c = makeCanvas(12, 12);
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;

  g.clearRect(0, 0, 12, 12);
  g.drawImage(src, dx, dy);

  // smear a touch (CRT motion / PS1 frame blend vibe)
  g.globalAlpha = 0.28;
  g.drawImage(src, dx + (dx ? -Math.sign(dx) : 0), dy);
  g.drawImage(src, dx, dy + (dy ? -Math.sign(dy) : 0));
  g.globalAlpha = 1;

  // occasional “eye glitch” pixel
  if (Math.random() < 0.35) {
    g.globalAlpha = 0.7;
    g.fillStyle = colors.eye;
    g.fillRect(6 + ((Math.random()*3)|0)-1, 4 + ((Math.random()*3)|0)-1, 1, 1);
    g.globalAlpha = 1;
  }
  return c;
}

function buildRole(role) {
  const colors = roleColors(role);

  const idleR  = renderMask(MASKS[`${role}_idle_r`], colors);
  const walkR  = renderMask(MASKS[`${role}_walk_r`], colors);
  const shootR = renderMask(MASKS[`${role}_shoot_r`], colors);

  const idleL  = renderMask(mirrorMask(MASKS[`${role}_idle_r`]), colors);
  const walkL  = renderMask(mirrorMask(MASKS[`${role}_walk_r`]), colors);
  const shootL = renderMask(mirrorMask(MASKS[`${role}_shoot_r`]), colors);

  const E = { idle: idleR, walk: walkR, shoot: shootR };
  const W = { idle: idleL, walk: walkL, shoot: shootL };

  return {
    E,
    W,
    NE: {
      idle:  tilt(idleR, 0, -1, colors),
      walk:  tilt(walkR, 1, -1, colors),
      shoot: tilt(shootR, 1, -1, colors),
    },
    SE: {
      idle:  tilt(idleR, 0, 1, colors),
      walk:  tilt(walkR, 1, 1, colors),
      shoot: tilt(shootR, 1, 1, colors),
    },
    NW: {
      idle:  tilt(idleL, 0, -1, colors),
      walk:  tilt(walkL, -1, -1, colors),
      shoot: tilt(shootL, -1, -1, colors),
    },
    SW: {
      idle:  tilt(idleL, 0, 1, colors),
      walk:  tilt(walkL, -1, 1, colors),
      shoot: tilt(shootL, -1, 1, colors),
    },
    N: {
      idle:  tilt(idleR, 0, -2, colors),
      walk:  tilt(walkR, 0, -2, colors),
      shoot: tilt(shootR, 0, -2, colors),
    },
    S: {
      idle:  tilt(idleR, 0, 2, colors),
      walk:  tilt(walkR, 0, 2, colors),
      shoot: tilt(shootR, 0, 2, colors),
    }
  };
}

export function makeSpriteBank() {
  return {
    thief: buildRole("thief"),
    killer: buildRole("killer"),
    butcher: buildRole("butcher"),
  };
}
