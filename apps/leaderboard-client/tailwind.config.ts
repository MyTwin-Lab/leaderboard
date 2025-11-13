import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          100: "#8AD0FF",
          200: "#52C1FF",
          300: "#1BA5FF",
        },
        brandCP: "#0af7c1", // <-- ta couleur perso
      },
    },
  },
  plugins: [],
};

export default config;
