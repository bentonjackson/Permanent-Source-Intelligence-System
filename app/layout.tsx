import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import Script from "next/script";

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            try {
              var stored = localStorage.getItem('buildsignal-theme');
              var theme = stored === 'light' || stored === 'dark' ? stored : 'dark';
              document.documentElement.dataset.theme = theme;
            } catch (e) {
              document.documentElement.dataset.theme = 'dark';
            }
          `}
        </Script>
      </head>
      <body className={`${uiSans.variable} ${displaySerif.variable} font-sans`}>{children}</body>
    </html>
  );
}
