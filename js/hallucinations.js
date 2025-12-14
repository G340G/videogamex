import { clamp, pick } from "./utils.js";

export function triggerHallucination(state){
  const r = state.r;

  const types = [
    "UI_LIE", "FAKE_EXIT", "WALL_BREATH", "DELAY_SHADOW", "TEXT_SPORE"
  ];

  state.effects.push({
    type: pick(r, types),
    t:0,
    dur: 1.8 + r()*2.2,
    intensity: clamp(0.35 + state.escalation*0.12, 0.35, 1.0)
  });
}

export function spawnFaceFlash(state){
  // this triggers the DOM flash overlay (distorted creepy face)
  state.effects.push({
    type:"FACE_FLASH",
    t:0,
    dur: 0.65 + state.r()*0.55,
    intensity: clamp(0.55 + state.escalation*0.10, 0.55, 1.0)
  });
}

export function updateEffects(state, dt){
  for(let i=state.effects.length-1;i>=0;i--){
    const fx = state.effects[i];
    fx.t += dt;
    if(fx.t >= fx.dur){
      state.effects.splice(i,1);
    }
  }
}

export function hallucinationFogBoost(state){
  // increases darkness / reduces FOV as hallucinations rise
  return clamp(1 + state.escalation*0.06, 1, 2.1);
}

