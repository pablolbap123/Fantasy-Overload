import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        pitch: {
          950: "#080d1b",
          900: "#11182d",
          850: "#1a2440",
          800: "#26314a",
          700: "#46536f",
        },
        turbo: {
          blue: "#62d7ff",
          green: "#21d17f",
          gold: "#f5bd43",
          red: "#ff3f55",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(56,189,248,0.18), 0 18px 70px rgba(8,47,73,0.26)",
        card: "0 16px 42px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.05)",
        lift: "0 18px 50px rgba(16,185,129,0.16)",
      },
    },
  },
  plugins: [],
} satisfies Config;
