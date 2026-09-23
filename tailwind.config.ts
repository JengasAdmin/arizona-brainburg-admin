import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Minimal black / dark administration palette
        background: "#050505",
        surface: "#0A0A0A",
        panel: "#111111",
        card: "#171717",
        raised: "#202020",
        line: "#202020",
        line2: "#2b2b2b",
        fg: "#FFFFFF",
        muted: "#A3A3A3",
        dim: "#737373",
        faint: "#525252",
        ok: "#4ADE80",
        warn: "#FBBF24",
        danger: "#F87171",
        info: "#60A5FA",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      borderRadius: {
        lg: "8px",
        md: "6px",
        sm: "4px",
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.02) inset, 0 8px 24px rgba(0,0,0,0.45)",
        popover: "0 12px 40px rgba(0,0,0,0.6)",
      },
      keyframes: {
        fade: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        fade: "fade 0.18s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
