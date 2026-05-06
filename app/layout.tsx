import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Sidebar from '@/components/Sidebar'
import MobileNav from '@/components/MobileNav'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Oasis PFCC',
  description: 'Oasis PFCC Church Management System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="h-full antialiased" style={{ backgroundColor: '#F0F2F5' }}>
        <Sidebar />
        <main className="min-h-full pb-20 md:pb-0 md:ml-56">
          {children}
        </main>
        <MobileNav />
      </body>
    </html>
  )
}
