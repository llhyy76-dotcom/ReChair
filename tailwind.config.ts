import type { Config } from 'tailwindcss';
const config: Config = { content: ['./app/**/*.{ts,tsx}','./components/**/*.{ts,tsx}'], theme: { extend: { colors: { navy:'#07111f', brand:'#2563eb', cyan:'#06b6d4' }, boxShadow:{soft:'0 24px 80px rgba(15,23,42,.14)'} } }, plugins: [] };
export default config;
