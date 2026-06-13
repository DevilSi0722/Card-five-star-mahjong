import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./store/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        table: "#16443b",
        felt: "#1f6f61",
        bone: "#f5f1df",
        ink: "#1d2530",
        gold: {
          soft: "#f3dca0",
          DEFAULT: "#e9c46a",
          deep: "#c79a3a",
        },
        jade: {
          soft: "#7fe3c4",
          DEFAULT: "#34d399",
          deep: "#0f9b75",
        },
      },
      fontFamily: {
        brand: ['var(--font-brand)', '"STKaiti"', '"KaiTi"', "serif"],
      },
      boxShadow: {
        panel: "0 14px 40px rgba(4, 12, 20, 0.28)",
        "panel-lg": "0 24px 70px rgba(2, 8, 14, 0.5)",
      },
    },
  },
  plugins: [],
};

export default config;
