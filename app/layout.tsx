import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hudi Orb Generator",
  description: "A focused generator for Hudi ticker orbs in all four canonical sizes.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
