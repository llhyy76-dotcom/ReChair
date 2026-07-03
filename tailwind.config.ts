import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#07111f',
        brand: '#2563eb',
        cyan: '#06b6d4'
      }
    }
  },
  plugins: []
};

export default config;
