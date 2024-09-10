import type { Config } from 'tailwindcss';

const fallbackFonts = [
  'Inter',
  'ui-sans-serif',
  'system-ui',
  '-apple-system',
  'system-ui',
  'Segoe UI',
  'Roboto',
  'Helvetica Neue',
  'Arial',
  'Noto Sans',
  'sans-serif',
  'Apple Color Emoji',
  'Segoe UI Emoji',
  'Segoe UI Symbol',
  'Noto Color Emoji',
];

const config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './@/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
      boxShadow: {
        sm: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
      },
    },
    fontFamily: {
      body: ['Noto Sans', ...fallbackFonts],
      sans: ['Noto Sans', ...fallbackFonts],
      mono: ['Fira Code', ...fallbackFonts],
      'mono-space-bold': ['Space Mono Bold', ...fallbackFonts],
      'noto-sans-regular': ['Noto Sans Regular', ...fallbackFonts],
      'noto-sans-italic': ['Noto Sans Italic', ...fallbackFonts],
      'noto-sans-light': ['Noto Sans Light', ...fallbackFonts],
      'noto-sans-light-italic': ['Noto Sans Light Italic', ...fallbackFonts],
      'noto-sans-medium': ['Noto Sans Medium', ...fallbackFonts],
      'noto-sans-semibold': ['Noto Sans SemiBold', ...fallbackFonts],
      'noto-sans-semibold-italic': [
        'Noto Sans SemiBold Italic',
        ...fallbackFonts,
      ],
      'noto-sans-extra-bold': ['Noto Sans Extra Bold', ...fallbackFonts],
      'noto-sans-black': ['Noto Sans Black', ...fallbackFonts],
      'noto-sans-thin': ['Noto Sans Thin', ...fallbackFonts],
      'noto-sans-thin-italic': ['Noto Sans Thin Italic', ...fallbackFonts],
      'noto-sans-bold': ['Noto Sans Bold', ...fallbackFonts],
      'noto-sans-bold-italic': ['Noto Sans Bold Italic', ...fallbackFonts],
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;

export default config;
