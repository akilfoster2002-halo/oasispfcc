import type { Metadata } from 'next'
import { Inter, Geist_Mono, Cormorant_Garamond } from 'next/font/google'
import './globals.css'

// Inter — body and UI sans-serif
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

// Cormorant Garamond — display serif
// Hero headlines, welcome headings, pull quotes only.
// Never inside dashboard UI, nav, or data tables.
const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
})

const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://aquila.church').replace(/\/$/, '')

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'Aquila',
    template: '%s — Aquila',
  },
  description: 'Modern church management platform. Cell analytics, AI-powered follow-up, service insights, and team coordination — all in one place.',
  applicationName: 'Aquila',
  keywords: ['church management', 'cell group analytics', 'church software', 'ministry platform'],
  authors: [{ name: 'Oasis PFCC' }],
  themeColor: '#C9A84C',
  manifest: '/site.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Aquila',
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'android-chrome', url: '/android-chrome-192x192.png', sizes: '192x192' },
      { rel: 'android-chrome', url: '/android-chrome-512x512.png', sizes: '512x512' },
    ],
  },
  openGraph: {
    type: 'website',
    url: appUrl,
    siteName: 'Aquila',
    title: 'Aquila — See your church clearly.',
    description: 'Modern church management platform. Cell analytics, AI-powered follow-up, service insights, and team coordination — all in one place.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Aquila — Modern church management platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aquila — See your church clearly.',
    description: 'Modern church management platform. Cell analytics, AI-powered follow-up, service insights, and team coordination — all in one place.',
    images: ['/opengraph-image'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable} ${cormorant.variable} h-full`}>
      <body className="h-full antialiased">
        {children}
      </body>
    </html>
  )
}
