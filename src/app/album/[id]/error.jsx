"use client";
// data-album-fallback: 커버 전환이 이 화면이면 바로 끝냄 (AlbumTransitionProvider)
import ErrorView from "@/components/errors/ErrorView";

export default function AlbumError({ error, reset }) {
  return <ErrorView data-album-fallback error={error} reset={reset} title="Couldn’t load this record." back={{ href: "/digging", label: "Back to Digging" }} />;
}
