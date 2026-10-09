"use client";

/* 앨범 상세 배경의 움직이는 그레인 그라디언트 (reactbits Grainient 참고, 셰이더는 직접 작성).
   - 커버 색 하나에서 3색(기본·어두운 쪽·밝은 쪽, 색상을 살짝 돌림)을 만들어 노이즈 도메인 워프로 섞음
   - WebGL2만 사용(추가 라이브러리 없음). 블러 같은 그림이라 해상도는 낮게(DPR 0.5~1) 그림
   - 화면 밖·탭 숨김이면 멈추고, reduced-motion이면 한 장만 그림
   - 위·아래 끝은 마스크로 사라져서 헤더(단색)·아래 CSS 그라디언트와 이어짐 */
import { useEffect, useRef } from "react";
import { contrastRatio } from "@/lib/album-theme";

// 조정값 (Grainient의 props에 해당)
const LOOK = {
  speed: 0.018,      // 흐름 속도 (아주 느리게)
  warp: 1.3,         // 도메인 워프 세기 (클수록 소용돌이가 큼)
  scale: 0.7,        // 무늬 크기 (작을수록 큰 덩어리) — 큰 덩어리로 완만하게
  wave: 0.06,        // 부드러운 물결 왜곡
  grain: 0.03,       // 셰이더 자체 그레인 (종이 질감과 별도)
  darker: { hue: -6, sat: 1.03, light: -0.055 },  // 2번 색 — 커버 색에서 조금만
  lighter: { hue: 8, sat: 0.98, light: 0.05 },    // 3번 색
  accent: 0.28,      // 커버 이미지 강조색을 3번 색에 섞는 최대 비율
  accentMix: 0.6,    // 3번 색이 덮는 최대 세기
  darkBase: 0.22,    // 커버 색 밝기(HSL L)가 이보다 낮으면 '어두운 커버' 배합
  darkLift: 0.35,    // 어두운 커버에서 큰 소용돌이를 밝은 톤 쪽으로 올리는 비율
  resolution: 0.6,   // 렌더 해상도 배율 (CSS 픽셀 기준)
};

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uC1, uC2, uC3;
uniform float uWarp, uScale, uWave, uGrain, uAccentMix;
out vec4 outColor;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float noise(vec2 p) {            // gradient noise
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dot(hash2(i), f), dot(hash2(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
             mix(dot(hash2(i + vec2(0, 1)), f - vec2(0, 1)), dot(hash2(i + vec2(1, 1)), f - vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = r * p * 2.03; a *= 0.5; }
  return v;
}
float grain(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453) - 0.5; }

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y) * uScale;
  float t = uTime;
  // 부드러운 물결
  p += uWave * vec2(sin(p.y * 2.6 + t * 1.3), cos(p.x * 2.2 - t * 1.1));
  // 2단 도메인 워프
  vec2 q = vec2(fbm(p + vec2(0.0, t * 0.7)), fbm(p + vec2(5.2, 1.3) - t * 0.6));
  vec2 r = vec2(fbm(p + uWarp * q + vec2(1.7, 9.2) + t * 0.35), fbm(p + uWarp * q + vec2(8.3, 2.8) - t * 0.3));
  float f = fbm(p + uWarp * r);
  float a = smoothstep(-0.32, 0.38, f);
  float b = smoothstep(0.02, 0.5, r.x + 0.35 * q.y);
  vec3 col = mix(uC2, uC1, a);
  col = mix(col, uC3, b * uAccentMix);
  col += uGrain * grain(gl_FragCoord.xy);
  outColor = vec4(col, 1.0);
}`;

// ── 색 계산 ──
function hexToHsl(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360; s = Math.min(1, Math.max(0, s)); l = Math.min(0.96, Math.max(0.04, l));
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map(n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))));
}
const toHex = c => "#" + c.map(v => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
// 커버 색 → 3톤. 글자색(ink)과의 대비가 4.5:1 아래로 떨어지면 그 톤만 커버 색 쪽으로 당김
export function grainientColors(hex, ink, accent) {
  const [h, s, l] = hexToHsl(hex);
  const shift = ({ hue, sat, light }, k) => hslToRgb(h + hue * k, s * (1 + (sat - 1) * k), l + light * k);
  const safe = look => {
    for (let k = 1; k > 0; k -= 0.1) { const c = shift(look, k); if (!ink || contrastRatio(toHex(c), ink) >= 4.5) return c; }
    return shift(look, 0);
  };
  // 커버 이미지에서 뽑은 강조색이 있으면 밝은 톤을 그 색 쪽으로 (검정·회색 커버도 색이 살아남)
  const lift = accent && accentUsable(accent, [h, s, l]) ? safeAccent(hslToRgb(h, s, l), accent, ink) : null;
  const base = hslToRgb(h, s, l), light = lift ?? safe(LOOK.lighter);
  // 아주 어두운 커버: 더 어둡게 할 여지가 없어 무늬가 거의 안 보임 →
  // 큰 소용돌이(1번 색)를 밝은 톤의 절반쯤으로 올려 화면 전체에 흐름이 보이게
  if (l < LOOK.darkBase) return [base.map((v, i) => v + (light[i] - v) * LOOK.darkLift), base, light];
  return [base, safe(LOOK.darker), light];
}
// 강조색이 커버 색과 충분히 다를 때만 씀 (이미 채도 있는 커버면 기존 방식 유지)
function accentUsable(accent, [, s]) {
  const [, as] = hexToHsl(toHex(accent));
  return as > 0.35 && as - s > 0.25;
}
function safeAccent(base, accent, ink) {
  for (let k = LOOK.accent; k > 0.05; k -= 0.05) {
    const c = base.map((v, i) => v + (accent[i] - v) * k);
    if (!ink || contrastRatio(toHex(c), ink) >= 4.5) return c;
  }
  return null;
}
// 커버 썸네일을 24×24로 줄여 채도·밝기 가중 평균 → 커버의 대표 강조색 (CORS 막히면 null)
export function sampleAccent(url) {
  return new Promise(resolve => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const n = 24, cv = document.createElement("canvas");
        cv.width = cv.height = n;
        const ctx = cv.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, n, n);
        const d = ctx.getImageData(0, 0, n, n).data;
        let r = 0, g = 0, b = 0, w = 0;
        for (let i = 0; i < d.length; i += 4) {
          const [, ps, pl] = hexToHsl(toHex([d[i] / 255, d[i + 1] / 255, d[i + 2] / 255]));
          const wt = ps * ps * Math.max(0, 1 - Math.abs(pl - 0.5) * 1.6);
          r += d[i] * wt; g += d[i + 1] * wt; b += d[i + 2] * wt; w += wt;
        }
        resolve(w > 0.5 ? [r / w / 255, g / w / 255, b / w / 255] : null);
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export default function AlbumGrainient({ color, ink, image, className = "" }) {
  const canvasRef = useRef(null);
  const colorRef = useRef([color, ink, null]);
  const redrawRef = useRef(() => {});

  useEffect(() => {
    colorRef.current = [color, ink, null];
    redrawRef.current();
    let alive = true;
    sampleAccent(image).then(accent => {
      if (!alive || !accent) return;
      colorRef.current = [color, ink, accent];
      redrawRef.current();
    });
    return () => { alive = false; };
  }, [color, ink, image]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl2", { antialias: false, alpha: false, premultipliedAlpha: false });
    if (!gl || gl.isContextLost()) return; // WebGL2가 없으면 아래 CSS 그라디언트가 그대로 보임

    const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = name => gl.getUniformLocation(prog, name);
    const U = { res: u("uRes"), time: u("uTime"), c1: u("uC1"), c2: u("uC2"), c3: u("uC3") };
    gl.uniform1f(u("uWarp"), LOOK.warp);
    gl.uniform1f(u("uScale"), LOOK.scale);
    gl.uniform1f(u("uWave"), LOOK.wave);
    gl.uniform1f(u("uGrain"), LOOK.grain);
    gl.uniform1f(u("uAccentMix"), LOOK.accentMix);

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now() - Math.random() * 60000; // 앨범마다 다른 무늬에서 시작
    let raf = 0, visible = true, frozenAt = 0;

    function draw(now) {
      const [c1, c2, c3] = grainientColors(...colorRef.current);
      gl.uniform3fv(U.c1, c1); gl.uniform3fv(U.c2, c2); gl.uniform3fv(U.c3, c3);
      gl.uniform2f(U.res, canvas.width, canvas.height);
      gl.uniform1f(U.time, ((reduced ? frozenAt : now) - start) / 1000 * LOOK.speed * 10);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function loop(now) {
      draw(now);
      raf = requestAnimationFrame(loop);
    }
    function play() {
      cancelAnimationFrame(raf);
      if (reduced) { frozenAt = frozenAt || performance.now(); draw(); return; }
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    }
    redrawRef.current = () => { if (reduced || !visible || document.hidden) draw(performance.now()); };

    const resize = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 2) * LOOK.resolution;
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      draw(performance.now());
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; play(); });
    io.observe(canvas);
    const onVis = () => play();
    document.addEventListener("visibilitychange", onVis);
    resize();
    play();
    canvas.dataset.ready = "true";

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      redrawRef.current = () => {};
      gl.deleteBuffer(buf); gl.deleteProgram(prog);
      // loseContext()는 쓰지 않음: 개발 모드(StrictMode)의 재마운트가 같은 캔버스에서 죽은 컨텍스트를 받아 빈 캔버스가 됨
      delete canvas.dataset.ready;
    };
  }, []);

  return (
    <canvas ref={canvasRef} aria-hidden="true"
      className={`pointer-events-none block opacity-0 transition-opacity duration-1000 data-[ready=true]:opacity-100 ${className}`} />
  );
}
