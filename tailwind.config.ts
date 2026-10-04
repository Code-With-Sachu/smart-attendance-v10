import type { Config } from "tailwindcss";

/** Colours are CSS variables (RGB channels) so light/dark themes swap in globals.css. */
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: v("background"),
        card: v("card"),
        border: v("border"),
        ink: { DEFAULT: v("ink"), muted: v("ink-muted"), subtle: v("ink-subtle") },
        primary: { DEFAULT: v("primary"), dark: v("primary-dark"), soft: v("primary-soft"), ink: v("primary-ink") },
        absent: { bg: v("absent-bg"), border: v("absent-border"), ink: v("absent-ink"), strong: v("absent-strong") },
        danger: { DEFAULT: v("danger"), soft: v("danger-soft") },
        success: { DEFAULT: v("success"), soft: v("success-soft"), ink: v("success-ink") },
        warn: { soft: v("warn-soft"), border: v("warn-border"), ink: v("warn-ink") },
        slate: { 50: v("slate-50"), 100: v("slate-100"), 200: v("slate-200"), 300: v("slate-300"), 400: v("slate-400") },
      },
      fontFamily: {
        sans: ["Inter Variable", "Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(var(--shadow) / 0.04), 0 1px 3px rgb(var(--shadow) / 0.06)",
        pop: "0 10px 30px -10px rgb(var(--shadow) / 0.25)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "scale-in": { from: { opacity: "0", transform: "scale(.97)" }, to: { opacity: "1", transform: "scale(1)" } },
        "slide-in-left": { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(0)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "scale-in": "scale-in 160ms ease-out",
        "slide-in-left": "slide-in-left 200ms ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
