// MapLibre 6 의 지도 계산 worker 를 public/maplibre/ 로 복사 (Turbopack 이 worker 파일을 찾지 못해서)
// predev·prebuild 에서 자동 실행 → node_modules 의 버전과 늘 같음. 결과물은 git 에 넣지 않음 (.gitignore)
import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "maplibre-gl", "dist");
const to = join(root, "public", "maplibre");
mkdirSync(to, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(join(from, f), join(to, f));
console.log("maplibre worker → public/maplibre/");
