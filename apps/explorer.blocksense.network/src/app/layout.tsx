import '@/../globals.css';

import { type Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blocksense Explorer',
  description: '',
  icons: [{ rel: 'icon', url: '/blocksense-favicon.png' }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
