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
      },
      boxShadow: {
        panel: "0 14px 40px rgba(4, 12, 20, 0.28)",
      },
    },
  },
  plugins: [],
};

export default config;
