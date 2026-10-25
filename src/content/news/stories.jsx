"use client";
// slug → 스토리 본문 컴포넌트 (글마다 따로 불러옴)
import dynamic from "next/dynamic";

const STORY = {
  "sse-pbr-fest": dynamic(() => import("./sse-pbr-fest/Story")),
  "daniel-caesar-korean-vinyl": dynamic(() => import("./daniel-caesar-korean-vinyl/Story")),
  "seoul-record-fair-2026": dynamic(() => import("./seoul-record-fair-2026/Story")),
  "records-for-autumn": dynamic(() => import("./records-for-autumn/Story")),
  "what-is-a-record": dynamic(() => import("./what-is-a-record/Story")),
  "the-vinyl-dictionary": dynamic(() => import("./the-vinyl-dictionary/Story")),
};

export default function StoryBody({ slug, meta }) {
  const Story = STORY[slug];
  return Story ? <Story meta={meta} /> : null;
}
