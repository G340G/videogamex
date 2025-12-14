export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);

export function makeRng(seed = 123456) {
  // xorshift32
  let x = seed | 0;
  return function rng() {
    x ^= x << 13; x |= 0;
    x ^= x >>> 17; x |= 0;
    x ^= x << 5;  x |= 0;
    return ((x >>> 0) / 4294967296);
  };
}

export const randInt = (rng, a, b) => a + ((rng() * (b - a + 1)) | 0);
export const pick = (rng, arr) => arr[(rng() * arr.length) | 0];
