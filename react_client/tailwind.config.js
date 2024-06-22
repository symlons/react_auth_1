module.exports = {
  purge: ['./src/**/*.{js,jsx,ts,tsx}', './index.html'],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      colors: {
        dark_gray1: '#02040a',
        dark_gray2: '#0d1116',
        dark_gray3: '#161b22',
        dark_red: '#e54d4d'
      }
    }
  },
  variants: {
    extend: {}
  },
  plugins: [require('tailwindcss'), require('autoprefixer')]
};
