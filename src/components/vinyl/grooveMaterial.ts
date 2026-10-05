import * as THREE from 'three'

export type GrooveParams = {
  /** 홈 주파수 (rad/unit). Blender Wave(Rings) scale 35 → 20 × 35 = 700 */
  grooveFreq: number
  /** 노멀 기울기 강도 */
  grooveDepth: number
  /** 트랙 수 (트랙 사이 매끈한 gap 생성) */
  trackCount: number
  /** gap 폭 (모델 단위) */
  gapWidth: number
  /** 홈이 시작/끝나는 반지름 (모델 단위, 디스크 반지름 = 1) */
  innerR: number
  outerR: number
  /** gap 부분 roughness (더 광택) */
  gapRoughness: number
}

export const defaultGrooveParams: GrooveParams = {
  grooveFreq: 700,
  grooveDepth: 0.35,
  trackCount: 5,
  gapWidth: 0.005,
  innerR: 0.46,
  outerR: 0.965,
  gapRoughness: 0.12,
}

export type GrooveUniforms = {
  uGrooveFreq: THREE.IUniform<number>
  uGrooveDepth: THREE.IUniform<number>
  uTrackCount: THREE.IUniform<number>
  uGapWidth: THREE.IUniform<number>
  uInnerR: THREE.IUniform<number>
  uOuterR: THREE.IUniform<number>
  uGapRoughness: THREE.IUniform<number>
}

/**
 * MeshPhysicalMaterial에 절차적 grooves를 패치합니다.
 * - 반지름 방향 노멀 perturbation (가까이서 보이는 홈)
 * - 이방성 방향을 반지름 방향으로 고정 (멀리서 보이는 방사형 빛줄기)
 * 반환된 uniforms 값을 바꾸면 리컴파일 없이 즉시 반영됩니다.
 */
export function createGrooveMaterial(
  params: GrooveParams = defaultGrooveParams,
  options: THREE.MeshPhysicalMaterialParameters = {},
) {
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x0c0c0c,
    roughness: 0.3,
    metalness: 0,
    anisotropy: 0.85, // 0이면 USE_ANISOTROPY define이 빠지므로 끌 때도 0.001 같은 작은 값 사용
    side: THREE.DoubleSide,
    ...options,
  })

  const uniforms: GrooveUniforms = {
    uGrooveFreq: { value: params.grooveFreq },
    uGrooveDepth: { value: params.grooveDepth },
    uTrackCount: { value: params.trackCount },
    uGapWidth: { value: params.gapWidth },
    uInnerR: { value: params.innerR },
    uOuterR: { value: params.outerR },
    uGapRoughness: { value: params.gapRoughness },
  }

  material.onBeforeCompile = (shader) => {
    // Fail explicitly if a future Three.js release changes our patch points.
    for (const chunk of ['common', 'begin_vertex']) {
      if (!shader.vertexShader.includes(`#include <${chunk}>`)) throw new Error(`Missing vinyl vertex chunk: ${chunk}`)
    }
    for (const chunk of ['common', 'roughnessmap_fragment', 'normal_fragment_maps', 'lights_physical_fragment']) {
      if (!shader.fragmentShader.includes(`#include <${chunk}>`)) throw new Error(`Missing vinyl fragment chunk: ${chunk}`)
    }
    Object.assign(shader.uniforms, uniforms)

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', /* glsl */ `#include <common>
        varying vec3 vLocalPos;
        varying float vLocalNormalY;
        varying vec3 vAxisX;
        varying vec3 vAxisZ;`)
      .replace('#include <begin_vertex>', /* glsl */ `#include <begin_vertex>
        vLocalPos = position;
        vLocalNormalY = normal.y;
        vAxisX = normalize(normalMatrix * vec3(1.0, 0.0, 0.0));
        vAxisZ = normalize(normalMatrix * vec3(0.0, 0.0, 1.0));`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', /* glsl */ `#include <common>
        varying vec3 vLocalPos;
        varying float vLocalNormalY;
        varying vec3 vAxisX;
        varying vec3 vAxisZ;
        uniform float uGrooveFreq;
        uniform float uGrooveDepth;
        uniform float uTrackCount;
        uniform float uGapWidth;
        uniform float uInnerR;
        uniform float uOuterR;
        uniform float uGapRoughness;`)

      // 1) 홈 영역 마스크 + 거칠기 (normal 계산 전에 실행됨)
      .replace('#include <roughnessmap_fragment>', /* glsl */ `#include <roughnessmap_fragment>
        vec2 gP = vLocalPos.xz;                       // glTF Y-up → 디스크는 XZ 평면
        float gR = length(gP);
        vec2 gDir = gP / max(gR, 1e-5);

        // 윗면/아랫면만 (옆면 제외)
        float gFace = smoothstep(0.5, 0.9, abs(vLocalNormalY));

        // 홈이 새겨진 반지름 구간 (안쪽 run-out, 바깥 테두리는 매끈하게)
        float gBand = smoothstep(uInnerR, uInnerR + 0.004, gR)
                    * (1.0 - smoothstep(uOuterR - 0.004, uOuterR, gR));

        // 트랙 사이 매끈한 띠(gap)
        float gSpan = (uOuterR - uInnerR) / uTrackCount;
        float gT = (gR - uInnerR) / gSpan;            // 0..trackCount
        float gDist = abs(fract(gT + 0.5) - 0.5) * gSpan;
        float gInterior = step(0.5, gT) * step(gT, uTrackCount - 0.5);
        float gGap = gInterior * (1.0 - smoothstep(uGapWidth * 0.5, uGapWidth * 0.75, gDist));

        float gMask = gFace * gBand * (1.0 - gGap);

        // 홈 위상 + 안티앨리어싱(픽셀당 위상 변화가 크면 페이드)
        float gPhase = gR * uGrooveFreq;
        float gAA = 1.0 - smoothstep(0.6, 2.2, fwidth(gPhase));

        // 트랙 사이 gap은 더 매끈하게(광택)
        roughnessFactor = mix(roughnessFactor, uGapRoughness, gFace * gBand * gGap);

        // 가까이서 볼 때 미세한 명암
        diffuseColor.rgb *= 1.0 + 0.25 * sin(gPhase) * gAA * gMask;`)

      // 2) 반지름 방향으로 노멀 기울이기
      .replace('#include <normal_fragment_maps>', /* glsl */ `#include <normal_fragment_maps>
        vec3 gRadialView = normalize(gDir.x * vAxisX + gDir.y * vAxisZ);
        gRadialView = normalize(gRadialView - normal * dot(normal, gRadialView));
        float gSlope = cos(gPhase) * uGrooveDepth * gAA * gMask;
        normal = normalize(normal - gRadialView * gSlope);`)

      // 3) 이방성 방향을 반지름 방향으로 → LP 특유의 방사형 빛줄기
      .replace('#include <lights_physical_fragment>', /* glsl */ `#include <lights_physical_fragment>
        #ifdef USE_ANISOTROPY
          vec3 gT3 = normalize(gRadialView - normal * dot(normal, gRadialView));
          material.anisotropyT = gT3;
          material.anisotropyB = normalize(cross(normal, gT3));
          material.anisotropy *= gMask;
          material.alphaT = mix(pow2(material.roughness), 1.0, pow2(material.anisotropy));
        #endif`);
  }

  material.customProgramCacheKey = () => 'grooves-vinyl-r180-v1'
  return { material, uniforms }
}
