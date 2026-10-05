import * as THREE from 'three'

/** Model-space marks stay attached to the vinyl during later rotation/interaction.
 * Colors are converted to linear by THREE.Color; Three handles output conversion.
 */
export const illustrationStyle = {
  paper: '#f3e7cd',
  ink: '#5e83a2',
  label: '#d8e0d9',
  hatchDensity: 46,
  ringDensity: 58,
  strokeWidth: 0.085,
  halftoneStrength: 0.16,
}

export function illustrateMaterial(material: THREE.MeshPhysicalMaterial, surface: 'grooves' | 'label' | 'rim') {
  const previousCompile = material.onBeforeCompile
  const previousKey = material.customProgramCacheKey()
  material.color.set('#ffffff')
  material.roughness = 0.72
  const uniforms = {
    uSketchPaper: { value: new THREE.Color(surface === 'label' ? illustrationStyle.label : illustrationStyle.paper) },
    uSketchInk: { value: new THREE.Color(illustrationStyle.ink) },
    uHatchDensity: { value: illustrationStyle.hatchDensity },
    uRingDensity: { value: illustrationStyle.ringDensity },
    uStrokeWidth: { value: illustrationStyle.strokeWidth },
    uHalftoneStrength: { value: illustrationStyle.halftoneStrength },
  }
  material.onBeforeCompile = (shader, renderer) => {
    previousCompile.call(material, shader, renderer)
    if (!shader.fragmentShader.includes('#include <opaque_fragment>')) throw new Error('Missing illustration output chunk')
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      varying vec3 vSketchPosition;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      vSketchPosition = position;`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vSketchPosition;
      uniform vec3 uSketchPaper, uSketchInk;
      uniform float uHatchDensity, uRingDensity, uStrokeWidth, uHalftoneStrength;
      float sketchLine(float phase, float width) {
        float aa = max(fwidth(phase), 0.001);
        float distanceToLine = abs(fract(phase + 0.5) - 0.5);
        return (1.0 - smoothstep(width, width + aa, distanceToLine))
          * (1.0 - smoothstep(0.35, 0.9, aa));
      }
      float sketchNoise(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }`)
      .replace('#include <opaque_fragment>', `
        vec2 p = vSketchPosition.xz;
        float radius = length(p);
        float angle = atan(p.y, p.x);
        // Retain PBR lighting (including the original anisotropic groove normals),
        // then compress it into ink density instead of displaying black plastic.
        float brightness = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
        float shade = 1.0 - smoothstep(0.18, 2.4, brightness);
        float wobble = 0.19 * sin(p.x * 37.0 + sin(p.y * 19.0)) + 0.05 * sin(p.y * 83.0);
        float hatchA = sketchLine(dot(p, vec2(0.82, 0.57)) * uHatchDensity + wobble, uStrokeWidth);
        float hatchB = sketchLine(dot(p, vec2(-0.55, 0.84)) * uHatchDensity * 0.83 + wobble, uStrokeWidth * 0.8);
        float brokenStroke = smoothstep(-0.85, -0.2, sin(p.x * 23.0 + p.y * 31.0) + 0.35 * sin(p.y * 79.0));
        float hatch = hatchA * mix(0.25, 0.85, shade) * mix(0.35, 1.0, brokenStroke);
        hatch = max(hatch, hatchB * smoothstep(0.35, 0.85, shade) * 0.55);
        float ringPhase = radius * uRingDensity + 0.10 * sin(angle * 11.0 + radius * 24.0) + 0.045 * sin(angle * 29.0);
        float rings = sketchLine(ringPhase, uStrokeWidth * 0.72);
        float brokenRing = smoothstep(-0.65, 0.1, sin(angle * 9.0 + floor(radius * uRingDensity) * 1.73));
        float band = smoothstep(0.44, 0.46, radius) * (1.0 - smoothstep(0.955, 0.98, radius));
        float ringInk = rings * brokenRing * band * ${surface === 'grooves' ? '0.62' : '0.0'};
        // Low-contrast, derivative-filtered dots only in darker areas.
        vec2 dotGrid = p * 95.0;
        float dotAA = max(length(fwidth(dotGrid)), 0.001);
        float dots = (1.0 - smoothstep(0.10, 0.10 + dotAA, length(fract(dotGrid) - 0.5)))
          * (1.0 - smoothstep(0.4, 1.0, dotAA));
        float grain = sketchNoise(floor(p * 650.0));
        float grainFade = 1.0 - smoothstep(0.4, 1.4, length(fwidth(p * 650.0)));
        float ink = 0.045 + shade * 0.14 + hatch * ${surface === 'label' ? '0.35' : '0.85'} + ringInk;
        ink += dots * smoothstep(0.45, 0.85, shade) * uHalftoneStrength;
        ink += (grain - 0.5) * 0.05 * grainFade;
        ${surface === 'rim' ? 'ink += 0.10;' : ''}
        outgoingLight = mix(uSketchPaper, uSketchInk, clamp(ink, 0.0, 0.94));
        #include <opaque_fragment>`)
  }
  material.customProgramCacheKey = () => `${previousKey}-illustration-v1-${surface}`
  return material
}
