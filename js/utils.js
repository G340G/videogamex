export const clamp = (v,a,b)=> v<a?a : v>b?b : v;
export const lerp = (a,b,t)=> a + (b-a)*t;

export function rng(seed){
  // mulberry32
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(r, arr){
  return arr[(r()*arr.length)|0];
}

export function hashStr(s){
  let h=2166136261>>>0;
  for(let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h>>>0;
}

export function dist(a,b,c,d){ return Math.hypot(a-c, b-d); }

export function now(){ return performance.now(); }

export function rectsOverlap(ax,ay,aw,ah, bx,by,bw,bh){
  return ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by;
}

