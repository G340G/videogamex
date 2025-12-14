import { clamp, rand, randInt } from "./utils.js";

export function createAudio(){
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();

  const master = ac.createGain();
  master.gain.value = 0.60;
  master.connect(ac.destination);

  const busAmb = ac.createGain();
  const busMus = ac.createGain();
  const busFx  = ac.createGain();

  busAmb.gain.value = 0.55;
  busMus.gain.value = 0.55;
  busFx.gain.value  = 0.75;

  busAmb.connect(master);
  busMus.connect(master);
  busFx.connect(master);

  // --- noise buffer ---
  const noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  {
    const d = noiseBuf.getChannelData(0);
    let last = 0;
    for (let i=0;i<d.length;i++){
      last = 0.975 * last + 0.025 * (Math.random()*2 - 1);
      d[i] = last;
    }
  }

  // --- ambient wind/static bed ---
  const wind = ac.createBufferSource();
  wind.buffer = noiseBuf;
  wind.loop = true;

  const windLP = ac.createBiquadFilter();
  windLP.type = "lowpass";
  windLP.frequency.value = 220;

  const windGain = ac.createGain();
  windGain.gain.value = 0.04;

  wind.connect(windLP);
  windLP.connect(windGain);
  windGain.connect(busAmb);
  wind.start();

  const stat = ac.createBufferSource();
  stat.buffer = noiseBuf;
  stat.loop = true;

  const statBP = ac.createBiquadFilter();
  statBP.type = "bandpass";
  statBP.frequency.value = 1200;
  statBP.Q.value = 0.8;

  const statGain = ac.createGain();
  statGain.gain.value = 0.015;

  stat.connect(statBP);
  statBP.connect(statGain);
  statGain.connect(busAmb);
  stat.start();

  // --- drone ---
  const drone = ac.createOscillator();
  drone.type = "sine";
  drone.frequency.value = 54;

  const droneLP = ac.createBiquadFilter();
  droneLP.type = "lowpass";
  droneLP.frequency.value = 420;

  const droneGain = ac.createGain();
  droneGain.gain.value = 0.05;

  drone.connect(droneLP);
  droneLP.connect(droneGain);
  droneGain.connect(busAmb);
  drone.start();

  // --- lullaby / broken music box ---
  const scale = [0, 2, 3, 7, 10]; // minor-ish pentatonic
  let tempo = 86;
  let nextT = ac.currentTime + 0.05;
  let step = 0;
  let fear = 0;

  function pluck(t, freq, dur, amp){
    const o = ac.createOscillator();
    o.type = Math.random() < 0.6 ? "triangle" : "square";
    o.frequency.value = freq;

    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900 - fear*420;

    o.connect(lp);
    lp.connect(g);
    g.connect(busMus);

    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function scheduler(){
    const ahead = 0.12;
    while (nextT < ac.currentTime + ahead){
      const beat = 60 / tempo;
      const barPos = step % 16;

      // intentional “silences”
      const silentChance = 0.18 + fear*0.25;
      const doNote = Math.random() > silentChance;

      if (doNote){
        const base = 110 + (Math.random()<0.5 ? 0 : 55);
        const deg = scale[(Math.random()*scale.length)|0] + (Math.random()<0.25 ? 12 : 0);
        const freq = base * Math.pow(2, deg/12);

        const amp = 0.025 + (0.02 * (1 - fear)) + (Math.random()*0.01);
        const dur = 0.10 + Math.random()*0.08;

        // “music box wobble”
        const det = (Math.random()*6 - 3) * (1 + fear*2);
        pluck(nextT, freq * Math.pow(2, det/1200), dur, amp);
      }

      // rare glitch chime
      if (fear > 0.55 && Math.random() < 0.06){
        pluck(nextT + 0.02, 880 + Math.random()*660, 0.06, 0.04);
      }

      // micro tempo drift
      if (barPos === 0 && Math.random() < 0.35){
        tempo = clamp(tempo + (Math.random()*8 - 4), 72, 102);
      }

      nextT += beat / 4; // 16th note grid
      step++;
    }
    setTimeout(scheduler, 25);
  }
  scheduler();

  // --- one-shot blip ---
  function blip(intensity=0.5){
    const t = ac.currentTime;
    const o = ac.createOscillator();
    o.type = Math.random()<0.5 ? "square" : "triangle";
    o.frequency.value = 120 + Math.random()*1600;

    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 500 + Math.random()*2500;
    bp.Q.value = 8;

    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08*intensity, t+0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t+0.10);

    o.connect(bp);
    bp.connect(g);
    g.connect(busFx);

    o.start(t);
    o.stop(t+0.12);
  }

  function setFear(f){
    fear = clamp(f, 0, 1);
    const t = ac.currentTime;

    statBP.frequency.setTargetAtTime(700 + fear*2600, t, 0.25);
    statGain.gain.setTargetAtTime(0.012 + fear*0.06, t, 0.10);

    windLP.frequency.setTargetAtTime(140 + (1-fear)*240, t, 0.35);
    windGain.gain.setTargetAtTime(0.035 + fear*0.06, t, 0.20);

    droneLP.frequency.setTargetAtTime(260 + (1-fear)*420, t, 0.35);
    droneGain.gain.setTargetAtTime(0.04 + fear*0.05, t, 0.30);

    // occasional “shock”
    if (fear > 0.75 && Math.random() < 0.03) blip(1.0);
  }

  function setTheme(themeKey){
    // mild timbral changes per atmosphere
    const t = ac.currentTime;
    if (themeKey === "forest"){
      windLP.frequency.setTargetAtTime(240, t, 0.8);
      drone.frequency.setTargetAtTime(48, t, 1.0);
    } else if (themeKey === "cemetery"){
      windLP.frequency.setTargetAtTime(160, t, 0.8);
      drone.frequency.setTargetAtTime(43, t, 1.0);
    } else if (themeKey === "asylum"){
      windLP.frequency.setTargetAtTime(210, t, 0.8);
      drone.frequency.setTargetAtTime(55, t, 1.0);
    } else if (themeKey === "catacombs"){
      windLP.frequency.setTargetAtTime(120, t, 0.8);
      drone.frequency.setTargetAtTime(36, t, 1.0);
    } else { // prison
      windLP.frequency.setTargetAtTime(180, t, 0.8);
      drone.frequency.setTargetAtTime(50, t, 1.0);
    }
  }

  async function resume(){
    if (ac.state === "suspended"){
      await ac.resume();
    }
  }

  return { ac, resume, blip, setFear, setTheme };
}

