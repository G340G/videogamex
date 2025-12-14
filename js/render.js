import { clamp } from "./utils.js";
import { hallucinationFogBoost } from "./hallucinations.js";

export function createRenderer(canvas){
  const ctx = canvas.getContext("2d", { alpha:false });
  return { canvas, ctx };
}

export function render(state, R){
  const { ctx, canvas } = R;
  const ts = state.tileSize;
  const p = state.player;

  // camera
  const camX = p.x - canvas.width/2;
  const camY = p.y - canvas.height/2;

  // background clear
  ctx.fillStyle = "#000";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // visible tile bounds
  const startCol = Math.floor(camX / ts) - 1;
  const endCol = startCol + Math.floor(canvas.width/ts) + 3;
  const startRow = Math.floor(camY / ts) - 1;
  const endRow = startRow + Math.floor(canvas.height/ts) + 3;

  // procedural “pixel art” textures (cheap)
  const floor = state.theme.floor;
  const wall  = state.theme.wall;

  ctx.save();
  ctx.translate(-Math.floor(camX), -Math.floor(camY));

  // draw map
  for(let y=startRow; y<=endRow; y++){
    if(y<0||y>=state.h) continue;
    for(let x=startCol; x<=endCol; x++){
      if(x<0||x>=state.w) continue;
      const v = state.tiles[y][x];

      // pseudo-texture
      if(v===1){
        ctx.fillStyle = wall;
        ctx.fillRect(x*ts, y*ts, ts, ts);
        // cracks
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        if(((x+y+state.level)%3)===0) ctx.fillRect(x*ts+4, y*ts+10, ts-8, 2);
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.strokeRect(x*ts, y*ts, ts, ts);
      }else{
        ctx.fillStyle = floor;
        ctx.fillRect(x*ts, y*ts, ts, ts);
        // grit dots
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        if(((x*13+y*7+state.t)|0)%17===0) ctx.fillRect(x*ts+((state.t+x*3)%ts), y*ts+((state.t+y*2)%ts), 1, 1);
      }
    }
  }

  // decals (codes, notes)
  ctx.font = "18px VT323";
  for(const d of state.decals){
    if(d.type==="code"){
      ctx.fillStyle = state.theme.accent;
      ctx.fillText(d.code, d.x-10, d.y-12);
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.fillText(d.line, d.x-90, d.y+14);
    }
  }

  // pickups
  for(const it of state.pickups){
    if(it.taken) continue;
    if(it.kind==="chest"){
      ctx.fillStyle = "#3aa";
      ctx.fillRect(it.x-10, it.y-10, 20, 20);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(it.x-8, it.y-8, 16, 6);
    } else if(it.kind==="oxygen"){
      ctx.fillStyle = "#9f9";
      ctx.fillRect(it.x-7, it.y-12, 14, 24);
      ctx.fillStyle = "#0a0";
      ctx.fillRect(it.x-5, it.y-10, 10, 20);
    } else if(it.kind==="ammo"){
      ctx.fillStyle = "#ffcc66";
      ctx.fillRect(it.x-8, it.y-8, 16, 16);
    } else if(it.kind==="perk"){
      ctx.fillStyle = "#ff2a2a";
      ctx.fillRect(it.x-6, it.y-6, 12, 12);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(it.x-2, it.y-2, 4, 4);
    } else if(it.kind==="exit"){
      ctx.fillStyle = it.locked ? "#440000" : "#ffffff";
      ctx.beginPath();
      ctx.moveTo(it.x, it.y-14);
      ctx.lineTo(it.x+14, it.y);
      ctx.lineTo(it.x, it.y+14);
      ctx.lineTo(it.x-14, it.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  // bullets
  ctx.fillStyle = "#fff";
  for(const b of state.bullets){
    ctx.fillRect(b.x-1, b.y-1, 2, 2);
  }

  // enemies
  for(const e of state.entities){
    if(!e.alive) continue;
    // creepy sprite: rectangle + eyes + jitter
    const jx = (Math.random()-0.5) * (2 + state.escalation*0.2);
    const jy = (Math.random()-0.5) * (2 + state.escalation*0.2);
    ctx.save();
    ctx.translate(e.x + jx, e.y + jy);

    ctx.fillStyle = "rgba(30,20,30,0.95)";
    ctx.fillRect(-12, -12, 24, 24);

    ctx.fillStyle = "rgba(255,42,42,0.75)";
    ctx.fillRect(-7, -4, 4, 2);
    ctx.fillRect( 3, -4, 4, 2);

    ctx.fillStyle = "rgba(0,0,0,0.9)";
    ctx.fillRect(-5, 4, 10, 5);

    // “image tear”
    if(Math.random()<0.15){
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(-12, (Math.random()*24-12)|0, 24, 1);
    }
    ctx.restore();
  }

  // player (animated creepy figure)
  ctx.save();
  ctx.translate(p.x, p.y);
  const bob = Math.sin(state.t*0.09)*2;
  ctx.rotate(p.facing);

  // body
  ctx.fillStyle = "#dfe";
  ctx.fillRect(-7, -7 + bob, 14, 14);

  // “mask” detail
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(-4, -2 + bob, 8, 5);

  // role accent
  ctx.fillStyle =
    state.role==="thief" ? "rgba(120,200,255,0.9)" :
    state.role==="killer" ? "rgba(255,80,120,0.9)" :
    "rgba(255,210,120,0.9)";
  ctx.fillRect(3, 3 + bob, 3, 3);

  // forward “knife” hint
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(10, -2, 16, 4);

  ctx.restore();

  ctx.restore(); // camera

  // lighting / fog
  const fogBoost = hallucinationFogBoost(state);
  const fov = clamp(190 - state.escalation*10, 110, 210) / fogBoost;

  const gx = canvas.width/2;
  const gy = canvas.height/2;
  const grd = ctx.createRadialGradient(gx,gy, 40, gx,gy, fov);
  grd.addColorStop(0, "rgba(0,0,0,0.0)");
  grd.addColorStop(1, "rgba(0,0,0,0.96)");
  ctx.fillStyle = grd;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // hallucination overlays
  for(const fx of state.effects){
    if(fx.type==="HIT_FLASH"){
      const a = 1 - (fx.t/fx.dur);
      ctx.fillStyle = `rgba(255,0,0,${0.18*a})`;
      ctx.fillRect(0,0,canvas.width,canvas.height);
    }
    if(fx.type==="UI_LIE"){
      if(Math.random()<0.06){
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(0,(Math.random()*canvas.height)|0, canvas.width, 2);
      }
    }
    if(fx.type==="WALL_BREATH"){
      const a = 0.05 + 0.06*Math.sin(fx.t*5);
      ctx.fillStyle = `rgba(255,42,42,${a*fx.intensity})`;
      ctx.fillRect(0,0,canvas.width,canvas.height);
    }
  }

  // subtle grain
  const g = clamp(0.06 + state.escalation*0.01, 0.06, 0.12);
  ctx.globalAlpha = g;
  for(let i=0;i<120;i++){
    ctx.fillStyle = Math.random()<0.5 ? "#0b0b0b" : "#121212";
    ctx.fillRect(Math.random()*canvas.width, Math.random()*canvas.height, 1+Math.random()*2, 1+Math.random()*2);
  }
  ctx.globalAlpha = 1;
}

