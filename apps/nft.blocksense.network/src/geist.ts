import localFont from 'next/font/local';

export const geist = localFont({
  src: '../public/font/Geist-Regular.woff2',
  variable: '--font-geist',
  fallback: ['system-ui', 'sans-serif'],
  display: 'swap',
});

export const geistMono = localFont({
  src: '../public/font/GeistMono-Regular.woff2',
  variable: '--font-geist-mono',
  fallback: ['monospace'],
  display: 'swap',
});
