import "./HomeTagline.css";

export default function HomeTagline({ children, variant, elementRef }) {
  return <p ref={elementRef} className={`grooves-home-tagline grooves-home-tagline--${variant}`}>{children}</p>;
}
