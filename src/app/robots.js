// /robots.txt — 검색엔진에 열어 둘 곳 / 막을 곳 (로그인·계정·관리·API는 검색에 안 나오게)
import { SITE } from "@/lib/site";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/auth/", "/account", "/login", "/signup"],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
