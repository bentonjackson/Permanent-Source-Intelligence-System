import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./types/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        muted: "hsl(var(--muted))",
        card: "hsl(var(--card))",
        accent: "hsl(var(--accent))",
        primary: "hsl(var(--primary))",
        secondary: "hsl(var(--secondary))",
        destructive: "hsl(var(--destructive))"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "serif"]
      },
      backgroundImage: {
        "grain-gradient":
          "radial-gradient(circle at top left, rgba(127,29,29,0.16), transparent 28%), radial-gradient(circle at top right, rgba(38,38,38,0.14), transparent 24%), linear-gradient(180deg, rgba(250,250,250,1) 0%, rgba(241,241,241,1) 100%)",
        "architect-grid":
          "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)"
      },
      boxShadow: {
        panel: "0 24px 55px -34px rgba(0, 0, 0, 0.78)",
        "panel-strong": "0 34px 70px -34px rgba(0, 0, 0, 0.9)"
      }
    }
  },
  plugins: []
};

export default config;
