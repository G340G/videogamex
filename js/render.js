import { clamp } from "./utils.js";

function makeSprite(w, h){
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d", { alpha:true });
  return { c, g, w, h };
}

function px(g, x, y, col){ g.fillStyle = col; g.fillRect(x|0, y|0, 1, 1); }
function rect(g, x, y, w, h, col){ g.fillStyle = col; g.fillRect(x|0,y|0,w|0,h|0); }

function buildHeroFrames(){
  // 24x24, 4-direction-ish implied by rotation in render; we animate walk+shoot
  const frames = { idle:[], walk:[], shoot:[] };

  const mk = (phase, shooting=false) => {
    const s = makeSprite(24,24);
    const g = s.g;
    g.clearRect(0,0,24,24);

    // palette (brutal)
    const skin = "#d7c4b3";
    const coat = "#151618";
    const coatHi = "#2a2c31";
    const blood = "#ff2a3a";
    const steel = "#d6d6d6";
    const shadow = "rgba(0,0,0,0.35)";

    // body bob
    const bob = Math.sin(phase)*1.2;

    // shadow
    g.fillStyle = shadow;
    g.fillRect(6, 18, 12, 4);

    // legs
    const legSwing = Math.sin(phase) * 2;
    rect(g, 9, 15 + bob, 3, 6, coat);
    rect(g, 12, 15 + bob, 3, 6, coat);
    // feet swing
    rect(g, 8 + legSwing*0.4, 20 + bob, 4, 2, coatHi);
    rect(g, 12 - legSwing*0.4, 20 + bob, 4, 2, coatHi);

    // torso
    rect(g, 8, 9 + bob, 8, 7, coat);
    rect(g, 9, 10 + bob, 6, 5, coatHi);

    // head
    rect(g, 9, 4 + bob, 6, 5, skin);
    // eyes (hollow)
    rect(g, 10, 6 + bob, 1, 1, "#0b0b0b");
    rect(g, 13, 6 + bob, 1, 1, "#0b0b0b");
    // mouth scar
    rect(g, 11, 8 + bob, 2, 1, blood);

    // weapon arm
    if (shooting){
      // extended
      rect(g, 15, 11 + bob, 5, 2, coatHi);
      rect(g, 19, 10 + bob, 3, 4, steel);
      // muzzle flash (pixel burst)
      rect(g, 22, 10 + bob, 2, 1, "#fff");
      rect(g, 22, 11 + bob, 1, 2, "#ffddaa");
      rect(g, 21, 11 + bob, 1, 1, "#ff2a3a");
    } else {
      rect(g, 15, 11 + bob, 3, 2, coatHi);
      rect(g, 18, 11 + bob, 2, 2, steel);
    }

    // little grime pixels
    for (let i=0;i<10;i++){
      px(g, 6 + ((Math.random()*12)|0), 6 + ((Math.random()*14)|0), Math.random()<0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.1)");
    }

    return s.c;
  };

  // idle
  frames.idle.push(mk(0,false));
  frames.idle.push(mk(Math.PI*0.5,false));

  // walk
  frames.walk.push(mk(0,false));
  frames.walk.push(mk(Math.PI*0.5,false));
  frames.walk.push(mk(Math.PI,false));
  frames.walk.push(mk(Math.PI*1.5,false));

  // shoot
  frames.shoot.push(mk(0.0,true));
  frames.shoot.push(mk(0.8,true));

  return frames;
}

function buildEnemyFrames(){
  const frames = { idle:[], walk:[], hurt:[] };

  const mk = (phase, hurt=false) => {
    const s = makeSprite(24,24);
    const g = s.g;
    g.clearRect(0,0,24,24);

    const meat = hurt ? "#ff6a7a" : "#b5132c";
    const dark = "#16050a";
    const bone = "#e6d8c6";
    const glow = hurt ? "#ffffff" : "#ffd1d1";
    const shadow = "rgba(0,0,0,0.4)";

    const bob = Math.sin(phase)*1.4;
    const sway = Math.cos(phase)*1.2;

    // shadow
    g.fillStyle = shadow;
    g.fillRect(6, 19, 12, 4);

    // body blob
    rect(g, 7 + sway*0.3, 7 + bob, 10, 11, meat);
    rect(g, 9 + sway*0.3, 9 + bob, 6, 7, dark);

    // teeth ribs
    rect(g, 10 + sway*0.3, 12 + bob, 1, 4, bone);
    rect(g, 12 + sway*0.3, 12 + bob, 1, 4, bone);
    rect(g, 14 + sway*0.3, 12 + bob, 1, 4, bone);

    // eyes
    rect(g, 9 + sway, 10 + bob, 2, 1, glow);
    rect(g, 13 + sway, 10 + bob, 2, 1, glow);

    // limbs (skitter)
    const leg = Math.sin(phase)*2;
    rect(g, 6 + leg*0.3, 16 + bob, 3, 5, dark);
    rect(g, 15 - leg*0.3, 16 + bob, 3, 5, dark);

    // noise specks
    for (let i=0;i<16;i++){
      px(g, (Math.random()*24)|0, (Math.random()*24)|0, Math.random()<0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.12)");
    }

    return s.c;
  };

  frames.idle.push(mk(0,false));
  frames.idle.push(mk(Math.PI*0.6,false));

  frames.walk.push(mk(0,false));
  frames.walk.push(mk(Math.PI*0.5,false));
  frames.walk.push(mk(Math.PI,false));
  frames.walk.push(mk(Math.PI*1.5,false));

  frames.hurt.push(mk(0,true));
  frames.hurt.push(mk(Math.PI*0.5,true));

  return frames;
}

const SPRITES = {
  hero: buildHeroFrames(),
  enemy: buildEnemyFrames(),
};

function fogMask(ctx, W, H, centerX, centerY, radius, density){
  const g = ctx.createRadialGradient(centerX, centerY, radius*0.25, centerX, centerY, radius);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${density})`);
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);
}

function drawRain(ctx, W, H, amt, t){
  if (amt <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = 0.18 + amt*0.28;
  for (let i=0;i<90 + amt*260;i++){
    const x = (Math.random()*W)|0;
    const y = ((Math.random()*H) + (t*70)) % H;
    const len = 6 + Math.random()*12;
    ctx.fillStyle = Math.random()<0.5 ? "#0b0b0b" : "#141414";
    ctx.fillRect(x, y, 1, len);
  }
  ctx.restore();
}

function drawMist(ctx, W, H, amt){
  if (amt <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = 0.08 + amt*0.22;
  for (let i=0;i<18 + amt*30;i++){
    const x = (Math.random()*W)|0;
    const y = (Math.random()*H)|0;
    const w = 40 + Math.random()*120;
    const h = 8 + Math.random()*30;
    ctx.fillStyle = Math.random()<0.5 ? "rgba(90,90,110,0.35)" : "rgba(40,40,55,0.35)";
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

function drawIcon(ctx, S, x, y, color, shape){
  const tile = S.tile;
  const sx = x*tile - S.camX;
  const sy = y*tile - S.camY;
  ctx.fillStyle = color;
  if (shape==="diamond"){
    ctx.beginPath();
    ctx.moveTo(sx+tile/2, sy+4);
    ctx.lineTo(sx+tile-4, sy+tile/2);
    ctx.lineTo(sx+tile/2, sy+tile-4);
    ctx.lineTo(sx+4, sy+tile/2);
    ctx.closePath();
    ctx.fill();
  } else if (shape==="circle"){
    ctx.beginPath();
    ctx.arc(sx+tile/2, sy+tile/2, tile*0.22, 0, Math.PI*2);
    ctx.fill();
  } else {
    ctx.fillRect(sx+tile*0.28, sy+tile*0.28, tile*0.44, tile*0.44);
  }
}

export function render(ctx, S){
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const map = S.map;
  if (!map) return;

  const tile = S.tile;
  const h = S.hero;

  // camera follow
  S.camX = (h.x*tile) - W/2;
  S.camY = (h.y*tile) - H/2;

  // base
  ctx.fillStyle = S.theme?.floor || "#050505";
  ctx.fillRect(0,0,W,H);

  // visible tiles
  const startX = Math.floor(S.camX / tile) - 1;
  const startY = Math.floor(S.camY / tile) - 1;
  const endX = startX + Math.ceil(W/tile) + 2;
  const endY = startY + Math.ceil(H/tile) + 2;

  for (let ty=startY; ty<=endY; ty++){
    for (let tx=startX; tx<=endX; tx++){
      if (ty<0 || tx<0 || ty>=S.mapH || tx>=S.mapW) continue;
      const cell = map[ty][tx];
      const sx = tx*tile - S.camX;
      const sy = ty*tile - S.camY;

      if (cell === 1){
        ctx.fillStyle = S.theme.wall;
        ctx.fillRect(sx,sy,tile,tile);
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fillRect(sx,sy,tile,2);
        ctx.fillRect(sx,sy,2,tile);
      } else {
        ctx.fillStyle = S.theme.floor;
        ctx.fillRect(sx,sy,tile,tile);
        if (Math.random() < 0.10){
          ctx.fillStyle = "rgba(0,0,0,0.12)";
          ctx.fillRect(sx + (Math.random()*tile)|0, sy + (Math.random()*tile)|0, 1, 1);
        }
      }
    }
  }

  // objects
  for (const k of S.keysOnMap) if(!k.taken) drawIcon(ctx, S, k.x, k.y, S.theme.accent, "diamond");
  for (const t of S.tanks)     if(!t.taken) drawIcon(ctx, S, t.x, t.y, "#86b7ff", "box");
  for (const n of S.notes)     if(!n.taken) drawIcon(ctx, S, n.x, n.y, "#ddd", "circle");

  if (S.portal){
    const c = (S.keysCollected >= S.totalKeys) ? "#ffffff" : "#550000";
    drawIcon(ctx, S, S.portal.x, S.portal.y, c, "diamond");
    const sx = S.portal.x*tile - S.camX;
    const sy = S.portal.y*tile - S.camY;
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#ff3355";
    ctx.fillRect(sx+tile/2-1, sy+4, 2, tile-8);
    ctx.globalAlpha = 1;
  }

  // shrines + peasants (still abstract, fits pixel world)
  for (const s of S.shrines){
    if (s.used) continue;
    const sx = s.x*tile - S.camX;
    const sy = s.y*tile - S.camY;
    ctx.fillStyle = "rgba(255,60,90,0.55)";
    ctx.fillRect(sx-3, sy-3, 6, 6);
  }
  for (const p of S.npcs){
    if (p.used) continue;
    const sx = p.x*tile - S.camX;
    const sy = p.y*tile - S.camY;
    ctx.fillStyle = "rgba(170,221,170,0.7)";
    ctx.fillRect(sx-4, sy-8, 8, 14);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(sx-8, sy-2, 16, 1);
  }

  // projectiles (pixel bullets + trail)
  for (const pr of S.projectiles){
    if (!pr.alive) continue;
    const px = pr.x*tile - S.camX;
    const py = pr.y*tile - S.camY;
    ctx.fillStyle = pr.from === "hero" ? "#ffddaa" : "#ff3355";
    ctx.fillRect(px-2, py-2, 4, 4);
    ctx.globalAlpha = 0.35;
    ctx.fillRect(px-9, py-1, 5, 2);
    ctx.globalAlpha = 1;
  }

  // gore: blood
  for (const b of S.blood){
    const bx = b.x*tile - S.camX;
    const by = b.y*tile - S.camY;
    ctx.globalAlpha = clamp(b.life, 0, 1);
    ctx.fillStyle = b.col;
    ctx.fillRect(bx, by, b.sz, b.sz);
    ctx.globalAlpha = 1;
  }

  // gore: gibs (larger chunks)
  for (const g of S.gibs){
    const gx = g.x*tile - S.camX;
    const gy = g.y*tile - S.camY;
    ctx.globalAlpha = clamp(g.life, 0, 1);
    ctx.fillStyle = g.col;
    ctx.fillRect(gx, gy, g.sz, g.sz);
    ctx.globalAlpha = 1;
  }

  // enemies (pixel art animated)
  for (const e of S.enemies){
    if (!e.alive) continue;
    const ex = e.x*tile - S.camX;
    const ey = e.y*tile - S.camY;

    const moving = true; // enemies almost always skitter
    const hurt = e.hurtT > 0.001;
    const bank = hurt ? SPRITES.enemy.hurt : (moving ? SPRITES.enemy.walk : SPRITES.enemy.idle);
    const idx = (bank.length * (e.stepT % 1)) | 0;
    const img = bank[idx % bank.length];

    // jitter in fear (psychedelic)
    const j = (Math.random()-0.5) * (S.fx.shock>0 ? 6 : 2);
    ctx.drawImage(img, ex - 12 + j, ey - 12 - j);
  }

  // hero (pixel art animated walk + shoot)
  const hx = h.x*tile - S.camX;
  const hy = h.y*tile - S.camY;

  const isShooting = h.shootT > 0.001;
  const isWalking = true; // determined by stepT rate in main; looks alive
  const bankH = isShooting ? SPRITES.hero.shoot : (isWalking ? SPRITES.hero.walk : SPRITES.hero.idle);
  const idxH = (bankH.length * (h.stepT % 1)) | 0;
  const heroImg = bankH[idxH % bankH.length];

  // role tint overlay (subtle)
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(h.facing || 0);
  ctx.drawImage(heroImg, -12, -12);

  ctx.globalAlpha = 0.12;
  ctx.fillStyle = (h.role === "thief") ? "#5cff7a" : (h.role === "killer") ? "#ff4466" : "#ffd38a";
  ctx.fillRect(-12, -12, 24, 24);
  ctx.restore();

  // muzzle flash overlay on screen (small)
  if (S.fx.muzzle > 0.001){
    ctx.save();
    ctx.globalAlpha = 0.10 * S.fx.muzzle;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0,0,W,H);
    ctx.restore();
  }

  // rain + mist
  S.fx.rainT += 0.016;
  drawRain(ctx, W, H, S.theme.rain, S.fx.rainT);
  drawMist(ctx, W, H, S.theme.haze + (S.curses.poison>0 ? 0.35 : 0));

  // poison hallucination stripes
  if (S.curses.poison > 0){
    ctx.save();
    ctx.globalAlpha = 0.12;
    for (let i=0;i<10;i++){
      ctx.fillStyle = Math.random()<0.5 ? "rgba(255,0,80,0.25)" : "rgba(0,255,200,0.18)";
      ctx.fillRect(Math.random()*W, Math.random()*H, 30+Math.random()*120, 6+Math.random()*18);
    }
    ctx.restore();
  }

  // ghost follower
  if (S.curses.ghost > 0){
    ctx.save();
    ctx.globalAlpha = 0.18 + Math.random()*0.10;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(hx - 28 + Math.sin(S.t*0.03)*3, hy - 30, 12, 22);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // hit vignette
  if (S.fx.hitVignette > 0.001){
    ctx.save();
    ctx.globalAlpha = 0.18 * S.fx.hitVignette;
    ctx.fillStyle = "#ff2a3a";
    ctx.fillRect(0,0,W,H);
    ctx.restore();
  }

  // fog of war
  const baseR = 160;
  const addR = (S.buffs.reveal>0 ? 120 : 0);
  const rad = baseR + addR - (S.curses.grief>0 ? 30 : 0);
  fogMask(ctx, W, H, W/2, H/2, rad, S.theme.fog);

  // prompt UI
  if (S.prompt.active){
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(80, 320, 480, 130);
    ctx.strokeStyle = "#aaddaa";
    ctx.strokeRect(80, 320, 480, 130);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "22px VT323";
    ctx.fillText(S.prompt.q, 320, 350);
    ctx.fillStyle = "#bbb";
    ctx.fillText(S.prompt.a1, 320, 382);
    ctx.fillText(S.prompt.a2, 320, 410);

    ctx.fillStyle = "#ff3355";
    const w = clamp(S.prompt.t / S.prompt.max, 0, 1) * 460;
    ctx.fillRect(90, 438, w, 3);
    ctx.restore();
  }

  // mission UI
  if (S.mission.active && !S.prompt.active){
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(12, 64, 240, 60);
    ctx.fillStyle = "#aaddaa";
    ctx.textAlign = "left";
    ctx.font = "20px VT323";
    ctx.fillText(S.mission.title, 20, 86);
    ctx.fillStyle = "#888";
    ctx.font = "18px VT323";
    const line = (S.mission.desc.split("\n")[1] || "");
    ctx.fillText(line, 20, 108);

    const pct = clamp(S.mission.prog / Math.max(0.001, S.mission.goal), 0, 1);
    ctx.fillStyle = "#333";
    ctx.fillRect(20, 114, 200, 4);
    ctx.fillStyle = "#aaddaa";
    ctx.fillRect(20, 114, 200*pct, 4);
    ctx.restore();
  }
}
