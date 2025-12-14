import { clamp } from "./utils.js";

export function createAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();

  const master = ac.createGain();
  master.gain.value = 0.55;
  master.connect(ac.destination);

  // noise buffer
  const noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  {
    const d = noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      last = 0.97 * last + 0.03 * (Math.random() * 2 - 1);
      d[i] = last;
    }
  }

  // wind/room
  const wind = ac.createBufferSource();
  wind.buffer = noiseBuf; wind.loop = true;
  const windLP = ac.createBiquadFilter();
  windLP.type = "lowpass"; windLP.frequency.value = 240;
  const windG = ac.createGain();
  windG.gain.value = 0.04;
  wind.connect(windLP); windLP.connect(windG); windG.connect(master);
  wind.start();

  // static
  const stat = ac.createBufferSource();
  stat.buffer = noiseBuf; stat.loop = true;
  const statBP = ac.createBiquadFilter();
  statBP.type = "bandpass"; statBP.frequency.value = 1150; statBP.Q.value = 0.9;
  const statG = ac.createGain();
  statG.gain.value = 0.018;
  stat.connect(statBP); statBP.connect(statG); statG.connect(master);
  stat.start();

  // lullaby
  const musicG = ac.createGain();
  musicG.gain.value = 0.05;
  musicG.connect(master);

  // “breathing” throb
  const breathG = ac.createGain();
  breathG.gain.value = 0.03;
  breathG.connect(master);

  let running = true;
  let fear = 0;

  const scale = [0, 2, 3, 5, 7, 10]; // minor-ish
  const base = 110;

  function bleep(freq, dur, amp) {
    const t = ac.currentTime;
    const o = ac.createOscillator();
    o.type = Math.random() < 0.25 ? "triangle" : "square";
    o.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(musicG);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function clank(intensity = 0.7) {
    const t = ac.currentTime;
    const o = ac.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = 90 + Math.random() * 240;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 500 + Math.random() * 2000;
    bp.Q.value = 10;

    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06 * intensity, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

    o.connect(bp); bp.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.14);
  }

  function breathePulse() {
    if (!running) return;
    const t = ac.currentTime;

    const o = ac.createOscillator();
    o.type = "sine";
    o.frequency.value = 45 + fear * 30;

    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03 + fear * 0.06, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);

    o.connect(g); g.connect(breathG);
    o.start(t);
    o.stop(t + 0.72);

    setTimeout(breathePulse, 600 + Math.random() * 480 - fear * 250);
  }
  setTimeout(breathePulse, 500);

  function musicTick() {
    if (!running) return;
    const step = scale[(Math.random() * scale.length) | 0];
    const freq = base * Math.pow(2, step / 12);

    // intentionally sparse
    if (Math.random() < 0.55) bleep(freq, 0.10 + Math.random() * 0.12, 0.045 + fear * 0.02);
    if (Math.random() < 0.18) bleep(freq * 2, 0.06 + Math.random() * 0.08, 0.02 + fear * 0.02);

    if (Math.random() < 0.09 + fear * 0.18) clank(0.5 + fear);

    setTimeout(musicTick, 240 + Math.random() * 700 - fear * 250);
  }
  setTimeout(musicTick, 600);

  function setFear(f) {
    fear = clamp(f, 0, 1);
    const t = ac.currentTime;

    statG.gain.setTargetAtTime(0.014 + fear * 0.12, t, 0.12);
    statBP.Q.setTargetAtTime(0.9 + fear * 10, t, 0.12);
    windG.gain.setTargetAtTime(0.03 + fear * 0.10, t, 0.15);
    musicG.gain.setTargetAtTime(0.045 + fear * 0.05, t, 0.25);

    if (fear > 0.7 && Math.random() < 0.15) clank(0.9);
  }

  async function resume() {
    if (ac.state === "suspended") {
      try { await ac.resume(); } catch {}
    }
  }

  function blip(intensity = 0.8) {
    clank(intensity);
  }

  function stop() {
    running = false;
  }

  return { ac, resume, setFear, blip, stop };
}

