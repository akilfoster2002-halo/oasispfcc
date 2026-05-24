'use client'

import Link from 'next/link'
import { usePathname, useParams } from 'next/navigation'
import { LayoutDashboard, Users, CalendarDays, Home, Radio } from 'lucide-react'

const NAV = [
  { path: 'dashboard', label: 'Home',     icon: LayoutDashboard },
  { path: 'people',    label: 'People',   icon: Users },
  { path: 'cells',     label: 'Cells',    icon: Home },
  { path: 'events',    label: 'Events',   icon: CalendarDays },
  { path: 'services',  label: 'Services', icon: Radio },
]

export default function MobileNav() {
  const pathname = usePathname()
  const params = useParams()
  const slug = (params?.slug as string) ?? pathname.split('/')[1] ?? ''

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: 'linear-gradient(180deg, rgba(5,8,18,0.94) 0%, rgba(7,10,20,0.99) 100%)',
        backdropFilter: 'blur(32px) saturate(160%)',
        WebkitBackdropFilter: 'blur(32px) saturate(160%)',
        borderTop: '1px solid rgba(255,255,255,0.055)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex items-stretch" style={{ height: 60 }}>
        {NAV.map(({ path, label, icon: Icon }) => {
          const href = `/${slug}/${path}`
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={path}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-[5px] transition-all duration-150"
              style={{ color: active ? '#C9A84C' : 'rgba(255,255,255,0.28)' }}
            >
              <div
                style={{
                  width: 34,
                  height: 26,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: active ? 'rgba(201,168,76,0.14)' : 'transparent',
                  transition: 'background 0.15s ease',
                }}
              >
                <Icon style={{ width: 16, height: 16 }} />
              </div>
              <span style={{
                fontSize: 10,
                fontWeight: active ? 500 : 400,
                letterSpacing: '0.01em',
                color: active ? '#C9A84C' : 'rgba(255,255,255,0.28)',
              }}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
