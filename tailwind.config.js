/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ada: {
          ink: "#0e0f13",
          muted: "#667085",
          line: "rgba(15, 17, 22, 0.09)",
          canvas: "#f6f7fa",
          accent: "#635bff",
          "accent-2": "#8b5cf6",
          "accent-soft": "#efedff",
          lime: "#c7f36b",
          green: "#0e8f68",
          red: "#d6455d",
          amber: "#a15c00",
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
