/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        hq: {
          blue: '#0B1220',
          'blue-dark': '#1C2942',
          'blue-light': '#EAFBFC',
          orange: '#F5931D',
          'orange-dark': '#D97B0E',
          cyan: '#16BFD6',
          'cyan-dark': '#0EA5BC',
          ink: '#55565A',
          mist: '#F4F6FB',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'sans-serif'],
        display: ['Nunito', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
