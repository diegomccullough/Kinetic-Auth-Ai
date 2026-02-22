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
  themeColor: '#026cdf'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
<<<<<<< HEAD
    <html lang="en" className="h-full">
      <body className="h-full min-h-dvh antialiased selection:bg-primary/20 selection:text-[var(--color-text)]">
=======
    <html lang="en" className="bg-black">
      <body className="antialiased selection:bg-sky-400/30 selection:text-white">
>>>>>>> 41804d7fd8c3cc3dfd31f08aaaed499e435524e1
        {children}
      </body>
    </html>
  );
}

