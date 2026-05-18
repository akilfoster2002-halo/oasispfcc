import Link from 'next/link'
import { Church, Users, BarChart3, MessageSquare, Shield, ArrowRight } from 'lucide-react'

const FEATURES = [
  {
    icon: Users,
    title: 'Member Management',
    desc: 'Track attendance, manage profiles, and keep your congregation organized.',
  },
  {
    icon: BarChart3,
    title: 'Analytics & Insights',
    desc: 'Understand growth trends, engagement, and retention at a glance.',
  },
  {
    icon: MessageSquare,
    title: 'Smart Messaging',
    desc: 'Reach members via SMS with AI-assisted follow-ups and campaigns.',
  },
  {
    icon: Shield,
    title: 'Role-Based Access',
    desc: 'Admins, leaders, volunteers — everyone sees exactly what they need.',
  },
]

export default function LandingPage() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: 'linear-gradient(180deg, rgba(8,12,26,1) 0%, rgba(10,14,35,1) 100%)',
        color: 'rgba(255,255,255,0.88)',
      }}
    >
      {/* Nav */}
      <header
        className="flex items-center justify-between px-6 md:px-12 h-16 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
              boxShadow: '0 0 16px rgba(129,140,248,0.40)',
            }}
          >
            <Church className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>
            Church-Link
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium rounded-xl transition-colors"
            style={{ color: 'rgba(255,255,255,0.60)' }}
            onMouseEnter={undefined}
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
              color: '#fff',
              boxShadow: '0 4px 16px rgba(99,102,241,0.40)',
            }}
          >
            Create Your Church
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8"
          style={{
            background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(129,140,248,0.25)',
            color: '#818cf8',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          Church management, reimagined
        </div>

        <h1
          className="text-5xl md:text-7xl font-extrabold leading-tight tracking-tight mb-6"
          style={{ color: 'rgba(255,255,255,0.95)' }}
        >
          The operating system
          <br />
          <span style={{ color: '#818cf8' }}>for your church</span>
        </h1>

        <p
          className="text-lg md:text-xl max-w-xl mx-auto mb-10"
          style={{ color: 'rgba(255,255,255,0.45)' }}
        >
          One platform for attendance, giving, messaging, and analytics.
          Invite your team and get started in minutes.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/signup"
            className="flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-semibold transition-all"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
              color: '#fff',
              boxShadow: '0 8px 32px rgba(99,102,241,0.45)',
            }}
          >
            Create Your Church — Free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="px-8 py-4 rounded-2xl text-base font-medium transition-all"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: 'rgba(255,255,255,0.70)',
            }}
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 md:px-12 pb-24">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="p-5 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
                style={{
                  background: 'rgba(99,102,241,0.15)',
                  border: '1px solid rgba(129,140,248,0.20)',
                }}
              >
                <Icon className="w-4.5 h-4.5" style={{ color: '#818cf8' }} />
              </div>
              <p className="text-sm font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>
                {title}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer
        className="px-6 md:px-12 py-6 text-center text-xs"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.20)' }}
      >
        © 2026 Church-Link · Built for modern ministries
      </footer>
    </div>
  )
}
