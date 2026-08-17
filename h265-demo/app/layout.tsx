import type { Metadata } from 'next';
import 'bootstrap/dist/css/bootstrap.min.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'RTSPtoWeb H.265 (HEVC) HLS Player Demo',
  description: 'H.265 / HEVC fMP4 HLS player that auto-detects native decode support and falls back to hevc.js transcoding.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" data-bs-theme="dark">
      <body className="min-h-vh-100">{children}</body>
    </html>
  );
}
