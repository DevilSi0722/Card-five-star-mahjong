import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "3D 卡五星麻将",
  description: "三人单机卡五星麻将 MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
