// Grooves 로고 (G 모양 판) — 바깥 홈은 글자색(currentColor)을 따라가고, 가운데 라벨은 하늘색 그대로
// 그래서 크림 배경(진한 로고)·앨범 페이지의 어두운 배경(밝은 로고) 어디서든 보임
// 원본 컬러 이미지: /images/grooves/logo.png
const mask = (src) => ({ maskImage: `url(${src})`, WebkitMaskImage: `url(${src})`, maskSize: "contain", WebkitMaskSize: "contain", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat", maskPosition: "center", WebkitMaskPosition: "center" });

export default function GroovesLogo({ className = "size-10", label = "Grooves" }) {
  return (
    <span role="img" aria-label={label} className={`relative inline-block shrink-0 ${className}`}>
      <span aria-hidden="true" className="absolute inset-0 bg-current" style={mask("/images/grooves/logo-rings.png")} />
      <span aria-hidden="true" className="absolute inset-0 bg-[#b0c6e0]" style={mask("/images/grooves/logo-disc.png")} />
    </span>
  );
}
