import LegalPage from "@/components/legal/LegalPage";
import { PRIVACY, PRIVACY_INTRO } from "@/content/legal/privacy";

export const metadata = {
  title: "Privacy Policy · Grooves",
  description: "What Grooves collects, why, how long we keep it, and how to delete it.",
};

export default function Privacy() {
  return <LegalPage path="/privacy" title="Privacy Policy" intro={PRIVACY_INTRO} sections={PRIVACY} />;
}
