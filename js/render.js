import { clamp, dist } from "./utils.js";
import { isWall } from "./map.js";

export function render(ctx, state) {
  const { map, theme, hero } = state;

  // HARD GUARD: no map yet => draw something instead of crashing
  if (!map || !map.length || !map[0] || !map[0].length) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
    ctx.fillStyle = "#aaddaa";
    ctx.font = "22px VT323";
    ctx.textAlign = "center";
    ctx.fillText("LOADING MAP...", ctx.canvas.width/2, ctx.canvas.height/2);
    return;
  }

  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  const tilePx = state.tilePx;
  const mapH = map.length;
  const mapW = map[0].length;

  // camera in pixels
  const camX = hero.x * tilePx - W / 2;
  const camY = hero.y * tilePx - H / 2;

  // FOV
  let fov = state.baseFov;
  if (hero.reveal > 0) fov = Math.max(fov, state.baseFov * 1.45);

  // visible tile bounds
  const minTX = clamp(Math.floor(camX / tilePx) - 2, 0, mapW - 1);
  const maxTX = clamp(Math.floor((camX + W) / tilePx) + 2, 0, mapW - 1);
  const minTY = clamp(Math.floor(camY / tilePx) - 2, 0, mapH - 1);
  const maxTY = clamp(Math.floor((camY + H) / tilePx) + 2, 0, mapH - 1);

  // background tint
  ctx.fillStyle = "#050505";
  ctx.fillRect(0,0,W,H);

  // draw tiles
  for (let ty = minTY; ty <= maxTY; ty++) {
    const row = map[ty];
    if (!row) continue;

    for (let tx = minTX; tx <= maxTX; tx++) {
      const t = row[tx] ?? 1;

      // distance fog
      const d = dist(tx + 0.5, ty + 0.5, hero.x, hero.y);
      if (d > fov) continue;
      let vis = 1 - (d / fov);
      vis = Math.pow(vis, 0.65);
      ctx.globalAlpha = clamp(vis, 0, 1);

      const px = tx * tilePx - camX;
      const py = ty * tilePx - camY;

      if (t === 1) {
        ctx.fillStyle = theme.wall;
        ctx.fillRect(px, py, tilePx, tilePx);
        ctx.globalAlpha *= 0.35;
        ctx.strokeStyle = "#000";
        ctx.strokeRect(px, py, tilePx, tilePx);
      } else {
        ctx.fillStyle = theme.floor;
        ctx.fillRect(px, py, tilePx, tilePx);
        if ((tx + ty) % 9 === 0) {
          ctx.globalAlpha *= 0.30;
          ctx.fillStyle = theme.accent;
          ctx.fillRect(px + (Math.sin((state.t*0.02)+(tx*0.4))*2), py + (Math.cos((state.t*0.02)+(ty*0.4))*2), 1, 1);
        }
      }
    }
  }
  ctx.globalAlpha = 1;

  // draw keys
  for (const k of state.keysOnMap) {
    if (k.taken) continue;
    const d = dist(k.x + 0.5, k.y + 0.5, hero.x, hero.y);
    if (d > fov + 0.6) continue;
    const px = (k.x + 0.5) * tilePx - camX;
    const py = (k.y + 0.5) * tilePx - camY;
    const pulse = 0.6 + Math.sin(state.t*0.08 + k.x) * 0.25;
    ctx.fillStyle = `rgba(255,210,70,${pulse})`;
    ctx.fillRect(px - 4, py - 4, 8, 8);
  }

  // portal
  if (state.portal) {
    const p = state.portal;
    const d = dist(p.x + 0.5, p.y + 0.5, hero.x, hero.y);
    if (d <= fov + 1.0) {
      const px = (p.x + 0.5) * tilePx - camX;
      const py = (p.y + 0.5) * tilePx - camY;
      const a = state.keysCollected >= state.totalKeys ? 0.95 : 0.35;
      ctx.fillStyle = `rgba(240,240,255,${a})`;
      ctx.beginPath();
      ctx.arc(px, py, 12 + Math.sin(state.t*0.08)*2, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,60,90,${a*0.7})`;
      ctx.beginPath();
      ctx.arc(px, py, 6 + Math.cos(state.t*0.10)*1.5, 0, Math.PI*2);
      ctx.fill();
    }
  }

  // psych peasants
  for (const n of state.npcs) {
    if (n.used) continue;
    const d = dist(n.x, n.y, hero.x, hero.y);
    if (d > fov + 0.6) continue;
    const px = n.x * tilePx - camX;
    const py = n.y * tilePx - camY;

    ctx.globalAlpha = 0.8;
    ctx.fillStyle = "rgba(170,220,170,0.22)";
    ctx.fillRect(px - 7, py - 7, 14, 14);

    ctx.globalAlpha = 0.9;
    ctx.fillStyle = n.effect === "oxy" ? "rgba(120,200,255,0.85)"
                  : n.effect === "reveal" ? "rgba(255,255,255,0.75)"
                  : n.effect === "poison" ? "rgba(170,120,255,0.75)"
                  : "rgba(255,160,120,0.75)";
    ctx.fillRect(px - 3, py - 3, 6, 6);
    ctx.globalAlpha = 1;
  }

  // enemies (abstract + jitter)
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const d = dist(e.x, e.y, hero.x, hero.y);
    if (d > fov + 1.2) continue;
    const px = e.x * tilePx - camX;
    const py = e.y * tilePx - camY;
    const jx = (Math.random() - 0.5) * 4 * clamp(1 - d/7, 0, 1);
    const jy = (Math.random() - 0.5) * 4 * clamp(1 - d/7, 0, 1);

    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "rgba(255,0,60,0.25)";
    ctx.fillRect(px - 10 + jx, py - 10 + jy, 20, 20);

    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "rgba(10,10,12,0.9)";
    ctx.fillRect(px - 7 + jx, py - 7 + jy, 14, 14);

    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "rgba(255,60,90,0.8)";
    ctx.fillRect(px - 4 + jx, py - 1 + jy, 3, 2);
    ctx.fillRect(px + 1 + jx, py - 1 + jy, 3, 2);

    ctx.globalAlpha = 1;
  }

  // hero (animated creepy figure)
  {
    const hx = hero.x * tilePx - camX;
    const hy = hero.y * tilePx - camY;
    const bob = Math.sin(state.t * 0.12) * 1.2;
    const flick = (Math.sin(state.t * 0.32) > 0.92) ? 0.35 : 1;

    // body
    ctx.globalAlpha = flick;
    ctx.fillStyle = "rgba(210,220,235,0.9)";
    ctx.fillRect(hx - 4, hy - 6 + bob, 8, 12);

    // head
    ctx.fillStyle = "rgba(30,30,40,0.95)";
    ctx.fillRect(hx - 3, hy - 10 + bob, 6, 5);

    // eyes
    ctx.fillStyle = "rgba(255,60,90,0.75)";
    ctx.fillRect(hx - 2, hy - 9 + bob, 1, 1);
    ctx.fillRect(hx + 1, hy - 9 + bob, 1, 1);

    // role mark
    ctx.fillStyle = hero.role === "thief" ? "rgba(120,200,255,0.8)"
                : hero.role === "killer" ? "rgba(255,210,70,0.8)"
                : "rgba(170,120,255,0.8)";
    ctx.fillRect(hx - 1, hy + 3 + bob, 2, 2);

    ctx.globalAlpha = 1;
  }

  // fog vignette + poison distortion tint
  if (hero.poison > 0) {
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "rgba(160,90,255,1)";
    ctx.fillRect(0,0,W,H);
    ctx.globalAlpha = 1;
  }
  if (hero.grief > 0) {
    // anxiety shimmer
    ctx.globalAlpha = 0.10;
    for (let i=0;i<80;i++){
      ctx.fillStyle = Math.random()<0.5 ? "#0d0d0d" : "#1a1a1a";
      ctx.fillRect(Math.random()*W, Math.random()*H, 1+Math.random()*2, 1+Math.random()*2);
    }
    ctx.globalAlpha = 1;
  }
}


