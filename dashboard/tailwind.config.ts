import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'slide-in': 'slide-in 0.2s ease-out',
      },
      colors: {
        mc: {
          bg: 'var(--mc-bg)',
          'bg-secondary': 'var(--mc-bg-secondary)',
          'bg-tertiary': 'var(--mc-bg-tertiary)',
          border: 'var(--mc-border)',
          text: 'var(--mc-text)',
          'text-secondary': 'var(--mc-text-secondary)',
          accent: 'var(--mc-accent)',
          'accent-pink': 'var(--mc-accent-pink)',
          'accent-yellow': 'var(--mc-accent-yellow)',
          'accent-red': 'var(--mc-accent-red)',
          'accent-green': 'var(--mc-accent-green)',
        },
      },
      backgroundColor: {
        'mc-bg': 'var(--mc-bg)',
        'mc-bg-secondary': 'var(--mc-bg-secondary)',
        'mc-bg-tertiary': 'var(--mc-bg-tertiary)',
      },
      borderColor: {
        'mc-border': 'var(--mc-border)',
      },
      textColor: {
        'mc-text': 'var(--mc-text)',
        'mc-text-secondary': 'var(--mc-text-secondary)',
        'mc-text-muted': 'var(--mc-text-muted)',
      },
      textDecorationColor: {
        'mc-border': 'var(--mc-border)',
      },
    },
  },
  plugins: [],
};

export default config;
