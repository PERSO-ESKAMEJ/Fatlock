import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        bg2: 'var(--bg2)',
        panel: 'var(--panel)',
        panel2: 'var(--panel2)',
        border: 'var(--border)',
        blue: 'var(--blue)',
        'blue-bright': 'var(--blue-bright)',
        cyan: 'var(--cyan)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        muted2: 'var(--muted2)',
        gold: 'var(--gold)',
        red: 'var(--red)',
        green: 'var(--green)',
      },
      fontFamily: {
        display: ['Anton', 'sans-serif'],
        body: ['Archivo', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;