"use client";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useFBO } from "@react-three/drei";

const INK = "#bbcbda"; // 기본(unhover) 톤
const SHADOW = "#7f9dbd"; // 가장 어두운 영역. 단색으로만 가려면 INK 와 같은 값으로
const PAPER = "#f4e7cd";

const REVEAL_RADIUS = 0.42; // 무대 높이 기준. 2.0 이상이면 hover 시 씬 전체가 컬러로
const FADE_WIDTH = 0.16; // paper fade 테두리 폭(무대 높이 기준)

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D tScene;
  uniform vec3 uInk;
  uniform vec3 uShadow;
  uniform vec3 uPaper;
  uniform vec2 uPointer;
  uniform float uReveal;
  uniform float uRadius;
  uniform float uFade;
  uniform float uAspect;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  void main() {
    vec4 scene = texture2D(tScene, vUv);
    vec2 p = vUv * vec2(uAspect, 1.0);

    // ── 1. 모노톤: 밝기 → shadow / ink / paper 3단 램프
    float l = dot(scene.rgb, vec3(0.2126, 0.7152, 0.0722));
    l = pow(l, 1.0 / 2.2);
    vec3 mono = mix(uShadow, uInk, smoothstep(0.0, 0.45, l));
    mono = mix(mono, uPaper, smoothstep(0.45, 1.0, l));
    // 인쇄 망점처럼 잉크가 드문드문 빠짐
    mono = mix(mono, uPaper, step(0.8, hash(gl_FragCoord.xy)) * 0.4);

    // ── 2. 커서 리빌: hover 시 커서에서 원이 자라나고, 경계는 noise 로 흐트러짐
    vec2 d = p - uPointer * vec2(uAspect, 1.0);
    float r = uRadius * uReveal;
    float wobble = (vnoise(p * 5.0) - 0.5) * 0.1;
    float m = 1.0 - smoothstep(r * 0.5, r, length(d) + wobble);
    m *= smoothstep(0.0, 0.15, uReveal);
    vec3 col = mix(mono, scene.rgb, m);

    // ── 3. paper fade: 가장자리 거리 + 저주파 noise → 점묘로 빠짐
    vec2 e = min(vUv, 1.0 - vUv) * vec2(uAspect, 1.0);
    float edge = min(e.x, e.y);
    edge += (vnoise(p * 7.0) - 0.5) * uFade * 0.9;
    float f = smoothstep(0.0, uFade, edge);
    float stipple = step(hash(gl_FragCoord.xy + 17.0), f);
    float alpha = mix(f, stipple, 0.75);

    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
  }
`;

export default function PaperFadePass({ hoverRef }) {
  const { gl, scene, camera } = useThree();
  const fbo = useFBO({ samples: 4 });

  const { quadScene, quadCamera, material } = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tScene: { value: null },
        uInk: { value: new THREE.Color(INK) },
        uShadow: { value: new THREE.Color(SHADOW) },
        uPaper: { value: new THREE.Color(PAPER) },
        uPointer: { value: new THREE.Vector2(0.5, 0.5) },
        uReveal: { value: 0 },
        uRadius: { value: REVEAL_RADIUS },
        uFade: { value: FADE_WIDTH },
        uAspect: { value: 1 },
      },
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;

    const quadScene = new THREE.Scene();
    quadScene.add(quad);

    const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    return { quadScene, quadCamera, material };
  }, []);

  useEffect(() => () => material.dispose(), [material]);

  useFrame((state, delta) => {
    const u = material.uniforms;
    const damp = THREE.MathUtils.damp;

    u.uReveal.value = damp(u.uReveal.value, hoverRef.current ? 1 : 0, 3, delta);
    u.uPointer.value.x = damp(
      u.uPointer.value.x,
      state.pointer.x * 0.5 + 0.5,
      8,
      delta,
    );
    u.uPointer.value.y = damp(
      u.uPointer.value.y,
      state.pointer.y * 0.5 + 0.5,
      8,
      delta,
    );
    u.uAspect.value = state.size.width / state.size.height;
    u.tScene.value = fbo.texture;

    gl.setRenderTarget(fbo);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    gl.render(quadScene, quadCamera);
  }, 1);

  return null;
}
