import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "BuildSignal",
  description:
    "Eastern Iowa construction signal tracking, builder contact intelligence, and first-to-bid sales workflow."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
