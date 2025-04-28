import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AppProvider } from "@/components/app-provider"
import { ReactQueryProvider } from "@/lib/react-query-provider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "DARYELCARE - Leave Management System",
  description: "Manage employee leave requests and balances",
  generator: "v0.dev",
  icons: {
    icon: [
      { url: "/images/daryelcare-logo.jpeg", sizes: "any" },
      { url: "/images/daryelcare-logo.jpeg", type: "image/jpeg" },
    ],
    apple: { url: "/images/daryelcare-logo.jpeg", type: "image/jpeg" },
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
        <link rel="icon" href="/images/daryelcare-logo.jpeg" sizes="any" />
        <link rel="icon" href="/images/daryelcare-logo.jpeg" type="image/jpeg" />
        <link rel="apple-touch-icon" href="/images/daryelcare-logo.jpeg" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <ReactQueryProvider>
            <AppProvider>{children}</AppProvider>
          </ReactQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
