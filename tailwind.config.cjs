/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./index.tsx",
    "./App.tsx",
    "./components/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}",
    "./styles/**/*.css",
  ],
  theme: {
    extend: {
      colors: {
        'ivory': '#FDFBF7',
        'off-white': '#F9F8F6',
        'brand-deep': '#121212',
        'brand-earth': '#6B665F',
        'accent-earth': '#C25E00',
        'accent-forest': '#1E3A34',
      },
    },
  },
  plugins: [],
};
