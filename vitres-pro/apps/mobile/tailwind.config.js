/** @type {import('tailwindcss').Config} */
module.exports = {
  // ✅ Tailwind v3 : darkMode via classe
  darkMode: "class",

  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],

  theme: {
    extend: {
      colors: {
        // ✅ Couleurs STATIQUES qui fonctionnent avec dark:

        // Mode Clair (défaut)
        background: "#FFFFFF",
        foreground: "#09090B",

        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#09090B",
        },

        popover: {
          DEFAULT: "#FFFFFF",
          foreground: "#09090B",
        },

        primary: {
          DEFAULT: "#3B82F6",
          foreground: "#FFFFFF",
        },

        secondary: {
          DEFAULT: "#F4F4F5",
          foreground: "#18181B",
        },

        muted: {
          DEFAULT: "#F4F4F5",
          foreground: "#71717A",
        },

        accent: {
          DEFAULT: "#F4F4F5",
          foreground: "#18181B",
        },

        destructive: {
          DEFAULT: "#EF4444",
          foreground: "#FAFAFA",
        },

        border: "#E4E4E7",
        input: "#E4E4E7",
        ring: "#3B82F6",

        // ✅ Couleurs Slate pour dark mode
        slate: {
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          600: "#475569",
          700: "#334155",
          800: "#1E293B",
          900: "#0F172A",
          950: "#020617",
        },

        // ✅ Couleurs Status
        status: {
          planned: "#3B82F6",
          progress: "#F97316",
          done: "#22C55E",
        },
      },

      borderRadius: {
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
      },
    },
  },

  plugins: [],
};
