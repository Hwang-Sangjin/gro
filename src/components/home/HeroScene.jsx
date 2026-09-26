"use client";
import { useEffect, useLayoutEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { SRGBColorSpace } from "three";

const ROOM_IMAGE = "/images/grooves/listening-room.webp";

// Temporary room artwork. Keep the Canvas and PaperFadePass so the existing
// paper edges and pointer-driven colour reveal also work with this image.
export default function HeroScene() {
  const source = useTexture(ROOM_IMAGE);
  const { width, height } = useThree((state) => state.size);
  // Clone the cached texture: crop settings belong to this scene only.
  const texture = useMemo(() => {
    const copy = source.clone();
    copy.colorSpace = SRGBColorSpace;
    copy.needsUpdate = true;
    return copy;
  }, [source]);

  useLayoutEffect(() => {
    const imageAspect = source.image.width / source.image.height;
    const stageAspect = width / Math.max(1, height);
    // Centred object-fit: cover, without stretching on mobile or desktop.
    const repeatX = Math.min(1, stageAspect / imageAspect);
    const repeatY = Math.min(1, imageAspect / stageAspect);
    texture.repeat.set(repeatX, repeatY);
    texture.offset.set((1 - repeatX) / 2, (1 - repeatY) / 2);
    texture.updateMatrix();
  }, [source, texture, width, height]);

  useEffect(() => () => texture.dispose(), [texture]);

  return <primitive object={texture} attach="background" />;
}
