import { clamp } from "./utils.js";

// Procedural “Silent-Hill-ish”:
// - long silences
// - detuned lullaby fragments
// - industrial noise bed that breathes with fear
// - reacts to oxygen/sanity/escalation/proximity

export function createAudio(state){
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();

  const master = ac.createGain();
  master.gain.value = 0.55;
  master.connect(ac.destination);

  const noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  {
    const d = noiseBuf.getChannelData(0);
    let last = 0;
    for (let i=0;i<d.length;i++){
      last = 0.97*last + 0.03*(Math.random()*2-1);
      d[i] = last;
    }
  }

  // bed noise (wind/static hybrid)
  const wind = ac.createBufferSource();
  wind.buffer = noiseBuf; wind.loop = true;
  const windLP = ac.createBiquadFilter(); windLP.type="lowpass"; windLP.frequency.value=220;
  const windG = ac.createGain(); windG.gain.value = 0.02;
  wind.connect(windLP); windLP.connect(windG); windG.connect(master);
  wind.start();

  const grit = ac.createBufferSource();
  grit.buffer = noiseBuf; grit.loop = true;
  const gritBP = ac.createBiquadFilter(); gritBP.type="bandpass"; gritBP.frequency.value=1200; gritBP.Q.value=0.9;
  const gritG = ac.createGain(); gritG.gain.value = 0.012;
  grit.connect(gritBP); gritBP.connect(gritG); gritG.connect(master);
  grit.start();

  // drone
  const drone = ac.createOscillator();
  drone.type = "sine";
  drone.frequency.value = 55;
  const droneLP = ac.createBiquadFilter(); droneLP.type="lowpass"; droneLP.frequency.value = 420;
  const droneG = ac.createGain(); droneG.gain.value = 0.018;
  drone.connect(droneLP); droneLP.connect(droneG); droneG.connect(master);
  drone.start();

  // detune LFO
  const lfo = ac.createOscillator(); lfo.type="sine"; lfo.frequency.value = 0.09;
  const lfoG = ac.createGain(); lfoG.gain.value = 15;
  lfo.connect(lfoG); lfoG.connect(drone.frequency);
  lfo.start();

  // lullaby voice (sparse)
  let nextLull = ac.currentTime + 1.0;

  function pluckNote(freq, len=0.22, gain=0.06){
    const t = ac.currentTime;
    const o = ac.createOscillator();
    o.type = Math.random()<0.5 ? "triangle" : "square";
    o.frequency.value = freq;

    const f = ac.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 900;

    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t+len);

    o.connect(f); f.connect(g); g.connect(master);
    o.start(t); o.stop(t+len+0.02);
  }

  // “hit” tick
  function hit(intensity=0.3){
    const t = ac.currentTime;
    const o = ac.createOscillator();
    o.type = "square";
    o.frequency.value = 90 + Math.random()*60;

    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09*intensity, t+0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t+0.11);

    const bp = ac.createBiquadFilter();
    bp.type="bandpass"; bp.frequency.value = 240 + Math.random()*700; bp.Q.value=8;

    o.connect(bp); bp.connect(g); g.connect(master);
    o.start(t); o.stop(t+0.12);
  }

  // “blip” (UI / interact)
  function blip(intensity=0.3){
    const t = ac.currentTime;
    const o = ac.createOscillator();
    o.type = Math.random()<0.5 ? "triangle" : "square";
    o.frequency.value = 220 + Math.random()*1400;

    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07*intensity, t+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t+0.09);

    o.connect(g); g.connect(master);
    o.start(t); o.stop(t+0.10);
  }

  function corrupt(){
    // escalate distortion & noise
    const t = ac.currentTime;
    gritBP.frequency.setTargetAtTime(500 + Math.random()*2500, t, 0.6);
    gritBP.Q.setTargetAtTime(0.8 + Math.random()*10, t, 0.6);
    gritG.gain.setTargetAtTime(0.01 + Math.random()*0.05, t, 0.6);
  }

  function setFear(f){
    // f in [0,1]
    const t = ac.currentTime;
    const fear = clamp(f,0,1);
    windLP.frequency.setTargetAtTime(140 + (1-fear)*200, t, 0.4);
    windG.gain.setTargetAtTime(0.018 + fear*0.05, t, 0.2);

    gritG.gain.setTargetAtTime(0.010 + fear*0.08, t, 0.25);
    droneG.gain.setTargetAtTime(0.014 + fear*0.05, t, 0.35);
    droneLP.frequency.setTargetAtTime(260 + (1-fear)*520, t, 0.8);
  }

  function tickMusic(state){
    if (state.muted) return;

    const t = ac.currentTime;

    // silence windows
    const silenceBias = clamp(0.55 - state.escalation*0.03, 0.18, 0.55);
    if (t >= nextLull){
      nextLull = t + (0.7 + Math.random()*2.4) + (Math.random()<silenceBias ? 1.8 : 0);

      // small minor-ish motif (8-bit lullaby)
      const base = 220 * (Math.random()<0.5 ? 1 : 0.5);
      const steps = [0, 3, 7, 10, 12]; // minor-ish
      const count = 1 + (Math.random()*3|0);

      for(let i=0;i<count;i++){
        const st = steps[(Math.random()*steps.length)|0];
        const freq = base * Math.pow(2, st/12);
        pluckNote(freq, 0.14 + Math.random()*0.18, 0.03 + Math.random()*0.05);
      }
      if (Math.random()<0.15) pluckNote(base/2, 0.25, 0.05);
    }
  }

  return {
    ac,
    resume: async()=> { if (ac.state==="suspended") await ac.resume(); },
    setFear,
    blip,
    hit,
    corrupt,
    tickMusic
  };
}

