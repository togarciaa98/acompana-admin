/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#AF272F',
          50: '#FEF2F2',
          100: '#FEE2E2',
          500: '#DC2626',
          600: '#AF272F',
          700: '#8B1E24',
        },
      },
    },
  },
  plugins: [],
}
