import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RTSPtoWeb H.265 (HEVC) HLS Player Demo',
  description: 'High-performance H.265 / HEVC HLS player for Chrome and Firefox supporting HLS-LL fMP4, hevc.js, and Hls.js.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className="dark">
      <body className="antialiased bg-slate-950 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
