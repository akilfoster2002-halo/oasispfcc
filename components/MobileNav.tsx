'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Layers, BarChart3, MessageSquare } from 'lucide-react'

const items = [
  { href: '/', label: 'Home', icon: LayoutDashboard, exact: true },
  { href: '/people', label: 'People', icon: Users },
  { href: '/groups', label: 'Groups', icon: Layers },
  { href: '/reports', label: 'Analytics', icon: BarChart3 },
  { href: '/messaging', label: 'Messages', icon: MessageSquare },
]

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white z-50"
      style={{ borderTop: '1px solid #E5E7EB' }}>
      <div className="flex items-stretch h-16">
        {items.map(({ href, label, icon: Icon, exact }) => {
          const active = exact
            ? pathname === href
            : pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors"
              style={{ color: active ? '#4068E2' : '#9CA3AF' }}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
