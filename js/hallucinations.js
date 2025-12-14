import { clamp } from "./utils.js";

export function spawnFaceFlash(state){
  state.effects.push({type:"FACE_FLASH", t:0, dur:0.55, intensity:1});
}

export function updateEffects(state, dt){
  for(let i=state.effects.length-1; i>=0; i--){
    const e = state.effects[i];
    e.t += dt;
    if(e.t >= e.dur) state.effects.splice(i,1);
  }

  // sanity decay from GRIEF / POISON (subtle)
  const grief = state.effects.some(e=>e.type==="GRIEF");
  const poison = state.effects.some(e=>e.type==="POISON");
  if(grief) state.player.sanity = clamp(state.player.sanity - dt*2.5, 0, state.player.sanityMax);
  if(poison) state.player.sanity = clamp(state.player.sanity - dt*1.2, 0, state.player.sanityMax);
}

