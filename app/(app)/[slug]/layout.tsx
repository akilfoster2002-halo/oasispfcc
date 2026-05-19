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
      <main className="main-content min-h-full pb-20 md:pb-0" style={{ background: 'transparent' }}>
        {children}
      </main>
      <MobileNav />
    </>
  )
}
