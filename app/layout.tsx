import { Geist_Mono, Public_Sans } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils"
import { AppFrame } from "@/components/app-frame"
import { ThemeProvider } from "@/components/theme-provider"

const publicSans = Public_Sans({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", publicSans.variable)}
    >
      <body>
        <ThemeProvider>
          <AppFrame>{children}</AppFrame>
        </ThemeProvider>
      </body>
    </html>
  )
}
