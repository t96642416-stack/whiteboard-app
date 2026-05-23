/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#4F48ED",
        blue: {
          50:  "#EEEEFF",
          100: "#DDDDFB",
          200: "#C4C2F8",
          300: "#A9A6F4",
          400: "#8C88F0",
          500: "#4F48ED",
          600: "#3F38D6",
          700: "#2F28BF",
          800: "#1E18A8",
          900: "#0E0891",
        },
      },
    },
  },
  plugins: [],
};
