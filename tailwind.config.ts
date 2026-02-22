import type { Config } from 'tailwindcss';

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#026cdf", hover: "#0284e7" },
        surface: { DEFAULT: "#f5f6f8", elevated: "#ffffff" }
      },
      maxWidth: { ticket: "720px", verify: "560px" }
    }
  },
  plugins: []
} satisfies Config;

