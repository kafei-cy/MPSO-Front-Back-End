import type React from "react"
import type { Metadata, Viewport } from "next"

import Navbar from "@/components/navbar"
import "./globals.css"

export const metadata: Metadata = {
  title: "CypherO - 多方隐私集合运算平台",
  description:
    "保护各方原始数据，完成交集、并集、交集数量与交集求和。",
 
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#080512",
  userScalable: true,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN">
      <body className="font-sans">
        <Navbar />
        {children}
      </body>
    </html>
  )
}
