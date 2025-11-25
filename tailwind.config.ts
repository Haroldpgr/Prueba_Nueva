import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: '#00b06f',
        dark: '#0f0f10',
        graysoft: '#1c1d1f'
      },
      borderRadius: {
        xl: '14px'
      },
      boxShadow: {
        soft: '0 8px 24px rgba(0,0,0,0.12)'
      }
    }
  },
  plugins: []
} satisfies Config

