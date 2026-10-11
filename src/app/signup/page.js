import { redirect } from "next/navigation";

// 회원가입은 따로 없음 — Google 로 처음 로그인하면 계정이 만들어짐
export default async function Signup({ searchParams }) {
  const q = new URLSearchParams(await searchParams).toString();
  redirect(q ? `/login?${q}` : "/login");
}
