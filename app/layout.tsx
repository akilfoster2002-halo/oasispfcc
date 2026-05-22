import type { Metadata } from 'next'
import { Geist, Geist_Mono, Space_Grotesk, Cormorant_Garamond } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const spaceGrotesk = Space_Grotesk({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

// Cormorant Garamond — the Aquila serif voice
// Used for display headings, brand wordmark, and section titles
// where classical gravitas is needed
const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  title: 'Aquila',
  description: 'See your church clearly.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${cormorant.variable} h-full`}>
      <body className="h-full antialiased">
        {children}
      </body>
    </html>
  )
}
