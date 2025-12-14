import { clamp } from "./utils.js";

export function createRenderer(canvas){
  const ctx = canvas.getContext("2d", { alpha:false });

  // tiny procedural textures
  const tex = {
    makePattern(base, noise){
      const c = document.createElement("canvas");
      c.width = 32; c.height = 32;
      const g = c.getContext("2d");
      g.fillStyle = base;
      g.fillRect(0,0,32,32);
      for(let i=0;i<120;i++){
        g.fillStyle = Math.random()<0.5 ? `rgba(0,0,0,${noise})` : `rgba(255,255,255,${noise*0.45})`;
        g.fillRect((Math.random()*32)|0, (Math.random()*32)|0, 2, 2);
      }
      return ctx.createPattern(c, "repeat");
    }
  };

  return { ctx, tex, canvas };
}

export function render(state, R){
  const { ctx, canvas } = R;
  const ts = state.tileSize;
  const p = state.player;

  // camera
  const camX = Math.floor(p.x - canvas.width/2);
  const camY = Math.floor(p.y - canvas.height/2);

  ctx.fillStyle = "#000";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  const wallPat = R.tex.makePattern(state.theme.wall, state.theme.noise);
  const floorPat = R.tex.makePattern(state.theme.floor, state.theme.noise*0.6);

  // view radius
  const lumen = state.effects.some(e=>e.type==="LUMEN");
  let rad = lumen ? 9999 : 200;

  // POISON warp (simple screen-space wobble later)
  const poison = state.effects.find(e=>e.type==="POISON");
  const grief  = state.effects.find(e=>e.type==="GRIEF");
  const jitter = grief ? 2.5 : 0;

  const jx = (Math.random()*2-1) * jitter;
  const jy = (Math.random()*2-1) * jitter;

  ctx.save();
  ctx.translate(-camX + jx, -camY + jy);

  // visible tile bounds
  const startCol = Math.floor(camX/ts) - 1;
  const endCol   = startCol + Math.ceil(canvas.width/ts) + 3;
  const startRow = Math.floor(camY/ts) - 1;
  const endRow   = startRow + Math.ceil(canvas.height/ts) + 3;

  for(let y=startRow; y<=endRow; y++){
    for(let x=startCol; x<=endCol; x++){
      if(y<0||x<0||x>=state.mapW||y>=state.mapH) continue;
      const tile = state.map[y][x];
      const cx = x*ts + ts/2;
      const cy = y*ts + ts/2;
      const d = Math.hypot(cx-p.x, cy-p.y);
      if(!lumen && d > rad) continue;

      ctx.fillStyle = tile ? wallPat : floorPat;
      ctx.fillRect(x*ts, y*ts, ts, ts);

      // faint outlines
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.strokeRect(x*ts, y*ts, ts, ts);
    }
  }

  // decals: code scribble (optional flavor)
  for(const d of state.decals){
    if(d.type==="code"){
      ctx.fillStyle = "rgba(255,42,42,0.85)";
      ctx.font = "18px VT323";
      ctx.fillText(d.val, d.x, d.y);
    }
  }

  // pickups
  for(const it of state.pickups){
    if(it.taken) continue;

    if(it.kind==="key"){
      ctx.fillStyle = "rgba(255,204,0,0.92)";
      ctx.fillRect(it.x-5, it.y-5, 10, 10);
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(it.x-1, it.y-4, 2, 8);
    }
    if(it.kind==="portal"){
      // portal: eerie ring
      const locked = it.locked;
      ctx.beginPath();
      ctx.arc(it.x, it.y, 18, 0, Math.PI*2);
      ctx.fillStyle = locked ? "rgba(160,40,40,0.25)" : "rgba(170,221,170,0.20)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(it.x, it.y, 12, 0, Math.PI*2);
      ctx.strokeStyle = locked ? "rgba(255,42,42,0.85)" : "rgba(170,221,170,0.95)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if(it.kind==="oxygen"){
      ctx.fillStyle = "rgba(120,200,255,0.85)";
      ctx.fillRect(it.x-4, it.y-6, 8, 12);
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(it.x-2, it.y-4, 4, 8);
    }
    if(it.kind==="ammo"){
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillRect(it.x-5, it.y-3, 10, 6);
    }
    if(it.kind==="perk"){
      ctx.fillStyle = "rgba(210,120,255,0.75)";
      ctx.beginPath();
      ctx.moveTo(it.x, it.y-7);
      ctx.lineTo(it.x+7, it.y);
      ctx.lineTo(it.x, it.y+7);
      ctx.lineTo(it.x-7, it.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  // entities
  for(const e of state.entities){
    if(!e.alive) continue;

    if(e.kind==="peasant"){
      ctx.fillStyle = "rgba(170,221,170,0.22)";
      ctx.fillRect(e.x-8, e.y-12, 16, 24);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(e.x-4, e.y-8, 8, 6);
      continue;
    }

    // monster: creepy tile-ish + jitter
    const jjx = (Math.random()*2-1)*2;
    const jjy = (Math.random()*2-1)*2;
    ctx.fillStyle = "rgba(255,42,42,0.18)";
    ctx.fillRect(e.x-16+jjx, e.y-16+jjy, 32, 32);
    ctx.fillStyle = "rgba(255,42,42,0.72)";
    ctx.fillRect(e.x-10+jjx, e.y-10+jjy, 20, 20);
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fillRect(e.x-6+jjx, e.y-4+jjy, 4, 3);
    ctx.fillRect(e.x+2+jjx, e.y-4+jjy, 4, 3);
  }

  // player: animated creepy figure
  const bob = Math.sin((state.t/12)) * 2;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.facing);

  // body
  ctx.fillStyle = "rgba(230,230,230,0.92)";
  ctx.fillRect(-6, -10 + bob, 12, 20);

  // “head”
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(-5, -16 + bob, 10, 7);

  // “mouth slit”
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(-3, -12 + bob, 6, 1);

  // role mark
  ctx.fillStyle = state.role==="butcher" ? "rgba(255,42,42,0.6)" : state.role==="killer" ? "rgba(255,204,0,0.55)" : "rgba(120,200,255,0.55)";
  ctx.fillRect(4, -2 + bob, 6, 2);

  ctx.restore();
  ctx.restore();

  // fog / darkness
  if(!lumen){
    const g = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 60, canvas.width/2, canvas.height/2, 220);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.93)");
    ctx.fillStyle = g;
    ctx.fillRect(0,0,canvas.width,canvas.height);
  }

  // poison warp overlay
  if(poison){
    const a = 1 - (poison.t/poison.dur);
    ctx.globalAlpha = clamp(a*0.22, 0, 0.22);
    for(let i=0;i<18;i++){
      const y = (Math.random()*canvas.height)|0;
      const dx = ((Math.random()*24)-12) * a;
      ctx.drawImage(canvas, 0, y, canvas.width, 2, dx, y, canvas.width, 2);
    }
    ctx.globalAlpha = 1;
  }

  // grain
  const amount = clamp(0.10 + state.escalation*0.03, 0.10, 0.28);
  ctx.globalAlpha = amount;
  for(let i=0;i<160;i++){
    ctx.fillStyle = Math.random()<0.5 ? "#0b0b0b" : "#161616";
    ctx.fillRect(Math.random()*canvas.width, Math.random()*canvas.height, 1+Math.random()*2, 1+Math.random()*2);
  }
  ctx.globalAlpha = 1;
}

