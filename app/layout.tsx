import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kinetic Auth',
  description: 'Mobile-first verification'
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#000000'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full overflow-hidden bg-black">
      <body className="h-full overflow-hidden antialiased selection:bg-sky-400/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}

