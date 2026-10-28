/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#070913',
        panel: '#101423',
        ink: 'rgb(var(--ink-rgb) / <alpha-value>)',
        nova: {
          blue: '#63a8ff',
          violet: '#a78bfa',
          cyan: '#55e6e0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['"Cascadia Code"', '"SFMono-Regular"', 'Consolas', '"Liberation Mono"', 'monospace'],
      },
      boxShadow: {
        glass: '0 24px 80px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        glow: '0 0 32px rgba(99, 168, 255, 0.2)',
      },
    },
  },
  plugins: [],
};
