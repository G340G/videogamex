// render.js
import { clamp, dist } from "./utils.js";

function safeArr(a){ return Array.isArray(a) ? a : []; }

function drawNoise(ctx, amount){
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.22, amount / 45);
  for (let i = 0; i < 260; i++){
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
  const g = ctx.createRadialGradient(W/2, H/2, 70, W/2, H/2, Math.max(W, H)*0.78);
  g.addColorStop(0, "rgba(0,0,0,0.0)");
  g.addColorStop(1, "rgba(0,0,0,1.0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawMist(ctx, amount){
  if(amount <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.22, amount);
  for(let i=0;i<20;i++){
    const y = (Math.random()*ctx.canvas.height)|0;
    const h = 8 + ((Math.random()*30)|0);
    ctx.fillStyle = "rgba(190,190,210,0.06)";
    ctx.fillRect(0, y, ctx.canvas.width, h);
  }
  ctx.restore();
}

function drawRain(ctx, amt){
  if(amt <= 0) return;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.save();
  ctx.globalAlpha = 0.15 + amt*0.25;
  for(let i=0;i<140;i++){
    const x = Math.random()*W;
    const y = Math.random()*H;
    ctx.fillStyle = "rgba(180,220,255,0.25)";
    ctx.fillRect(x, y, 1, 6 + Math.random()*10);
  }
  ctx.restore();
}

function drawSprite(ctx, img, x, y, scale=1, jitter=0){
  const jx = jitter ? (Math.random()-0.5)*jitter : 0;
  const jy = jitter ? (Math.random()-0.5)*jitter : 0;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, (x + jx) | 0, (y + jy) | 0, (img.width*scale) | 0, (img.height*scale) | 0);
}

export function render(ctx, S){
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.fillStyle = "#050505";
  ctx.fillRect(0,0,W,H);

  const map = S?.map;
  const hero = S?.hero;
  if(!map || !map.length || !hero){
    // safe fallback: show something instead of black
    ctx.fillStyle = "#111";
    ctx.font = "16px VT323, monospace";
    ctx.fillText("LOADING WORLD...", 20, 30);
    return;
  }

  const tilePx = S.tilePx || 40;

  // camera
  const camX = hero.x * tilePx - W/2;
  const camY = hero.y * tilePx - H/2;

  // theme palette
  const theme = S.theme || { floor:"#09090b", wall:"#15151c", accent:"#ff2a5c", fog:0.92, rain:0.0 };

  // visible bounds
  const rows = map.length;
  const cols = map[0]?.length ?? 0;
  const startX = Math.max(0, ((camX / tilePx) | 0) - 2);
  const startY = Math.max(0, ((camY / tilePx) | 0) - 2);
  const endX = Math.min(cols-1, (((camX + W) / tilePx) | 0) + 2);
  const endY = Math.min(rows-1, (((camY + H) / tilePx) | 0) + 2);

  // psychedelic states
  const poison = hero.poison > 0;
  const reveal = hero.reveal > 0;

  // draw tiles
  for(let y=startY; y<=endY; y++){
    const row = map[y];
    if(!row) continue;
    for(let x=startX; x<=endX; x++){
      const v = row[x] ?? 1;
      const sx = (x*tilePx - camX) | 0;
      const sy = (y*tilePx - camY) | 0;

      if(v === 1){
        ctx.fillStyle = theme.wall;
        ctx.fillRect(sx,sy,tilePx,tilePx);
        ctx.strokeStyle = "rgba(0,0,0,0.4)";
        ctx.strokeRect(sx,sy,tilePx,tilePx);
        if(Math.random()<0.03){
          ctx.fillStyle = "rgba(255,255,255,0.02)";
          ctx.fillRect(sx+((Math.random()*tilePx)|0), sy+((Math.random()*tilePx)|0), 1, 1);
        }
      } else {
        ctx.fillStyle = theme.floor;
        ctx.fillRect(sx,sy,tilePx,tilePx);
        if(Math.random()<0.06){
          ctx.fillStyle = "rgba(120,40,60,0.08)";
          ctx.fillRect(sx+((Math.random()*tilePx)|0), sy+((Math.random()*tilePx)|0), 1, 1);
        }
      }

      // poison hue shift hint
      if(poison && v===0 && Math.random()<0.04){
        ctx.fillStyle = "rgba(130,80,190,0.06)";
        ctx.fillRect(sx,sy,tilePx,tilePx);
      }
    }
  }

  // keys
  for(const k of safeArr(S.keysOnMap)){
    if(!k || k.taken) continue;
    const sx = ((k.x+0.5)*tilePx - camX) | 0;
    const sy = ((k.y+0.5)*tilePx - camY) | 0;
    ctx.fillStyle = "rgba(210, 200, 90, 0.95)";
    ctx.fillRect(sx-3, sy-3, 6, 6);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(sx-1, sy-1, 2, 2);
  }

  // oxygen tanks
  for(const t of safeArr(S.tanks)){
    if(!t || t.taken) continue;
    const sx = ((t.x)*tilePx - camX) | 0;
    const sy = ((t.y)*tilePx - camY) | 0;
    ctx.fillStyle = "rgba(140,220,255,0.75)";
    ctx.fillRect(sx-4, sy-5, 8, 10);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(sx-2, sy-4, 2, 8);
  }

  // peasants
  for(const n of safeArr(S.npcs)){
    if(!n || n.used) continue;
    const sx = ((n.x)*tilePx - camX) | 0;
    const sy = ((n.y)*tilePx - camY) | 0;
    ctx.fillStyle = "rgba(170, 220, 170, 0.65)";
    ctx.fillRect(sx-3, sy-6, 6, 12);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(sx-2, sy-1, 1, 1);
    ctx.fillRect(sx+1, sy-1, 1, 1);
  }

  // notes
  for(const n of safeArr(S.notes)){
    if(!n || n.taken) continue;
    const sx = ((n.x)*tilePx - camX) | 0;
    const sy = ((n.y)*tilePx - camY) | 0;
    ctx.fillStyle = "rgba(255,255,255,0.20)";
    ctx.fillRect(sx-4, sy-3, 8, 6);
  }

  // portal
  if(S.portal){
    const sx = ((S.portal.x+0.5)*tilePx - camX) | 0;
    const sy = ((S.portal.y+0.5)*tilePx - camY) | 0;
    const unlocked = (S.keysCollected >= S.totalKeys);
    ctx.fillStyle = unlocked ? "rgba(255,255,255,0.85)" : "rgba(80,10,20,0.75)";
    ctx.beginPath(); ctx.arc(sx,sy, 9, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = unlocked ? "rgba(255,60,90,0.55)" : "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.arc(sx,sy, 4, 0, Math.PI*2); ctx.fill();
  }

  // enemies
  for(const e of safeArr(S.enemies)){
    if(!e || !e.alive) continue;
    const sx = (e.x*tilePx - camX) | 0;
    const sy = (e.y*tilePx - camY) | 0;

    const jitter = (hero.sanity < 40 || poison) ? 2.0 : 1.0;
    ctx.fillStyle = "rgba(255, 40, 70, 0.22)";
    ctx.beginPath(); ctx.arc(sx,sy, 10, 0, Math.PI*2); ctx.fill();

    if(Math.random() < 0.55){
      ctx.fillStyle = "rgba(255, 40, 70, 0.70)";
      ctx.fillRect(sx-4+(Math.random()*2|0), sy-3, 2, 2);
      ctx.fillRect(sx+2+(Math.random()*2|0), sy-3, 2, 2);
    }

    // extra smear
    if(Math.random() < 0.18){
      ctx.globalAlpha = 0.20;
      ctx.fillRect(sx-10, sy+6, 20, 2);
      ctx.globalAlpha = 1;
    }
  }

  // projectiles
  for(const pr of safeArr(S.projectiles)){
    if(!pr || !pr.alive) continue;
    const sx = (pr.x*tilePx - camX) | 0;
    const sy = (pr.y*tilePx - camY) | 0;
    ctx.fillStyle = pr.from==="hero" ? "rgba(240,240,240,0.9)" : "rgba(255,60,90,0.8)";
    ctx.fillRect(sx-2, sy-1, 4, 2);
    if(pr.from==="hero"){
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(sx-6, sy-1, 4, 2);
    }
  }

  // hero sprite (from sprites.js bank)
  const bank = S.sprites?.[hero.role] || S.sprites?.thief;
  if(bank){
    hero.animT += S.dt;
    hero.shootFlash = Math.max(0, hero.shootFlash - S.dt);
    if(hero._moving && hero.shootFlash<=0.01) hero.walkPhase += S.dt * 10.5;

    const dir = hero.dir8 || "S";
    const set = bank[dir] || bank.S;
    const walkToggle = ((hero.walkPhase|0)&1)===1;
    const pose = hero.shootFlash>0.01 ? "shoot" : (hero._moving ? (walkToggle?"walk":"idle") : "idle");
    const img = set[pose] || set.idle;

    const px = hero.x*tilePx - camX;
    const py = hero.y*tilePx - camY;

    const scale = 2; // 12px -> 24px
    const sx = (px - (img.width*scale)/2) | 0;
    const sy = (py - (img.height*scale)/2) | 0;

    const stress = clamp((1 - hero.sanity/120) + (hero.oxy<=0 ? 0.65 : 0), 0, 1);
    const jitter = 0.3 + stress*1.5;

    drawSprite(ctx, img, sx, sy, scale, jitter);

    // brutal “shadow” under hero
    ctx.save();
    ctx.globalAlpha = 0.20;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(px, py+10, 10, 5, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  // overlays
  const anxiety = clamp((1 - hero.sanity/120) * 18, 0, 18);
  drawNoise(ctx, anxiety);

  drawMist(ctx, poison ? 0.35 : 0.18);
  drawRain(ctx, S.theme?.rain || 0);

  // fog stronger unless reveal
  drawFog(ctx, reveal ? (S.theme?.fog ?? 0.9) - 0.18 : (S.theme?.fog ?? 0.9));

  // prompt box (if active)
  if(S.prompt){
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.80)";
    ctx.fillRect(18, H-110, W-36, 92);
    ctx.strokeStyle = "rgba(170,220,170,0.35)";
    ctx.strokeRect(18, H-110, W-36, 92);

    ctx.fillStyle = "rgba(230,230,230,0.95)";
    ctx.font = "18px VT323, monospace";
    ctx.fillText(S.prompt.q, 30, H-85);
    ctx.fillStyle = "rgba(200,200,200,0.85)";
    ctx.fillText(S.prompt.a, 30, H-60);
    ctx.fillText(S.prompt.b, 30, H-40);

    // timer bar
    ctx.fillStyle = "rgba(255,60,90,0.8)";
    const wBar = (W-60) * clamp(S.prompt.t/6.5, 0, 1);
    ctx.fillRect(30, H-28, wBar, 3);

    ctx.restore();
  }
}


