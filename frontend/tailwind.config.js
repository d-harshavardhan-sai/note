import daisyui from 'daisyui';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'poppins': ['Poppins', 'sans-serif'],
        'ubuntu': ['Ubuntu', 'sans-serif'],
        'londrina': ['"Londrina Sketch"', 'cursive'],
        'pixelify': ['"Pixelify Sans"', 'cursive'],
        'comfortaa': ['Comfortaa', 'sans-serif'],
        'playwrite': ['"Playwrite Australia QLD"', 'cursive'],
        'creepster': ['Creepster', 'cursive'],
        'indie': ['"Indie Flower"', 'cursive'],
        'finger': ['"Finger Paint"', 'cursive'],
        'bungee': ['"Bungee Inline"', 'cursive'],
        'marker': ['"Permanent Marker"', 'cursive'],
        'mystery': ['"Mystery Quest"', 'cursive'],
        'mountains': ['"Mountains of Christmas"', 'cursive'],
        'patrick': ['"Patrick Hand"', 'cursive'],
        'rye': ['Rye', 'cursive'],
        'rocksalt': ['"Rock Salt"', 'cursive'],
      }
    },
  },
  plugins: [daisyui],
  // DaisyUI themes will now be overridden by our custom CSS variables from index.css
  // This means changing DaisyUI themes via daisyui:{themes:[]} might not visually affect the app as much,
  // because our custom themes directly override the root CSS variables.
  daisyui:{
    themes: ["pastel"], // You can keep your base DaisyUI theme here if you wish
  }
}