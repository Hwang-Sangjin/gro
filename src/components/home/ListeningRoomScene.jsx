"use client";
import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

// Geometry-only prototype: no models, downloads, or new dependencies.
function Block({ at, size, color, ...props }) {
  return <mesh position={at} castShadow receiveShadow {...props}>
    <boxGeometry args={size} /><meshStandardMaterial color={color} roughness={.85} />
  </mesh>;
}
function Disc({ at, radius, depth = .04, color, ...props }) {
  return <mesh position={at} castShadow receiveShadow {...props}>
    <cylinderGeometry args={[radius, radius, depth, 48]} />
    <meshStandardMaterial color={color} roughness={.65} />
  </mesh>;
}
function Record() {
  const record = useRef(null);
  const motion = useRef(true);
  useLayoutEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { motion.current = !query.matches; };
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useFrame((_, delta) => {
    if (record.current && motion.current) record.current.rotation.y += Math.min(delta, .05) * .6;
  });
  return <group ref={record} position={[2.06, 1.41, -1.87]}>
    <Disc at={[0, 0, 0]} radius={.38} color="#292631" />
    <Disc at={[0, .026, 0]} radius={.12} depth={.012} color="#c35d39" />
    <Disc at={[0, .042, 0]} radius={.023} depth={.025} color="#eadfc8" />
    {[0, Math.PI].map(angle => <mesh key={angle} rotation={[-Math.PI / 2, 0, angle]} position={[0, .025, 0]}>
      <ringGeometry args={[.15, .36, 24, 1, 0, .38]} />
      <meshStandardMaterial color="#778496" roughness={.7} />
    </mesh>)}
  </group>;
}
function Camera() {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const oldPosition = camera.position.clone();
    const oldQuaternion = camera.quaternion.clone();
    const distance = size.width / Math.max(size.height, 1) < 1 ? 1.4 : 1;
    camera.position.set(7.2 * distance, 5.4 * distance, 9 * distance);
    camera.lookAt(0, 1.3, -.5);
    camera.updateProjectionMatrix();
    return () => { camera.position.copy(oldPosition); camera.quaternion.copy(oldQuaternion); camera.updateProjectionMatrix(); };
  }, [camera, size.width, size.height]);
  return null;
}
const covers = ["#bbcbda", "#cf744f", "#e6d4ae", "#6f737b", "#917265"];

export default function ListeningRoomScene() {
  return <>
    <Camera />
    <color attach="background" args={["#e6d6bd"]} />
    <ambientLight intensity={1.1} />
    <hemisphereLight args={["#bbcbda", "#806353", 1.2]} />
    <directionalLight position={[-3, 6, -2]} color="#ffbd83" intensity={2.4} />
    <pointLight position={[-2.9, 2.5, -.8]} color="#ffad62" intensity={12} distance={7} decay={2} />
    <group>
      <Block at={[0, -.12, 0]} size={[8.2, .24, 6.4]} color="#b49573" />
      {Array.from({ length: 10 }, (_, i) => <Block key={i} at={[0, .008, -2.8 + i * .61]} size={[8, .012, .018]} color="#93775c" />)}
      <Block at={[-4, 1.8, 0]} size={[.16, 3.6, 6.4]} color="#d7c7af" />
      {/* A window on one wall only; no corner glazing. */}
      <Block at={[0, .38, -3.1]} size={[8, .76, .18]} color="#d7c7af" />
      <Block at={[0, 3.4, -3.1]} size={[8, .4, .18]} color="#d7c7af" />
      <mesh position={[0, 1.97, -3.24]}>
        <planeGeometry args={[7.9, 2.55]} />
        <shaderMaterial vertexShader={`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`}
          fragmentShader={`varying vec2 vUv; void main(){vec3 low=vec3(.97,.59,.37);vec3 high=vec3(.43,.53,.66);gl_FragColor=vec4(mix(low,high,smoothstep(0.,1.,vUv.y)),1.);}`} />
      </mesh>
      <mesh position={[-2.6, 1.55, -3.20]}><circleGeometry args={[.3, 40]} /><meshBasicMaterial color="#ffd49a" /></mesh>
      {Array.from({ length: 18 }, (_, i) => {
        const h = .3 + ((i * 7) % 9) * .065;
        return <group key={i}>
          <Block at={[-3.8 + i * .44, .73 + h / 2, -3.18]} size={[.34, h, .025]} color={i % 2 ? "#796d78" : "#8f7d81"} />
          <mesh position={[-3.8 + i * .44, .82 + h / 2, -3.16]}><planeGeometry args={[.055, .075]} /><meshBasicMaterial color="#edb981" /></mesh>
        </group>;
      })}
      {[-3.8, -1.25, 1.25, 3.8].map(x => <Block key={x} at={[x, 2, -3]} size={[.07, 2.5, .12]} color="#635851" />)}
      <Block at={[0, .77, -3]} size={[7.7, .08, .25]} color="#635851" />
      <Block at={[0, 3.2, -3]} size={[7.7, .07, .12]} color="#635851" />
      {/* Soft, simple sofa along the left wall. */}
      <Block at={[-2.35, .42, .15]} size={[2.5, .55, 1.65]} color="#71818b" />
      <Block at={[-2.35, 1, -.56]} size={[2.5, 1, .26]} color="#8b9ba3" />
      {[-3.53, -1.17].map(x => <Block key={x} at={[x, .79, .15]} size={[.22, .68, 1.7]} color="#82949e" />)}
      {[-2.92, -1.77].map(x => <Block key={x} at={[x, .77, .2]} size={[1.05, .2, 1.16]} color="#a8b3b5" />)}
      <Block at={[-2.85, 1.13, -.35]} size={[.65, .6, .18]} color="#c1ad91" rotation={[0, 0, -.12]} />
      <Block at={[.15, .028, .65]} size={[3.6, .035, 2.6]} color="#d5c2a1" />
      <Disc at={[.05, .61, .65]} radius={1.04} depth={.13} color="#8c674c" scale={[1.35, 1, .78]} />
      {[-.7, .7].map(x => <Block key={x} at={[x, .3, .65]} size={[.12, .6, .6]} color="#66513f" />)}
      <Block at={[-.2, .71, .7]} size={[.55, .045, .42]} color="#bbcbda" rotation={[0, -.2, 0]} />
      <Disc at={[.55, .81, .55]} radius={.09} depth={.25} color="#eee0c4" />
      {/* Record console, sleeves, loudspeaker and rotating turntable. */}
      <Block at={[2.25, .65, -1.88]} size={[2.6, 1.3, .8]} color="#8d674c" />
      <Block at={[2.25, .64, -1.465]} size={[2.3, .93, .035]} color="#4e4240" />
      {Array.from({ length: 16 }, (_, i) => <Block key={i} at={[1.25 + i * .126, .62, -1.42]} size={[.075, .8 + (i % 3) * .035, .3]} color={covers[i % covers.length]} rotation={[0, 0, -.045]} />)}
      <Block at={[2.07, 1.34, -1.86]} size={[1.1, .1, .68]} color="#d1b38b" />
      <Record />
      <Block at={[2.43, 1.48, -1.78]} size={[.025, .025, .42]} color="#d4d0c6" rotation={[0, -.35, 0]} />
      <Block at={[3.17, 1.75, -1.87]} size={[.5, .85, .55]} color="#504844" />
      {[1.58, 1.95].map((y, i) => <Disc key={y} at={[3.17, y, -1.58]} radius={i ? .085 : .17} depth={.025} color="#272832" rotation={[Math.PI / 2, 0, 0]} />)}
      {/* Corner floor lamp. */}
      <Disc at={[-3.13, .05, -1.72]} radius={.25} depth={.08} color="#544944" />
      <Disc at={[-3.13, 1.18, -1.72]} radius={.024} depth={2.3} color="#544944" />
      <mesh position={[-3.13, 2.5, -1.72]}><cylinderGeometry args={[.28, .36, .62, 32]} /><meshStandardMaterial color="#f2d5a3" emissive="#f6b661" emissiveIntensity={.6} /></mesh>
    </group>
  </>;
}
