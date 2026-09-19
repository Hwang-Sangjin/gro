"use client";
import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { SLEEVE, STEP_X, STEP_Y, STEP_Z, TILT_X, TILT_Y } from "./vinyl-layout.mjs";

const DEPTH = .06;
const GROOVES = [1.18, 1.23, 1.28, 1.33, 1.38, 1.43, 1.48];

export default function VinylFan({ items, scrollRef, onActiveChange }) {
  const groups = useRef([]);
  const lastActive = useRef(-1);
  const layout = useRef({ x: 0, y: 0 });
  const camera = useThree(s => s.camera);
  const size = useThree(s => s.size);

  useLayoutEffect(() => {
    // All sleeves share one camera zoom: never shrink distant records.
    const sleevePixels = Math.min(size.height * .64, Math.max(200, size.width * .31));
    const zoom = sleevePixels / SLEEVE;
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
    const worldWidth = size.width / zoom;
    const worldHeight = size.height / zoom;
    layout.current = {
      x: -worldWidth * (size.width < 600 ? .12 : .32),
      y: -worldHeight * (size.width < 600 ? .15 : .21),
    };
  }, [camera, size.width, size.height]);

  useFrame((_, dt) => {
    if (!items.length) return;
    const s = scrollRef.current;
    s.current = THREE.MathUtils.damp(s.current, s.target, 7, Math.min(dt,.05));
    items.forEach((item,i) => {
      const g = groups.current[i];
      if (!g) return;
      const offset = i-s.current;
      g.position.set(layout.current.x+offset*STEP_X,
        layout.current.y+offset*STEP_Y,offset*STEP_Z);
      // XYZ order slopes the top edge down-right, keeping the sleeves upright.
      g.rotation.set(TILT_X,TILT_Y,0,"XYZ");
      g.scale.setScalar(1);
    });
    const active = THREE.MathUtils.clamp(Math.round(s.current),0,items.length-1);
    if (active !== lastActive.current) {
      lastActive.current = active;
      onActiveChange?.(active);
    }
  });

  return (
    <>
      {items.map((item,i) => (
        <group key={item.id} ref={el => { groups.current[i] = el; }}>
          {/* Blue record sits behind the sleeve and emerges from its right side. */}
          <group position={[SLEEVE*.35,0,-DEPTH*.8]}>
            <mesh rotation={[Math.PI/2,0,0]}>
              <cylinderGeometry args={[SLEEVE*.47,SLEEVE*.47,.025,96]} />
              <meshBasicMaterial color="#91afca" />
            </mesh>
            {GROOVES.map(radius => (
              <mesh key={radius} position={[0,0,.014]}>
                <ringGeometry args={[radius,radius+.006,96]} />
                <meshBasicMaterial color="#bbcbda" side={THREE.DoubleSide} />
              </mesh>
            ))}
          </group>
          <mesh>
            <boxGeometry args={[SLEEVE,SLEEVE,DEPTH]} />
            <meshBasicMaterial color="#eadcc4" />
          </mesh>
          {/* Keep the supplied placeholder artwork; replace with album textures later. */}
          <mesh position={[0,-SLEEVE*.22,DEPTH/2+.002]}>
            <planeGeometry args={[SLEEVE*.92,SLEEVE*.5]} />
            <meshBasicMaterial color={item.color} />
          </mesh>
        </group>
      ))}
    </>
  );
}
