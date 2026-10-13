"use client";
// 3D 잉크 판 모델 (vinyl.glb) 미리 불러오기 — 첫 로딩(인트로) 동안 받아 두면
// Footer·앨범 페이지의 판(AlbumVinyl → useGLTF)이 처음 보일 때 비어 있지 않음
import { useGLTF } from "@react-three/drei";

export const VINYL_URL = "/models/vinyl.glb";
export const DRACO_PATH = "/draco/";

let pending = null;
// 파일 받기 + drei 캐시에 해석 시작. 돌려주는 Promise 는 파일을 다 받으면 끝남 (해석은 이어서 백그라운드)
export function preloadVinyl() {
  if (!pending) {
    useGLTF.preload(VINYL_URL, DRACO_PATH);
    pending = fetch(VINYL_URL).then((r) => r.arrayBuffer()).then(() => {}, () => {});
  }
  return pending;
}
