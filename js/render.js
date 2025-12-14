// render.js
import { clamp } from "./utils.js";

const TILE_PX = 32; // must match your game's tile pixel size

function drawNoise(ctx, amount){
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.22, amount / 45);
  for (let i = 0; i < 220; i++){
    const x = Math.random() * ctx.canvas.width;
    const y = Math.random() * ctx.canvas.height;
    const w = 1 + (Math.random() * 2);
    const h = 1 + (Math.random() * 2);
    ctx.fillStyle = Math.random() < 0.5 ? "#0b0b0b" : "#161616";
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

function drawFog(ctx, strength=0.9){
  ctx.save();
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.globalAlpha = strength;
  const g = ctx.createRadialGradient(W/2, H/2, 60, W/2, H/2, Math.max(W, H)*0.75);
  g.addColorStop(0, "rgba(0,0,0,0.0)");
  g.addColorStop(1, "rgba(0,0,0,1.0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawSprite(ctx, img, x, y, scale=1, jitter=0){
  const jx = jitter ? (Math.random()-0.5)*jitter : 0;
  const jy = jitter ? (Math.random()-0.5)*jitter : 0;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, (x + jx) | 0, (y + jy) | 0, (img.width*scale) | 0, (img.height*scale) | 0);
}

function softSmear(ctx, img, x, y, scale=1){
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.drawImage(img, (x-1) | 0, y | 0, (img.width*scale) | 0, (img.height*scale) | 0);
  ctx.drawImage(img, x | 0, (y-1) | 0, (img.width*scale) | 0, (img.height*scale) | 0);
  ctx.restore();
}

function safeArr(a){ return Array.isArray(a) ? a : []; }

export function render(ctx, S){
  const W = ctx.canvas.width, H = ctx.canvas.height;

  // clear
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, W, H);

  const map = S?.map;
  const hero = S?.hero;

  // camera
  let camX = 0, camY = 0;
  if (hero) {
    camX = hero.x * TILE_PX - W/2;
    camY = hero.y * TILE_PX - H/2;
  }

  // MAP (simple, safe, dark). Replace with your prettier one if you want.
  if (map && map.length) {
    const rows = map.length;
    const cols = map[0]?.length ?? 0;

    const startX = Math.max(0, ((camX / TILE_PX) | 0) - 2);
    const startY = Math.max(0, ((camY / TILE_PX) | 0) - 2);
    const endX = Math.min(cols-1, (((camX + W) / TILE_PX) | 0) + 2);
    const endY = Math.min(rows-1, (((camY + H) / TILE_PX) | 0) + 2);

    for (let y = startY; y <= endY; y++){
      const row = map[y];
      if (!row) continue;
      for (let x = startX; x <= endX; x++){
        const v = row[x] ?? 1;
        const sx = (x*TILE_PX - camX) | 0;
        const sy = (y*TILE_PX - camY) | 0;

        if (v === 1) {
          ctx.fillStyle = "#1a1a1f";
          ctx.fillRect(sx, sy, TILE_PX, TILE_PX);
          ctx.strokeStyle = "rgba(0,0,0,0.35)";
          ctx.strokeRect(sx, sy, TILE_PX, TILE_PX);
        } else {
          ctx.fillStyle = "#09090b";
          ctx.fillRect(sx, sy, TILE_PX, TILE_PX);

          // subtle grime specks
          if (Math.random() < 0.06) {
            ctx.fillStyle = "rgba(90,60,70,0.12)";
            ctx.fillRect(sx + ((Math.random()*TILE_PX)|0), sy + ((Math.random()*TILE_PX)|0), 1, 1);
          }
        }
      }
    }
  }

  // KEYS / PORTAL / NPC markers (safe minimal shapes so nothing disappears)
  for (const k of safeArr(S?.keysOnMap)) {
    if (k?.taken) continue;
    const sx = ((k.x+0.5)*TILE_PX - camX) | 0;
    const sy = ((k.y+0.5)*TILE_PX - camY) | 0;
    ctx.fillStyle = "rgba(210, 200, 90, 0.95)";
    ctx.fillRect(sx-3, sy-3, 6, 6);
  }

  const p = S?.portal;
  if (p) {
    const sx = ((p.x+0.5)*TILE_PX - camX) | 0;
    const sy = ((p.y+0.5)*TILE_PX - camY) | 0;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,60,90,0.55)";
    ctx.beginPath();
    ctx.arc(sx, sy, 4, 0, Math.PI*2);
    ctx.fill();
  }

  for (const n of safeArr(S?.npcs)) {
    if (!n || n.used) continue;
    const sx = ((n.x+0.5)*TILE_PX - camX) | 0;
    const sy = ((n.y+0.5)*TILE_PX - camY) | 0;
    ctx.fillStyle = "rgba(170, 220, 170, 0.65)";
    ctx.fillRect(sx-3, sy-5, 6, 10);
  }

  // ENEMIES (simple blobs; your real enemy art can remain in other render pieces)
  for (const e of safeArr(S?.enemies)) {
    if (!e || !e.alive) continue;
    const sx = (e.x*TILE_PX - camX) | 0;
    const sy = (e.y*TILE_PX - camY) | 0;

    ctx.fillStyle = "rgba(255, 40, 70, 0.25)";
    ctx.beginPath();
    ctx.arc(sx, sy, 10, 0, Math.PI*2);
    ctx.fill();

    if (Math.random() < 0.35) {
      ctx.fillStyle = "rgba(255, 40, 70, 0.65)";
      ctx.fillRect(sx-3, sy-2, 2, 2);
      ctx.fillRect(sx+2, sy-2, 2, 2);
    }
  }

  // PROJECTILES (visible bullets)
  for (const pr of safeArr(S?.projectiles)) {
    if (!pr || !pr.alive) continue;
    const sx = (pr.x*TILE_PX - camX) | 0;
    const sy = (pr.y*TILE_PX - camY) | 0;

    ctx.fillStyle = pr.from === "hero" ? "rgba(230,230,230,0.9)" : "rgba(255,60,90,0.8)";
    ctx.fillRect(sx-2, sy-1, 4, 2);
  }

  // HERO sprite (the main change)
  if (hero && S?.sprites) {
    // animate
    hero.animT += (S.dt || 1/60);
    hero.shootFlash = Math.max(0, hero.shootFlash - (S.dt || 1/60));

    const moving = !!hero._moving || (hero._mvLen ?? 0) > 0.01;
    if (moving && hero.shootFlash <= 0.01) {
      hero.walkPhase += (S.dt || 1/60) * 10.5;
    }

    const bank = S.sprites[hero.role] || S.sprites.thief;
    const dir = hero.dir8 || "S";
    const set = bank[dir] || bank.S;

    const walkToggle = ((hero.walkPhase | 0) & 1) === 1;
    const pose =
      hero.shootFlash > 0.01 ? "shoot" :
      moving ? (walkToggle ? "walk" : "idle") :
      "idle";

    const img = set[pose] || set.idle;

    const px = hero.x * TILE_PX - camX;
    const py = hero.y * TILE_PX - camY;

    // 12x12 -> scale 2 => 24px (smaller than 32px tile)
    const scale = 2;
    const sx = (px - (img.width*scale)/2) | 0;
    const sy = (py - (img.height*scale)/2) | 0;

    const stress = clamp((1 - hero.sanity/120) + (hero.oxy <= 0 ? 0.65 : 0), 0, 1);
    const jitter = 0.5 + stress * 1.6;

    // subtle smear on turns
    if (moving && Math.random() < 0.25) softSmear(ctx, img, sx, sy, scale);

    drawSprite(ctx, img, sx, sy, scale, jitter);

    // mild gore accent when sanity low
    if (hero.sanity < 35 && Math.random() < 0.12) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = "rgba(160,20,40,0.75)";
      ctx.fillRect(sx + 6, sy + 18, 2, 2);
      ctx.restore();
    }
  }

  // atmosphere overlays
  const anxiety = clamp((1 - (hero?.sanity ?? 100)/120) * 18, 0, 18);
  drawNoise(ctx, anxiety);
  drawFog(ctx, 0.86);

  // prompt / mission windows are handled by your HUD DOM; render stays clean.
}

