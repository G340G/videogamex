export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const dist  = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);

// RNG helpers (rng is a function that returns [0,1))
export const pick = (rng, arr) => arr[(rng() * arr.length) | 0];
export const randInt = (rng, a, b) => (a + ((rng() * (b - a + 1)) | 0));
