import { clamp } from "./utils.js";

const scratch = document.createElement("canvas");
scratch.width = 160;
scratch.height = 160;
const sctx = scratch.getContext("2d", { alpha:true });

function drawGlitchImage(ctx, img, x, y, w, h, strength){
  if (!img) return;
  sctx.clearRect(0,0,scratch.width,scratch.height);
  sctx.drawImage(img, 0, 0, scratch.width, scratch.height);

  const slices = 6 + (strength * 18)|0;
  for (let i=0;i<slices;i++){
    const sy = (Math.random()*scratch.height)|0;
    const sh = 2 + (Math.random()*10)|0;
    const dx = ((Math.random()-0.5) * 26 * strength)|0;
    sctx.globalAlpha = 0.9;
    sctx.drawImage(scratch, 0, sy, scratch.width, sh, dx, sy, scratch.width, sh);
  }
  sctx.globalAlpha = 1;

  ctx.save();
  const off = 2 + strength*7;
  ctx.globalAlpha = 0.75;
  ctx.drawImage(scratch, x - off, y, w, h);
  ctx.globalAlpha = 0.55;
  ctx.drawImage(scratch, x + off, y, w, h);
  ctx.globalAlpha = 0.95;
  ctx.drawImage(scratch, x, y, w, h);
  ctx.restore();
}

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
    const y = ((Math.random()*H) + (t*60)) % H;
    const len = 6 + Math.random()*10;
    ctx.fillStyle = Math.random()<0.5 ? "#0b0b0b" : "#141414";
    ctx.fillRect(x, y, 1, len);
  }
  ctx.restore();
}

function drawMist(ctx, W, H, amt, t){
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

export function render(ctx, S){
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const map = S.map;
  if (!map) return;

  const tile = S.tile;
  const h = S.hero;

  // camera
  S.camX = (h.x*tile) - W/2;
  S.camY = (h.y*tile) - H/2;

  // theme base
  ctx.fillStyle = S.theme?.floor || "#050505";
  ctx.fillRect(0,0,W,H);

  // draw visible tiles (simple but stylish)
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
        // subtle grit
        if (Math.random() < 0.10){
          ctx.fillStyle = "rgba(0,0,0,0.12)";
          ctx.fillRect(sx + (Math.random()*tile)|0, sy + (Math.random()*tile)|0, 1, 1);
        }
      }
    }
  }

  // objects: keys, tanks, notes, portal, shrines, peasants
  const drawIcon = (x,y,color,shape)=>{
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
  };

  for (const k of S.keysOnMap){
    if (k.taken) continue;
    drawIcon(k.x, k.y, S.theme.accent, "diamond");
  }
  for (const t of S.tanks){
    if (t.taken) continue;
    drawIcon(t.x, t.y, "#86b7ff", "box");
  }
  for (const n of S.notes){
    if (n.taken) continue;
    drawIcon(n.x, n.y, "#ddd", "circle");
  }

  // portal
  if (S.portal){
    const c = (S.keysCollected >= S.totalKeys) ? "#ffffff" : "#550000";
    drawIcon(S.portal.x, S.portal.y, c, "diamond");
    // portal shimmer
    const sx = S.portal.x*tile - S.camX;
    const sy = S.portal.y*tile - S.camY;
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#ff3355";
    ctx.fillRect(sx+tile/2-1, sy+4, 2, tile-8);
    ctx.globalAlpha = 1;
  }

  // shrines / peasants
  for (const s of S.shrines){
    if (s.used) continue;
    const sx = s.x*tile - S.camX;
    const sy = s.y*tile - S.camY;
    ctx.fillStyle = "rgba(255,60,90,0.45)";
    ctx.fillRect(sx-3, sy-3, 6, 6);
  }
  for (const p of S.npcs){
    if (p.used) continue;
    const sx = p.x*tile - S.camX;
    const sy = p.y*tile - S.camY;
    ctx.fillStyle = "rgba(170,221,170,0.65)";
    ctx.fillRect(sx-3, sy-6, 6, 12);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(sx-6, sy-2, 12, 1);
  }

  // projectiles (visible)
  for (const pr of S.projectiles){
    if (!pr.alive) continue;
    const px = pr.x*tile - S.camX;
    const py = pr.y*tile - S.camY;
    ctx.fillStyle = pr.from === "hero" ? "#ffddaa" : "#ff3355";
    ctx.fillRect(px-2, py-2, 4, 4);
    ctx.globalAlpha = 0.35;
    ctx.fillRect(px-7, py-1, 3, 2);
    ctx.globalAlpha = 1;
  }

  // gibs
  for (const g of S.gibs){
    const gx = g.x*tile - S.camX;
    const gy = g.y*tile - S.camY;
    ctx.globalAlpha = clamp(g.life, 0, 1);
    ctx.fillStyle = g.col;
    ctx.fillRect(gx, gy, g.sz, g.sz);
    ctx.globalAlpha = 1;
  }

  // enemies as face sprites
  const assets = S.assets;
  let nearest = 999;
  for (const e of S.enemies){
    if (!e.alive) continue;
    const d = Math.hypot(h.x - e.x, h.y - e.y);
    if (d < nearest) nearest = d;

    const ex = e.x*tile - S.camX;
    const ey = e.y*tile - S.camY;
    const face = assets ? (e.facePick===2 ? assets.face2 : assets.face1) : null;
    const strength = clamp(1 - d/6, 0, 1);
    const size = 26 + strength*12;

    if (face) drawGlitchImage(ctx, face, ex - size/2, ey - size/2, size, size, 0.20 + strength*0.85);
    else {
      ctx.fillStyle = "rgba(255,60,90,0.35)";
      ctx.fillRect(ex - 10, ey - 10, 20, 20);
    }
  }

  // player sprite (bigger/brutal)
  const px = h.x*tile - S.camX;
  const py = h.y*tile - S.camY;
  const panic = clamp((1 - h.sanity/120) + (h.oxy<=10?0.5:0), 0, 1);
  const jx = (Math.random()-0.5)*2.4*panic + (S.fx.shock>0? (Math.random()-0.5)*6 : 0);
  const jy = (Math.random()-0.5)*2.4*panic + (S.fx.shock>0? (Math.random()-0.5)*6 : 0);

  ctx.save();
  ctx.translate(px + jx, py + jy);
  ctx.rotate(h.facing || 0);
  if (assets?.player){
    ctx.drawImage(assets.player, -16, -16, 32, 32);
  } else {
    ctx.fillStyle = "#eee";
    ctx.fillRect(-9, -9, 18, 18);
  }
  // brutal “cleaver shadow”
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#200";
  ctx.fillRect(-18, 6, 36, 6);
  ctx.globalAlpha = 1;
  ctx.restore();

  // face flash overlay
  if (assets && S.fx.faceFlash && S.fx.faceFlash.t < S.fx.faceFlash.dur){
    const f = S.fx.faceFlash;
    const k = 1 - (f.t / f.dur);
    const a = Math.min(0.9, k * 0.85);
    const img = f.which === 2 ? assets.face2 : assets.face1;

    ctx.save();
    ctx.globalAlpha = a;
    drawGlitchImage(ctx, img, 0, 0, W, H, 0.45 + k*0.6);
    ctx.restore();
  }

  // theme FX: rain + mist
  S.fx.rainT += 0.016;
  drawRain(ctx, W, H, S.theme.rain, S.fx.rainT);
  drawMist(ctx, W, H, S.theme.haze + (S.curses.poison>0 ? 0.35 : 0), S.t*0.03);

  // fog of war
  // reveal buff increases radius
  const baseR = 160;
  const addR = (S.buffs.reveal>0 ? 120 : 0);
  const rad = baseR + addR - (S.curses.grief>0 ? 30 : 0);
  fogMask(ctx, W, H, W/2, H/2, rad, S.theme.fog);

  // psychedelic poison distortion (cheap)
  if (S.curses.poison > 0){
    ctx.save();
    ctx.globalAlpha = 0.12;
    for (let i=0;i<10;i++){
      ctx.fillStyle = Math.random()<0.5 ? "rgba(255,0,80,0.25)" : "rgba(0,255,200,0.18)";
      ctx.fillRect(Math.random()*W, Math.random()*H, 30+Math.random()*120, 6+Math.random()*18);
    }
    ctx.restore();
  }

  // ghost follower (simple silhouette behind player)
  if (S.curses.ghost > 0){
    ctx.save();
    ctx.globalAlpha = 0.18 + Math.random()*0.10;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(px - 26 + Math.sin(S.t*0.03)*3, py - 30, 12, 22);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

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

    // timer
    ctx.fillStyle = "#ff3355";
    const w = clamp(S.prompt.t / S.prompt.max, 0, 1) * 460;
    ctx.fillRect(90, 438, w, 3);
    ctx.restore();
  }

  // mission UI (small)
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

