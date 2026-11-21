// 녹음한 효과음 파일 (public/sounds/) 을 Web Audio 로 틀기 — Crate 의 sfx.js 와 Home 의 roomSound.js 가 같이 씀
//  파일은 소리를 켠 뒤에만 받음 (처음 로딩에 얹지 않음). 못 받으면 null → 부르는 쪽이 예전 합성음으로 대신함
export const SOUNDS = {
  flip: "/sounds/flip.mp3",       // 판(재킷) 한 장을 넘기는 소리
  needle: "/sounds/needle.mp3",   // 바늘이 판에 내려앉는 소리
};

const cache = new WeakMap();   // AudioContext → Map(url → Promise<{ buffer, offset } | null>)

/** url 의 소리를 받아 풀어 둠. offset = 앞쪽 무음을 건너뛴 자리(초) — 누르자마자 소리가 나게 */
export function loadSample(ctx, url) {
  let byUrl = cache.get(ctx);
  if (!byUrl) cache.set(ctx, (byUrl = new Map()));
  if (!byUrl.has(url)) {
    byUrl.set(url, fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        const d = buffer.getChannelData(0);
        let i = 0;
        while (i < d.length && Math.abs(d[i]) < 0.015) i++;
        const offset = i >= d.length ? 0 : Math.max(0, i / buffer.sampleRate - 0.004);
        // 파일마다 녹음 크기가 다름 (넘기는 소리는 최대 0.19, 바늘 소리는 0.89) → 가장 큰 곳이 0.8 이 되게 맞춤 (작은 소리는 4배까지만 키움)
        let peak = 0;
        for (let k = 0; k < d.length; k++) { const a = Math.abs(d[k]); if (a > peak) peak = a; }
        return { buffer, offset, norm: peak > 0 ? Math.min(4, 0.8 / peak) : 1 };
      })
      .catch(() => null));
  }
  return byUrl.get(url);
}

/** 풀어 둔 소리 한 번. rate = 빠르기(음높이도 같이 바뀜) · gain = 크기 (1 = 가장 큰 곳이 0.8) · dest = 연결할 곳 (없으면 스피커) */
export function playSample(ctx, sample, { gain = 1, rate = 1, dest = null } = {}) {
  if (!sample || ctx.state !== "running") return false;
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = sample.buffer; src.playbackRate.value = rate; g.gain.value = gain * (sample.norm ?? 1);
  src.connect(g).connect(dest ?? ctx.destination);
  src.onended = () => { src.disconnect(); g.disconnect(); };
  src.start(0, sample.offset);
  return true;
}
