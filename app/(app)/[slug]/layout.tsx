import Sidebar from '@/components/Sidebar'
import MobileNav from '@/components/MobileNav'

export default function ChurchLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Sidebar />
      <main className="min-h-full pb-20 md:pb-0 md:ml-56" style={{ background: 'transparent' }}>
        {children}
      </main>
      <MobileNav />
    </>
  )
}
