import { clamp, dist } from "./utils.js";

export function render(ctx, S) {
  const W = ctx.canvas.width, H = ctx.canvas.height;

  // guard
  if (!S.map || !S.map.length) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0,0,W,H);
    ctx.fillStyle = "#a7ffb5";
    ctx.font = "24px VT323";
    ctx.textAlign = "center";
    ctx.fillText("INITIALIZING...", W/2, H/2);
    return;
  }

  const map = S.map;
  const theme = S.theme;
  const h = S.hero;

  // camera px
  const tilePx = S.tilePx;
  const camX = h.x * tilePx - W/2;
  const camY = h.y * tilePx - H/2;

  // fog radius in tiles
  let fov = S.baseFov;
  if (h.reveal > 0) fov = 999; // floodlight
  if (h.poison > 0) fov = Math.max(4.2, fov - 1.0);

  // background
  ctx.fillStyle = "#000";
  ctx.fillRect(0,0,W,H);

  // visible bounds
  const mapH = map.length, mapW = map[0].length;
  const minTX = clamp(Math.floor(camX/tilePx)-2, 0, mapW-1);
  const maxTX = clamp(Math.floor((camX+W)/tilePx)+2, 0, mapW-1);
  const minTY = clamp(Math.floor(camY/tilePx)-2, 0, mapH-1);
  const maxTY = clamp(Math.floor((camY+H)/tilePx)+2, 0, mapH-1);

  // tiles with gritty “pixel texture”
  for (let ty=minTY; ty<=maxTY; ty++){
    const row = map[ty];
    for (let tx=minTX; tx<=maxTX; tx++){
      const t = row[tx] ?? 1;

      const d = dist(tx+0.5, ty+0.5, h.x, h.y);
      if (d > fov) continue;

      let vis = 1 - (d/fov);
      vis = Math.pow(vis, 0.55);
      ctx.globalAlpha = clamp(vis, 0, 1);

      const px = tx*tilePx - camX;
      const py = ty*tilePx - camY;

      if (t===1){
        // walls: layered bricks + damp moss
        ctx.fillStyle = theme.wall;
        ctx.fillRect(px,py,tilePx,tilePx);

        // brick seams
        ctx.globalAlpha *= 0.35;
        ctx.fillStyle = "#000";
        ctx.fillRect(px, py + ((ty%2)*8), tilePx, 1);
        ctx.fillRect(px + ((tx%2)*8), py, 1, tilePx);

        // moss specks
        ctx.globalAlpha *= 0.9;
        if (((tx*7+ty*11+S.t)|0) % 13 === 0) {
          ctx.fillStyle = theme.moss;
          ctx.fillRect(px + 2 + ((tx+ty)%4), py + 2 + ((tx*3+ty)%5), 2, 2);
        }
      } else {
        // floor: grime + blood rust highlights
        ctx.fillStyle = theme.floor;
        ctx.fillRect(px,py,tilePx,tilePx);

        if (((tx+ty*3+S.t)|0) % 19 === 0) {
          ctx.globalAlpha *= 0.35;
          ctx.fillStyle = theme.accent;
          ctx.fillRect(px + ((tx*5+ty)%12), py + ((tx+ty*7)%12), 1, 1);
        }
      }
    }
  }
  ctx.globalAlpha = 1;

  // keys
  for (const k of S.keysOnMap) {
    if (k.taken) continue;
    const d = dist(k.x+0.5, k.y+0.5, h.x, h.y);
    if (d > Math.min(fov, 10)) continue;
    const px = (k.x+0.5)*tilePx - camX;
    const py = (k.y+0.5)*tilePx - camY;
    const pulse = 0.65 + Math.sin(S.t*0.12 + k.x*2) * 0.25;
    ctx.fillStyle = `rgba(255,210,90,${pulse})`;
    ctx.fillRect(px-5, py-5, 10, 10);
    ctx.fillStyle = `rgba(0,0,0,${pulse*0.6})`;
    ctx.fillRect(px-2, py-2, 4, 4);
  }

  // portal
  if (S.portal) {
    const p = S.portal;
    const d = dist(p.x+0.5, p.y+0.5, h.x, h.y);
    if (d < Math.min(fov+2, 12)) {
      const px = (p.x+0.5)*tilePx - camX;
      const py = (p.y+0.5)*tilePx - camY;
      const ready = (S.keysCollected >= S.totalKeys);
      const a = ready ? 0.95 : 0.35;
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(240,240,255,0.85)";
      ctx.beginPath();
      ctx.arc(px, py, 14 + Math.sin(S.t*0.06)*2, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,40,90,0.65)";
      ctx.beginPath();
      ctx.arc(px, py, 7 + Math.cos(S.t*0.08)*2, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // peasants
  for (const n of S.npcs) {
    if (n.used) continue;
    const d = dist(n.x, n.y, h.x, h.y);
    if (d > Math.min(fov+1.5, 12)) continue;

    const px = n.x*tilePx - camX;
    const py = n.y*tilePx - camY;

    // silhouette
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(px-6, py-10, 12, 20);

    // “mask”
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "rgba(220,220,230,0.18)";
    ctx.fillRect(px-4, py-8, 8, 6);

    // effect glyph
    ctx.globalAlpha = 0.95;
    const col = n.effect === "reveal" ? "rgba(255,255,255,0.85)"
              : n.effect === "oxy"    ? "rgba(120,220,255,0.85)"
              : n.effect === "poison" ? "rgba(180,120,255,0.85)"
              : "rgba(255,170,120,0.85)";
    ctx.fillStyle = col;
    ctx.fillRect(px-2, py+2, 4, 4);
    ctx.globalAlpha = 1;
  }

  // projectiles (visible shots)
  for (const pr of S.projectiles) {
    if (!pr.alive) continue;
    const px = pr.x*tilePx - camX;
    const py = pr.y*tilePx - camY;

    // trail
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = pr.from === "hero" ? "rgba(255,220,140,1)" : "rgba(255,40,90,1)";
    ctx.fillRect(px - pr.vx*6, py - pr.vy*6, 3, 3);

    ctx.globalAlpha = 0.95;
    ctx.fillStyle = pr.from === "hero" ? "rgba(255,210,90,1)" : "rgba(255,40,90,1)";
    ctx.fillRect(px-2, py-2, 4, 4);
    ctx.globalAlpha = 1;
  }

  // enemies (more creepy)
  for (const e of S.enemies) {
    if (!e.alive) continue;
    const d = dist(e.x, e.y, h.x, h.y);
    if (d > Math.min(fov+2, 14)) continue;

    const px = e.x*tilePx - camX;
    const py = e.y*tilePx - camY;
    const fear = clamp(1 - d/7, 0, 1);

    const jx = (Math.sin((S.t*0.11) + e.jitter) * 3) * fear;
    const jy = (Math.cos((S.t*0.09) + e.jitter) * 3) * fear;

    // shadow mass
    ctx.globalAlpha = 0.22 + fear*0.25;
    ctx.fillStyle = "rgba(255,0,70,1)";
    ctx.fillRect(px-14+jx, py-14+jy, 28, 28);

    // body
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "rgba(5,5,8,0.95)";
    ctx.fillRect(px-10+jx, py-12+jy, 20, 24);

    // “teeth”
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = "rgba(240,240,255,0.25)";
    ctx.fillRect(px-6+jx, py+4+jy, 12, 3);

    // eyes
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "rgba(255,40,90,0.85)";
    ctx.fillRect(px-6+jx, py-4+jy, 3, 2);
    ctx.fillRect(px+3+jx, py-4+jy, 3, 2);
    ctx.globalAlpha = 1;
  }

  // hero: bigger, brutal, animated
  {
    const px = h.x*tilePx - camX;
    const py = h.y*tilePx - camY;
    const bob = Math.sin(S.t*0.13) * 1.5;

    // cloak/shadow
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "rgba(0,0,0,0.9)";
    ctx.fillRect(px-12, py-10+bob, 24, 22);

    // body
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "rgba(210,220,235,0.9)";
    ctx.fillRect(px-9, py-14+bob, 18, 28);

    // head mask
    ctx.fillStyle = "rgba(25,25,35,0.95)";
    ctx.fillRect(px-7, py-20+bob, 14, 8);

    // eyes
    ctx.fillStyle = "rgba(255,40,90,0.75)";
    ctx.fillRect(px-4, py-18+bob, 2, 2);
    ctx.fillRect(px+2, py-18+bob, 2, 2);

    // weapon hint
    ctx.fillStyle = h.role === "thief" ? "rgba(120,220,255,0.8)"
                : h.role === "killer" ? "rgba(255,210,90,0.8)"
                : "rgba(180,120,255,0.8)";
    ctx.fillRect(px-2, py+10+bob, 4, 4);

    ctx.globalAlpha = 1;
  }

  // poison distortion overlay
  if (h.poison > 0) {
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "rgba(180,100,255,1)";
    ctx.fillRect(0,0,W,H);
    ctx.globalAlpha = 1;
  }

  // grief jitter overlay
  if (h.grief > 0) {
    ctx.globalAlpha = 0.12;
    for (let i=0;i<120;i++){
      ctx.fillStyle = Math.random()<0.5 ? "#0d0d0d" : "#1b1b22";
      ctx.fillRect(Math.random()*W, Math.random()*H, 1+Math.random()*2, 1+Math.random()*2);
    }
    ctx.globalAlpha = 1;
  }

  // suffocation vignette (when oxygen = 0)
  if (h.oxy <= 0) {
    const a = clamp(h.suffocate / 6, 0, 1) * 0.55;
    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.fillRect(0,0,W,H);
    ctx.globalAlpha = 1;
  }
}


