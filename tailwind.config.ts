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
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"]
      },
      backgroundImage: {
        "grain-gradient":
          "radial-gradient(circle at top left, rgba(127,29,29,0.16), transparent 28%), radial-gradient(circle at top right, rgba(38,38,38,0.14), transparent 24%), linear-gradient(180deg, rgba(250,250,250,1) 0%, rgba(241,241,241,1) 100%)"
      },
      boxShadow: {
        panel: "0 18px 45px -28px rgba(15, 23, 42, 0.45)"
      }
    }
  },
  plugins: []
};

export default config;
