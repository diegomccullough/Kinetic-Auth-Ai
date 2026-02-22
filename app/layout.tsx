import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kinetic Auth',
  description: 'Mobile-first verification'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}

