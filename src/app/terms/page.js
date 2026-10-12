import LegalPage from "@/components/legal/LegalPage";
import { TERMS, TERMS_INTRO } from "@/content/legal/terms";

export const metadata = {
  title: "Terms of Service · Grooves",
  description: "The agreement between you and Grooves when you use the site.",
};

export default function Terms() {
  return <LegalPage path="/terms" title="Terms of Service" intro={TERMS_INTRO} sections={TERMS} />;
}
