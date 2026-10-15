"use client";
// 페이지를 그리다 오류가 나면 (예: DB를 잠깐 못 읽음) — Next 기본 오류 화면 대신 사이트 안의 오류 화면
import ErrorView from "@/components/errors/ErrorView";

export default function Error({ error, reset }) {
  return <ErrorView error={error} reset={reset} />;
}
