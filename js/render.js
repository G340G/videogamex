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


