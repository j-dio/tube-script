import type { Config } from 'tailwindcss'

/** Light popup theme — white surfaces, dark text. */
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: '#ffffff',
        'on-surface': '#171717',
        'on-surface-variant': '#525866',
        'surface-header': '#ffffff',
        'surface-container-low': '#f4f4f5',
        'surface-container-lowest': '#fafafa',
        'surface-container-high': '#e4e4e7',
        'outline-variant': '#d4d4d8',
        primary: '#2b8ef0',
        'primary-strong': '#1565c0',
        'on-primary-fixed': '#ffffff',
        tertiary: '#047857',
        'tertiary-container': '#059669',
        'on-tertiary-container': '#064e3b',
        'error-ink': '#b91c1c',
        'error-surface': '#fef2f2',
      },
      boxShadow: {
        'cta-glow': '0 8px 24px rgba(37, 99, 235, 0.25)',
      },
    },
  },
  plugins: [],
} satisfies Config
