import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Pulled from the CommonDuty logo — cream background, punchy
      // yellow accent, red/purple/blue for the wordmark treatment.
      colors: {
        cream: "#F2EEE3",
        duty: {
          yellow: "#F2D53C",
          red: "#E1503B",
          purple: "#6C3FD1",
          blue: "#3752E0",
        },
      },
    },
  },
  plugins: [],
};
export default config;
