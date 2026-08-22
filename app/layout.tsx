import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HUDI Company Orb System",
  description: "Company-logo orbs with brand-derived palettes for the HUDI market universe.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
