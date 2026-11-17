// 페이지 제목(DIGGING · COLLECTION): 글자마다 나눠서 왼쪽부터 차례로 올라오게 (Digging.module.css .titleReveal)
// 화면 낭독기는 한 단어로 읽음
import styles from "./Digging.module.css";

export default function SplitTitle({ text, className = "" }) {
  return (
    <h1 className={`${styles.title} ${className}`} aria-label={text}>
      {[...text].map((ch, i) => <span key={i} aria-hidden="true" style={{ "--i": i }}>{ch}</span>)}
    </h1>
  );
}
