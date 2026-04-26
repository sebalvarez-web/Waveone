import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand
        primary: "#0B1220",            // Deep ink — primary brand
        "on-primary": "#FFFFFF",
        "primary-fixed": "#1B2538",
        "primary-container": "#0B1220",
        "on-primary-container": "#FFFFFF",

        // Accent (athletic/energetic)
        accent: "#FF5E3A",             // Coral — CTA / brand spark
        "accent-soft": "#FFE6DD",
        "on-accent": "#FFFFFF",

        // Semantic
        secondary: "#059669",          // Emerald success
        "on-secondary": "#FFFFFF",
        "secondary-container": "#D1FAE5",
        "on-secondary-container": "#064E3B",
        "on-secondary-fixed-variant": "#047857",

        tertiary: "#D97706",           // Amber warning
        "tertiary-container": "#FEF3C7",
        "on-tertiary-container": "#78350F",

        error: "#DC2626",
        "error-container": "#FEE2E2",
        "on-error": "#FFFFFF",
        "on-error-container": "#991B1B",

        info: "#2563EB",
        "info-container": "#DBEAFE",

        // Surfaces — warm off-white system
        background: "#F9F9F6",
        surface: "#F9F9F6",
        "surface-container-lowest": "#FFFFFF",
        "surface-container-low": "#F4F4F0",
        "surface-container": "#EFEFEA",
        "surface-container-high": "#E9E9E2",
        "surface-container-highest": "#E3E3DB",
        "surface-variant": "#EFEFEA",
        "surface-dim": "#E9E9E2",

        // Text
        "on-background": "#0B1220",
        "on-surface": "#0B1220",
        "on-surface-variant": "#5A6478",
        outline: "#94A0B5",
        "outline-variant": "#D4DAE3",
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        sm: "0.375rem",
        md: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
        full: "9999px",
      },
      spacing: {
        lg: "48px",
        gutter: "24px",
        sm: "12px",
        base: "8px",
        xs: "4px",
        md: "20px",
      },
      fontFamily: {
        headline: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        body: ['"Inter"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      fontSize: {
        // Display + headline scale (premium feel)
        "display-lg": ["48px", { lineHeight: "56px", letterSpacing: "-0.03em", fontWeight: "700" }],
        "display-md": ["38px", { lineHeight: "46px", letterSpacing: "-0.025em", fontWeight: "700" }],
        "headline-lg": ["30px", { lineHeight: "38px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-md": ["22px", { lineHeight: "30px", letterSpacing: "-0.015em", fontWeight: "600" }],
        "headline-sm": ["17px", { lineHeight: "24px", letterSpacing: "-0.005em", fontWeight: "600" }],
        "title-md": ["15px", { lineHeight: "22px", fontWeight: "600" }],
        "label-caps": ["11px", { lineHeight: "14px", letterSpacing: "0.08em", fontWeight: "700" }],
        "body-lg": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-md": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "body-sm": ["13px", { lineHeight: "18px", fontWeight: "400" }],
        "data-mono": ["13.5px", { lineHeight: "20px", fontWeight: "500" }],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(11,18,32,0.04), 0 1px 3px rgba(11,18,32,0.03)",
        elev: "0 4px 14px rgba(11,18,32,0.06), 0 1px 3px rgba(11,18,32,0.04)",
        pop: "0 12px 32px rgba(11,18,32,0.10), 0 2px 6px rgba(11,18,32,0.05)",
        ring: "0 0 0 4px rgba(255,94,58,0.18)",
      },
      transitionTimingFunction: {
        "out-quint": "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
