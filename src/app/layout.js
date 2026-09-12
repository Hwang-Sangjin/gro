import Providers from "@/components/Provider";
import "./globals.css";

export const metadata = {
  title: "View Transition API | Codegrid",
  description: "View Transition API | Codegrid",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {/* ReactLenis / Navbar / Preloader 는 전부 Providers 안으로 이동 */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
