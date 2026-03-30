import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";

import "./globals.css";

const uiSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

const displaySerif = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap"
});

export const metadata: Metadata = {
  title: "BuildSignal",
  description:
    "Eastern Iowa construction signal tracking, builder contact intelligence, and first-to-bid sales workflow."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${uiSans.variable} ${displaySerif.variable} font-sans`}>{children}</body>
    </html>
  );
}
