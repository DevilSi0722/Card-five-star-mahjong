import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// 中式书法体（马善政），仅用于品牌标题与胡牌特效；已按源码实际用字子集化（5.6MB → 356KB），懒加载不阻塞首屏。
// 若新增使用 brand-title / win-callig 的文案包含子集外字符，会回退到 STKaiti/KaiTi，需重新生成子集。
const brandFont = localFont({
  src: "../public/fonts/MaShanZheng-Regular-subset.woff2",
  variable: "--font-brand",
  display: "swap",
  weight: "400",
});

export const metadata: Metadata = {
  title: "3D 卡五星麻将",
  description: "三人单机卡五星麻将 MVP",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "1024x1024", type: "image/png" }],
    other: [
      { rel: "icon", url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { rel: "icon", url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={brandFont.variable}>
      <body>{children}</body>
    </html>
  );
}
