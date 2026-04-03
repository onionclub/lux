import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        lucent: {
          bg: '#FAF7F0',
          surface: '#F2EDE3',
          accent: '#C9A96E',
          text: '#2C2A25',
          muted: '#7A7468',
          border: '#E0D9CE',
        },
      },
      fontFamily: {
        reading: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        ui: ['Inter', 'sans-serif'],
      },
      animation: {
        'receiving': 'receivingPulse 2000ms ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
