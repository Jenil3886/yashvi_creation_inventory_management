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
        brand: {
          50: '#e6f4f1',
          100: '#c2e4de',
          200: '#99d2c7',
          300: '#6bbfb0',
          400: '#3ba795',
          500: '#008c73', // Primary brand emerald green
          600: '#007862', // Deep brand emerald green
          700: '#00604f',
          800: '#004b3e',
          900: '#003229', // Logo background forest green
        },
        darkBg: '#090d16',
        darkCard: '#131c2e',
        darkBorder: '#1e2d4a',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.7' },
        }
      }
    },
  },
  plugins: [],
}
