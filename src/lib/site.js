// 사이트 공통 정보 — Footer·개인정보처리방침·이용약관이 같이 씀 (바꿀 땐 여기 한 곳만)
export const SITE = {
  name: "Grooves",
  // 사이트 주소 (사이트맵·robots·공유 링크). 도메인을 바꾸면 Vercel 환경 변수 NEXT_PUBLIC_SITE_URL 만 바꾸면 됨
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://gro-ten.vercel.app").replace(/\/+$/, ""),
  tagline: "Records, people, culture — and a slower tomorrow.",
  owner: "Hwang Sangjin",                 // 운영자 = 개인정보 보호책임자
  email: "aosdb5640@naver.com",          // 문의·개인정보 요청 받는 메일
  city: "Seoul",
  legalUpdated: "2026-10-14",             // 방침·약관 시행일
};
