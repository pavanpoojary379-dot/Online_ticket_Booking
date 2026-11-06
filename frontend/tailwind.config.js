/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cinema: {
          950: '#090a0f',
          900: '#0e1117',
          850: '#141822',
          800: '#1a1f2c',
          700: '#262d3d',
          600: '#384259',
          accent: '#f97316',      // energetic cinema amber/orange
          accentHover: '#ea580c',
          gold: '#eab308',
          silver: '#94a3b8',
          platinum: '#38bdf8'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}

