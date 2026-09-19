"use client";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useFBO } from "@react-three/drei";

// Tune these independently: edge width, edge stipple, center grain.
const STYLE = {
  paper: "#f4e7cd", ink: "#bbcbda", shadow: "#8ca8be",
  fade: .13, stipple: .48, grain: .055, radius: .42,
};
const vertexShader = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }
`;
const fragmentShader = `
  uniform sampler2D tScene;
  uniform vec3 uPaper, uInk, uShadow;
  uniform vec2 uPointer, uResolution;
  uniform float uReveal, uRadius, uFade, uAspect, uStipple, uGrain;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),
      mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
  }
  void main() {
    vec3 source = texture2D(tScene, vUv).rgb;
    float l = pow(clamp(dot(source,vec3(.2126,.7152,.0722)),0.,1.),1./2.2);
    vec3 mono = mix(uShadow,uInk,smoothstep(.04,.48,l));
    mono = mix(mono,uPaper,smoothstep(.48,.98,l));
    // Stable CSS-pixel grain: no time input or DPR-dependent flicker.
    vec2 pixel = floor(vUv*uResolution/1.25);
    float speckle = hash(pixel);
    mono = mix(mono,uPaper,step(.84,speckle)*uGrain);
    vec2 p = vUv*vec2(uAspect,1.);
    float radius = max(.0001,uRadius*uReveal);
    float distanceToPointer = length(p-uPointer*vec2(uAspect,1.));
    float reveal = (1.-smoothstep(radius*.5,radius,distanceToPointer))
      * smoothstep(0.,.15,uReveal);
    vec3 col = mix(mono,source,reveal);
    vec2 edges = min(vUv,1.-vUv)*vec2(uAspect,1.);
    float edge = min(edges.x,edges.y);
    float irregular = (noise(p*12.)-.5)*uFade*.55;
    float coverage = smoothstep(0.,uFade,edge+irregular);
    // Guarantee zero alpha at the canvas boundary, including noisy corners.
    float outer = smoothstep(0.,.018,edge);
    float dots = step(hash(pixel+17.),coverage);
    float edgeBand = 1.-smoothstep(uFade*.65,uFade*1.5,edge);
    float alpha = mix(coverage,dots,uStipple*edgeBand)*outer;
    gl_FragColor = vec4(col,alpha);
    #include <colorspace_fragment>
  }
`;

export default function PaperFadePass({ hoverRef }) {
  const { gl, scene, camera } = useThree();
  const fbo = useFBO({ samples: 4 });
  const pass = useMemo(() => {
    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader,
      transparent: true, depthTest: false, depthWrite: false,
      uniforms: {
        tScene: { value: null }, uPaper: { value: new THREE.Color(STYLE.paper) },
        uInk: { value: new THREE.Color(STYLE.ink) }, uShadow: { value: new THREE.Color(STYLE.shadow) },
        uPointer: { value: new THREE.Vector2(.5,.5) },
        uResolution: { value: new THREE.Vector2(1,1) },
        uReveal: { value: 0 }, uRadius: { value: STYLE.radius },
        uFade: { value: STYLE.fade }, uAspect: { value: 1 },
        uStipple: { value: STYLE.stipple }, uGrain: { value: STYLE.grain },
      },
    });
    const geometry = new THREE.PlaneGeometry(2,2);
    const quad = new THREE.Mesh(geometry,material);
    quad.frustumCulled = false;
    const output = new THREE.Scene(); output.add(quad);
    return { material, geometry, output,
      camera: new THREE.OrthographicCamera(-1,1,1,-1,0,1),
      clearColor: new THREE.Color() };
  }, []);
  useEffect(() => () => { pass.material.dispose(); pass.geometry.dispose(); }, [pass]);
  useFrame((state, delta) => {
    const u=pass.material.uniforms;
    u.uReveal.value=THREE.MathUtils.damp(u.uReveal.value,hoverRef.current ? 1 : 0,3,delta);
    u.uPointer.value.x=THREE.MathUtils.damp(u.uPointer.value.x,state.pointer.x*.5+.5,8,delta);
    u.uPointer.value.y=THREE.MathUtils.damp(u.uPointer.value.y,state.pointer.y*.5+.5,8,delta);
    u.uResolution.value.set(state.size.width,state.size.height);
    u.uAspect.value=state.size.width/Math.max(1,state.size.height);
    u.tScene.value=fbo.texture;
    const previousTarget=gl.getRenderTarget();
    gl.getClearColor(pass.clearColor);
    const previousAlpha=gl.getClearAlpha();
    gl.setRenderTarget(fbo);
    gl.render(scene,camera);
    gl.setRenderTarget(previousTarget);
    gl.setClearColor(0x000000,0);
    gl.clear();
    gl.render(pass.output,pass.camera);
    gl.setClearColor(pass.clearColor,previousAlpha);
  },1);
  return null;
}
