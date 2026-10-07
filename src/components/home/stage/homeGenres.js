import { GENRES } from "@/lib/genres";

// Home Genre dial 전용 장르 연출 값. 장르 목록·이름·순서는 lib/genres.js를 따른다.
// ink = 판의 잉크(홈·빛줄기) 색, label = 라벨 면 색. 플럼 배경(#4c404a) 위에서 읽히도록 ink는 밝게, label은 어둡게
export const GENRE_LOOK = {
  'k-indie': { ink: '#f4a28c', label: '#7a3e48', desc: 'Bedroom tapes and small-club anthems from Seoul’s side streets.' },
  'indie': { ink: '#c9d98f', label: '#4f5a33', desc: 'Guitars, home studios and records that sound like a long walk.' },
  'pop': { ink: '#f7b6d2', label: '#8a3d63', desc: 'Big choruses pressed in heavy vinyl.' },
  'rock': { ink: '#ef6f5a', label: '#5a2420', desc: 'Loud on purpose. Best played at 45.' },
  'folk': { ink: '#dcbc8c', label: '#6b5236', desc: 'Close-mic voices and the sound of the room.' },
  'soul': { ink: '#c8a2e8', label: '#57406e', desc: 'Warm low end for slow evenings.' },
  'jazz': { ink: '#8fb8ea', label: '#2f4a73', desc: 'Blue labels, long takes, a little hiss.' },
  'city-pop': { ink: '#7fd6d0', label: '#2c5d6a', desc: 'Neon, synth brass and a highway at night.' },
  'hip-hop': { ink: '#f2c14e', label: '#6b4f1d', desc: 'Breaks, samples and the crate they came from.' },
  'classical': { ink: '#ece0c8', label: '#6e6050', desc: 'Full orchestras folded into one groove.' },
  'ost': { ink: '#a8b5e8', label: '#3d4670', desc: 'Scores you can put on without the film.' },
  'etc': { ink: '#c9bfb6', label: '#5a514c', desc: 'Field recordings, spoken word and everything between.' },
};

/* 장르별 파동 성격 (기본값 WAVE를 덮어씀)
   - rhythm: 파동이 나오는 박자(초)를 순서대로 반복 (±8% 흔들림). 없으면 every 범위에서 무작위
   - dash:   끊긴 눈금(바코드) 획이 나올 확률에 곱해지는 값
   - pulse:  파동이 나올 때 판이 뛰는 세기 (판 크기 대비 비율) */
export const GENRE_WAVE = {
  'k-indie':   { every: [0.45, 1.1], arc: [40, 50], thick: [6, 18], speed: [130, 190], dash: 0.7, pulse: 0.025 },             // 로파이: 거칠게 끊기는 붓결
  'indie':     { every: [0.5, 1.2], train: [1, 3], arc: [40, 52], thick: [8, 20], speed: [130, 180], dash: 0.6, pulse: 0.025 },
  'pop':       { rhythm: [0.55], train: [2, 3], arc: [42, 50], thick: [10, 20], speed: [180, 210], dash: 0.2, pulse: 0.04 },  // 포온더플로어: 고른 박자
  'rock':      { rhythm: [0.42, 0.42, 0.21, 0.21], train: [1, 2], trainGap: [12, 18], arc: [40, 46], thick: [20, 38], speed: [250, 330], dash: 0.8, pulse: 0.055 },   // 두껍고 빠르고 거칠게
  'folk':      { every: [0.9, 1.6], train: [1, 2], arc: [46, 56], thick: [4, 10], speed: [100, 140], dash: 0.4, pulse: 0.015 },   // 가늘고 느리게
  'soul':      { every: [0.7, 1.2], train: [1, 3], arc: [48, 58], thick: [12, 24], speed: [110, 150], dash: 0.15, pulse: 0.03 },  // 길고 매끈하게
  'jazz':      { rhythm: [0.9, 0.45], train: [1, 2], arc: [50, 58], thick: [4, 12], speed: [90, 130], dash: 0.3, pulse: 0.02 },   // 스윙: 길게-짧게, 얇고 긴 호
  'city-pop':  { rhythm: [0.5], train: [3, 5], trainGap: [8, 14], arc: [42, 50], thick: [8, 16], speed: [180, 230], dash: 0.1, pulse: 0.035 },   // 고른 박자, 겹겹이 매끈
  'hip-hop':   { rhythm: [0.55, 0.55, 0.28, 0.62], train: [1, 1], arc: [40, 44], thick: [20, 32], speed: [200, 260], dash: 0.5, pulse: 0.06 },   // 붐뱁: 짧고 묵직하게
  'classical': { every: [0.6, 0.9], train: [4, 6], trainGap: [6, 10], arc: [48, 58], thick: [4, 8], speed: [110, 140], dash: 0, pulse: 0.015 },   // 촘촘하고 고르게
  'ost':       { every: [1.0, 1.8], train: [2, 4], trainGap: [14, 26], arc: [50, 58], thick: [14, 30], speed: [90, 120], dash: 0.25, pulse: 0.045 },   // 느리고 웅장하게 부풀어 오름
  'etc':       { pulse: 0.03 },                                                                                             // 기본값 그대로 (뭐든 섞인 무작위)
};

const FALLBACK = { ink: "#c9bfb6", label: "#5a514c", desc: "" };
export const HOME_GENRES = GENRES.map((g) => ({ slug: g.slug, name: g.name, ...(GENRE_LOOK[g.slug] ?? FALLBACK) }));
