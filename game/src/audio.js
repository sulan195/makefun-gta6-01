// audio.js — every sound in Solmar City is synthesised here with WebAudio:
// engine hum, horn, siren, gunshot, thud, chime and a quiet bassline.
// No audio files, no network. Everything is guarded: if the browser has no
// AudioContext (headless screenshots, old browsers), every call is a no-op.

export function createAudio() {
  return {
    ctx: null, master: null, engineOsc: null, engineGain: null,
    sirenOsc: null, sirenGain: null, musicTimer: 0, musicStep: 0,
    enabled: false, sirenOn: false,
  };
}

// Call from a user gesture (key/click). Safe to call repeatedly.
export function unlockAudio(audio) {
  if (audio.enabled) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    audio.ctx = ctx;
    audio.master = ctx.createGain();
    audio.master.gain.value = 0.35;
    audio.master.connect(ctx.destination);
    // Engine: a low sawtooth whose pitch follows speed.
    audio.engineOsc = ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 55;
    audio.engineGain = ctx.createGain();
    audio.engineGain.gain.value = 0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    audio.engineOsc.connect(engineFilter);
    engineFilter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    // Siren: a triangle that wails between two notes.
    audio.sirenOsc = ctx.createOscillator();
    audio.sirenOsc.type = 'triangle';
    audio.sirenOsc.frequency.value = 720;
    audio.sirenGain = ctx.createGain();
    audio.sirenGain.gain.value = 0;
    audio.sirenOsc.connect(audio.sirenGain);
    audio.sirenGain.connect(audio.master);
    audio.sirenOsc.start();
    audio.enabled = true;
  } catch (e) {
    audio.enabled = false;
  }
}

function blip(audio, freq, dur, type, vol, slideTo) {
  if (!audio.enabled || !audio.ctx) return;
  try {
    const t = audio.ctx.currentTime;
    const o = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(audio.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch (e) { /* audio is best-effort */ }
}

function noiseBurst(audio, dur, vol, filterFreq) {
  if (!audio.enabled || !audio.ctx) return;
  try {
    const t = audio.ctx.currentTime;
    const len = Math.floor(audio.ctx.sampleRate * dur);
    const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buf;
    const f = audio.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = audio.ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(audio.master);
    src.start(t);
  } catch (e) { /* audio is best-effort */ }
}

export function playHorn(audio) { blip(audio, 330, 0.28, 'square', 0.12, 300); }
export function playGunshot(audio) { noiseBurst(audio, 0.14, 0.5, 1800); }
export function playThud(audio) { noiseBurst(audio, 0.12, 0.35, 300); blip(audio, 90, 0.12, 'sine', 0.3, 50); }
export function playPickup(audio) { blip(audio, 660, 0.09, 'sine', 0.2); blip(audio, 990, 0.14, 'sine', 0.18); }
export function playCash(audio) {
  blip(audio, 880, 0.08, 'sine', 0.2);
  setTimeout(() => blip(audio, 1174, 0.12, 'sine', 0.2), 90);
}
export function playBusted(audio) { blip(audio, 220, 0.5, 'sawtooth', 0.2, 110); }

// Per-frame: engine pitch from speed, siren wail while wanted > 0, music.
export function updateAudio(audio, dt, speed, wanted) {
  if (!audio.enabled || !audio.ctx) return;
  try {
    const t = audio.ctx.currentTime;
    if (audio.engineOsc) {
      audio.engineOsc.frequency.setTargetAtTime(50 + Math.abs(speed) * 0.35, t, 0.05);
      audio.engineGain.gain.setTargetAtTime(Math.abs(speed) > 5 ? 0.05 : 0.015, t, 0.1);
    }
    const wantSiren = wanted > 0;
    if (audio.sirenOsc) {
      audio.sirenGain.gain.setTargetAtTime(wantSiren ? 0.045 : 0, t, 0.2);
      if (wantSiren) {
        audio.sirenOsc.frequency.setTargetAtTime(
          660 + 260 * Math.sin(t * 4.4), t, 0.05);
      }
    }
    // Quiet bassline: one soft note every half second, A minor walk.
    audio.musicTimer += dt;
    if (audio.musicTimer >= 0.5) {
      audio.musicTimer -= 0.5;
      const notes = [110, 130.8, 98, 146.8, 110, 130.8, 164.8, 146.8];
      blip(audio, notes[audio.musicStep % notes.length], 0.42, 'sine', 0.05);
      audio.musicStep++;
    }
  } catch (e) { /* audio is best-effort */ }
}
