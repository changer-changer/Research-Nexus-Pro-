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
        background: { DEFAULT: '#09090b', secondary: '#18181b' },
        surface: { DEFAULT: '#27272a', hover: '#3f3f46' },
        primary: { DEFAULT: '#6366f1', hover: '#818cf8', dim: 'rgba(99, 102, 241, 0.1)' },
        status: {
          solved: '#22c55e',
          active: '#3b82f6',
          unsolved: '#ef4444',
          partial: '#f59e0b'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}