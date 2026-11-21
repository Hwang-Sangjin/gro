import { SOUNDS, loadSample, playSample } from "@/lib/samples";
// Home 의 효과음 (사용자가 소리를 켠 뒤에만 AudioContext 를 만듦: 브라우저 자동 재생 규칙)
//  녹음한 파일 (public/sounds/, 2026-11-22 — 켜는 순간에 받음. 못 받으면 예전 합성음):
//   needleDown(): 바늘이 판에 내려앉음 (Hero → 방에서 판이 턴테이블에 놓일 때 · 멈췄다가 다시 틀 때) · flip(): Hero 에서 재킷을 한 장 넘김
//  Web Audio 로 바로 만드는 것: click() 램프 스위치 딸깍 · needleUp() 톤암 올라감 · setPlaying() 판이 도는 동안 잡음(크래클 + 쉬익)
//  MUSIC_URL 을 넣으면 판이 도는 동안 그 음악을 같이 틀어 줌 (지금은 없음)
const MUSIC_URL = null;

export function createRoomSound() {
  let ctx = null, master = null, crackle = null, crackleGain = null, music = null, musicGain = null;
  let enabled = false, playing = false;
  let needle = null, flip = null, lastFlip = 0;   // 받아 둔 녹음 소리

  const ensure = () => {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    // 판 잡음: 2초짜리 버퍼를 반복 (드문드문 '틱' + 아주 작은 쉬익)
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      lp += (Math.random() * 2 - 1 - lp) * 0.08;
      d[i] = lp * 0.18;
      if (Math.random() < 0.0009) {
        const a = (0.25 + Math.random() * 0.6) * (Math.random() < 0.5 ? -1 : 1);
        for (let k = 0; k < 24 && i + k < len; k++) d[i + k] += a * Math.exp(-k / 4);
      }
    }
    crackle = ctx.createBufferSource();
    crackle.buffer = buf;
    crackle.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 900;
    crackleGain = ctx.createGain();
    crackleGain.gain.value = 0;
    crackle.connect(hp).connect(crackleGain).connect(master);
    crackle.start();
    if (MUSIC_URL) {
      music = new Audio(MUSIC_URL);
      music.loop = true;
      music.crossOrigin = "anonymous";
      musicGain = ctx.createGain();
      musicGain.gain.value = 0;
      ctx.createMediaElementSource(music).connect(musicGain).connect(master);
    }
    return ctx;
  };

  const ramp = (param, v, t = 0.25) => {
    if (!ctx) return;
    param.cancelScheduledValues(ctx.currentTime);
    param.setTargetAtTime(v, ctx.currentTime, t / 3);
  };

  // 짧은 소리 하나: 걸러 낸 잡음 한 번 + (있으면) 낮은 음
  const burst = (freq, q, dur, gain, tone = 0) => {
    if (!enabled || !ensure()) return;
    const t = ctx.currentTime, n = Math.ceil(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n / 5));
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = b;
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = q;
    g.gain.value = gain;
    src.connect(f).connect(g).connect(master);
    src.start(t);
    if (tone) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.frequency.setValueAtTime(tone, t);
      o.frequency.exponentialRampToValueAtTime(tone * 0.5, t + dur * 2);
      og.gain.setValueAtTime(gain * 0.9, t);
      og.gain.exponentialRampToValueAtTime(0.0001, t + dur * 2);
      o.connect(og).connect(master);
      o.start(t);
      o.stop(t + dur * 2 + 0.05);
    }
  };

  const apply = () => {
    if (!ctx) return;
    ramp(master.gain, enabled ? 0.9 : 0, 0.3);
    ramp(crackleGain.gain, playing ? 0.5 : 0, playing ? 0.6 : 0.3);
    if (music) {
      ramp(musicGain.gain, playing ? 0.8 : 0, 0.8);
      if (enabled && playing) music.play().catch(() => {});
      else if (!playing) music.pause();
    }
  };

  return {
    get enabled() { return enabled; },
    setEnabled(on) {
      enabled = on;
      if (on && ensure() && ctx.state === "suspended") ctx.resume();
      if (on && ctx) { loadSample(ctx, SOUNDS.needle).then((s) => { needle = s; }); loadSample(ctx, SOUNDS.flip).then((s) => { flip = s; }); }
      apply();
    },
    setPlaying(on) {
      if (playing === on) return;
      playing = on;
      apply();
    },
    click() { burst(2400, 1.4, 0.03, 0.55); },
    needleDown() {
      if (!enabled || !ensure()) return;
      if (!playSample(ctx, needle, { gain: 0.6, dest: master })) burst(500, 0.8, 0.06, 0.5, 90);
    },
    // 재킷 한 장 넘김: 빠르게 넘길 때 겹쳐 뭉개지지 않게 간격을 두고, 넘길 때마다 빠르기 · 크기를 조금씩 다르게
    flip() {
      if (!enabled || !ensure()) return;
      const now = performance.now();
      if (now - lastFlip < 90) return;
      lastFlip = now;
      if (!playSample(ctx, flip, { rate: 0.94 + Math.random() * 0.16, gain: 0.42 + Math.random() * 0.16, dest: master })) burst(2800, 0.9, 0.05, 0.25);
    },
    needleUp() { burst(1800, 1.2, 0.04, 0.3); },
    dispose() {
      music?.pause();
      ctx?.close();
      ctx = null;
    },
  };
}
