import type React from "react"
import type { Metadata } from "next"
import { Manrope, Sora } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AppProvider } from "@/components/app-provider"
import { ReactQueryProvider } from "@/lib/react-query-provider"

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" })
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap", weight: ["400", "500", "600", "700"] })

export const metadata: Metadata = {
  title: { default: "DaryelCare", template: "%s · DaryelCare" },
  description: "Manage employee leave requests and balances",
  icons: {
    icon: [
      { url: "/images/daryelcare-mark.png", type: "image/png" },
    ],
    apple: { url: "/images/daryelcare-mark.png", type: "image/png" },
  },
  manifest: "/manifest.json",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/images/daryelcare-mark.png" type="image/png" />
        <link rel="apple-touch-icon" href="/images/daryelcare-mark.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`${manrope.variable} ${sora.variable} font-sans`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <ReactQueryProvider>
            <AppProvider>{children}</AppProvider>
          </ReactQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
