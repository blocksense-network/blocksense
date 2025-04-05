import localFont from 'next/font/local';

export const geist = localFont({
  src: '../public/font/Geist-Regular.woff2',
  variable: '--font-geist',
  fallback: ['system-ui', 'arial'],
  weight: '100 900',
});

export const geistMono = localFont({
  src: '../public/font/GeistMono-Regular.woff2',
  variable: '--font-geist-mono',
  fallback: ['system-ui', 'arial'],
  weight: '100 900',
});
