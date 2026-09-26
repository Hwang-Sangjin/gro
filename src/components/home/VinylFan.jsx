"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { coverUrl } from "@/lib/albums";
import * as THREE from "three";
import { SLEEVE, STEP_X, STEP_Y, STEP_Z, TILT_X, TILT_Y } from "./vinyl-layout.mjs";

const DEPTH = .09; // 1.5x sleeve thickness
// Seconds: each next sleeve starts 120ms after the previous one.
const ENTER_DELAY = .12;
const ENTER_DURATION = 1.05;

// Each sleeve owns its texture. Failed artwork never suspends the whole Canvas.
function AlbumArtwork({ album }) {
  const [loaded, setLoaded] = useState(null);
  const gl = useThree(state => state.gl);
  const src = coverUrl(album.cover_path || album.thumb_path);

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    const texture = new THREE.TextureLoader().load(src, result => {
      if (cancelled) { result.dispose(); return; }
      result.colorSpace = THREE.SRGBColorSpace;
      result.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
      result.needsUpdate = true;
      setLoaded({ src, texture: result });
    }, undefined, () => {
      if (!cancelled) setLoaded(null);
    });
    return () => { cancelled = true; texture.dispose(); };
  }, [src, gl]);

  const texture = loaded?.src === src ? loaded.texture : null;
  return (
    <mesh position={[0, 0, DEPTH / 2 + .002]}>
      <planeGeometry args={[SLEEVE, SLEEVE]} />
      <meshBasicMaterial key={texture ? "art" : "fallback"} map={texture}
        color={texture ? "#ffffff" : album.cover_color || "#bbcbda"}
        toneMapped={false} />
    </mesh>
  );
}

export default function VinylFan({ items, scrollRef, onActiveChange, entered = false }) {
  const groups = useRef([]);
  const enterTime = useRef(0);
  const reducedMotion = useRef(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { reducedMotion.current = media.matches; };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const lastActive = useRef(-1);
  const layout = useRef({ x: 0, y: 0 });
  const camera = useThree(s => s.camera);
  const size = useThree(s => s.size);

  useLayoutEffect(() => {
    const mobile = size.width < 600;
    const count = Math.max(1, items.length);
    // Include the projected corners after tilt, not just the unrotated square.
    const bounds = new THREE.Box3(
      new THREE.Vector3(-SLEEVE / 2, -SLEEVE / 2, -DEPTH / 2),
      new THREE.Vector3(SLEEVE / 2, SLEEVE / 2, DEPTH / 2 + .002),
    ).applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(
      new THREE.Euler(TILT_X, TILT_Y, 0, "XYZ"),
    ));
    const cardWidth = bounds.max.x - bounds.min.x;
    const cardHeight = bounds.max.y - bounds.min.y;
    const rowWidth = cardWidth + (count - 1) * STEP_X;
    const rowHeight = cardHeight + (count - 1) * STEP_Y;
    const sidePadding = mobile ? 24 : Math.max(32, size.width * .035);
    const topPadding = mobile ? Math.min(250, size.height * .4) : Math.min(120, size.height * .18);
    const bottomPadding = Math.min(110, size.height * .18);
    const availableHeight = Math.max(1, size.height - topPadding - bottomPadding);
    const preferredPixels = mobile
      ? Math.min(size.height * .36, size.width * .48)
      : Math.min(size.height * .45, Math.max(140, size.width * .22));
    const zoom = Math.min(
      preferredPixels / SLEEVE,
      availableHeight / rowHeight,
      // Desktop fits the complete row; narrow screens retain horizontal browsing.
      Math.max(1, size.width - sidePadding * 2) / (mobile ? cardWidth : rowWidth),
    );
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
    const worldWidth = size.width / zoom;
    const worldHeight = size.height / zoom;
    const fittedWidth = rowWidth * zoom;
    const left = mobile ? sidePadding : Math.max(sidePadding, (size.width - fittedWidth) / 2);
    layout.current = {
      x: -worldWidth / 2 + left / zoom - bounds.min.x,
      y: (bottomPadding - topPadding) / (2 * zoom) -
        ((count - 1) * STEP_Y + bounds.max.y + bounds.min.y) / 2,
      worldHeight,
    };
  }, [camera, size.width, size.height, items.length]);

  useFrame((_, dt) => {
    if (!items.length) return;
    if (entered) enterTime.current = Math.min(
      ENTER_DURATION + Math.max(0, items.length - 1) * ENTER_DELAY,
      enterTime.current + Math.min(dt, .05),
    );
    const s = scrollRef.current;
    s.current = THREE.MathUtils.damp(s.current, s.target, 7, Math.min(dt,.05));
    items.forEach((item,i) => {
      const g = groups.current[i];
      if (!g) return;
      const offset = i-s.current;
      const progress = !entered ? 0 : reducedMotion.current ? 1 :
        THREE.MathUtils.clamp((enterTime.current - i * ENTER_DELAY) / ENTER_DURATION, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      // Start below the Canvas even for the highest sleeve in the diagonal row.
      const drop = layout.current.worldHeight / 2 + Math.abs(layout.current.y) +
        SLEEVE + Math.max(0, items.length - 1) * STEP_Y;
      g.visible = entered && progress > 0;
      g.position.set(layout.current.x+offset*STEP_X,
        layout.current.y+offset*STEP_Y - (1 - eased) * drop,offset*STEP_Z);
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
        <group visible={false} key={item.id} ref={el => { groups.current[i] = el; }}>
          <mesh>
            <boxGeometry args={[SLEEVE,SLEEVE,DEPTH]} />
            <meshBasicMaterial color={item.cover_color || "#bbcbda"} toneMapped={false} />
          </mesh>
          <AlbumArtwork album={item} />
        </group>
      ))}
    </>
  );
}
