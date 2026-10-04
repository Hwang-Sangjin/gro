import styles from "./HeroSection.module.css";

// Temporary static hero while the new section is being designed.
export default function HeroSection() {
  return (
    <section className={styles.section} aria-labelledby="hero-title">
      <h1 id="hero-title" className={styles.title}>Grooves</h1>
    </section>
  );
}
