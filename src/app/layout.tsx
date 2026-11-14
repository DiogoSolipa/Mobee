import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { ToastHost } from '@/components/app/Shell';
import { StoreProvider } from '@/lib/store';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mobee',
  description: 'Plans change. Mobee adapts.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  appleWebApp: { capable: true, title: 'Mobee', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbf8f2' },
    { media: '(prefers-color-scheme: dark)', color: '#11181b' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="day" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=DM+Mono:wght@400;500&family=Figtree:wght@400..800&display=swap" />
      </head>
      <body>
        <StoreProvider>
          <ToastHost />
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}
