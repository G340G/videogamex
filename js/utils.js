export function clamp(v, a, b){ return v < a ? a : v > b ? b : v; }
export function dist(ax, ay, bx, by){ return Math.hypot(ax - bx, ay - by); }
export function rand(){ return Math.random(); }
export function randInt(a, b){ return a + ((Math.random() * (b - a + 1)) | 0); }
export function pick(arr){ return arr[(Math.random() * arr.length) | 0]; }

export function loadImage(src){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load: " + src));
    img.src = src;
  });
}


