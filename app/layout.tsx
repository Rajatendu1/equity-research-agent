import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vigilant | Skeptical Equity Research",
  description: "Challenge-first research for India-listed equities.",
  icons: { icon: "/icon.svg", shortcut: "/icon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><head><meta name="codex-preview" content="development" /></head><body>{children}</body></html>;
}
