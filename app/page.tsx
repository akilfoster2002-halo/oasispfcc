import Link from 'next/link'
import Image from 'next/image'
import { Users, BarChart3, MessageSquare, Shield, CalendarDays, Eye, ArrowRight, Zap } from 'lucide-react'

const FEATURES = [
  {
    icon: Eye,
    title: 'People & Presence',
    desc: 'Know exactly who\'s in your church. Full profiles, contact info, group memberships, and attendance history — unified and searchable.',
  },
  {
    icon: BarChart3,
    title: 'Ministry Intelligence',
    desc: 'Real-time analytics across Sunday services, midweek gatherings, and cell meetings. Spot trends before they become problems.',
  },
  {
    icon: MessageSquare,
    title: 'First-Timer Follow-Up',
    desc: 'When someone attends for the first time, Aquila drafts a personalized message for your approval. No one falls through the cracks.',
  },
  {
    icon: CalendarDays,
    title: 'Event Visibility',
    desc: 'A live calendar of every service, cell, and gathering. Check people in with a tap. Know who showed up and who didn\'t.',
  },
  {
    icon: Zap,
    title: 'Engagement Health',
    desc: 'Surface members who are quietly disengaging before you lose them. Shepherd with data, not guesswork.',
  },
  {
    icon: Shield,
    title: 'Team & Roles',
    desc: 'Invite pastors, leaders, and volunteers with precise role-based access. Each person sees exactly what they need.',
  },
]

const STEPS = [
  { num: '01', title: 'Create your workspace', desc: 'Sign up in 60 seconds. Name your church, get a private workspace.' },
  { num: '02', title: 'Invite your team', desc: 'Pastors, leaders, volunteers — each role sees exactly what they need.' },
  { num: '03', title: 'Start tracking', desc: 'Log attendance, check people in, watch the complete picture form.' },
  { num: '04', title: 'See your church clearly', desc: 'Aquila surfaces who needs follow-up, who\'s thriving, and where your gaps are.' },
]

const STATS = [
  { value: '100%', label: 'Visibility' },
  { value: '0', label: 'People lost' },
  { value: '∞', label: 'Clarity' },
]

export default function LandingPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#050810',
        fontFamily: 'var(--font-geist-sans, system-ui, sans-serif)',
        WebkitFontSmoothing: 'antialiased',
        color: 'rgba(255,255,255,0.88)',
      }}
    >
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(-50%); }
          50% { transform: translateY(-12px) translateX(-50%); }
        }
        @keyframes pulse-ring {
          0% { opacity: 0.6; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.35); }
        }
        .ring-pulse { animation: pulse-ring 3s ease-out infinite; }
        .ring-pulse-delay { animation: pulse-ring 3s ease-out 1.5s infinite; }
        .hero-glow { animation: float 8s ease-in-out infinite; }
      `}</style>

      {/* ── Navbar ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(5,8,16,0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(255,255,255,0.055)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Image src="/Aquila Logo.png" width={32} height={32} alt="Aquila" />
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.94)', margin: 0, lineHeight: 1, fontFamily: 'var(--font-display, var(--font-geist-sans))' }}>
                Aquila
              </p>
              <p style={{ fontSize: 10, color: 'rgba(201,168,76,0.50)', letterSpacing: '0.07em', fontWeight: 500, margin: '3px 0 0', textTransform: 'uppercase' }}>
                by Oasis PFCC
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href="/pricing" style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.50)', textDecoration: 'none' }}>
              Pricing
            </Link>
            <Link href="/login" style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.50)', textDecoration: 'none', transition: 'color 0.15s' }}>
              Sign in
            </Link>
            <Link href="/signup" style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              background: 'linear-gradient(135deg, #A88A35 0%, #C9A84C 100%)',
              color: '#fff', textDecoration: 'none',
              boxShadow: '0 4px 16px rgba(201,168,76,0.35)',
            }}>
              Get started
              <ArrowRight style={{ width: 13, height: 13 }} />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{
        position: 'relative', overflow: 'hidden',
        padding: '120px 24px 140px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      }}>
        {/* Background radial glows */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: -180, left: '50%', width: 800, height: 800, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.14) 0%, transparent 65%)', transform: 'translateX(-50%)' }} />
          <div style={{ position: 'absolute', top: 80, left: '12%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,127,196,0.08) 0%, transparent 65%)' }} />
          <div style={{ position: 'absolute', top: 60, right: '8%', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(64,104,226,0.07) 0%, transparent 65%)' }} />
        </div>

        {/* Focus ring graphic */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -55%)', pointerEvents: 'none', zIndex: 0 }}>
          {[320, 480, 640, 800].map((size, i) => (
            <div key={size} style={{
              position: 'absolute',
              width: size, height: size,
              borderRadius: '50%',
              border: `1px solid rgba(201,168,76,${0.06 - i * 0.012})`,
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
            }} />
          ))}
          {/* Pulsing ring */}
          <div className="ring-pulse" style={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', border: '1px solid rgba(201,168,76,0.15)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
          <div className="ring-pulse-delay" style={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', border: '1px solid rgba(201,168,76,0.10)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
        </div>

        {/* Badge */}
        <div style={{
          position: 'relative', zIndex: 1,
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 14px', borderRadius: 100, marginBottom: 32,
          background: 'rgba(201,168,76,0.10)',
          border: '1px solid rgba(201,168,76,0.22)',
          fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
          color: '#C9A84C',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A84C', boxShadow: '0 0 8px #C9A84C' }} />
          Ministry Intelligence Platform
        </div>

        {/* Headline */}
        <h1 style={{
          position: 'relative', zIndex: 1,
          fontFamily: 'var(--font-display, var(--font-geist-sans))',
          fontSize: 'clamp(42px, 7vw, 80px)',
          fontWeight: 700,
          letterSpacing: '-0.035em',
          lineHeight: 1.05,
          margin: '0 0 24px',
          maxWidth: 760,
          color: 'rgba(255,255,255,0.96)',
        }}>
          See your church{' '}
          <span style={{
            background: 'linear-gradient(135deg, #C9A84C 0%, #C9A84C 40%, #A88A35 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            clearly.
          </span>
        </h1>

        {/* Subheadline */}
        <p style={{
          position: 'relative', zIndex: 1,
          fontSize: 'clamp(15px, 2vw, 19px)',
          lineHeight: 1.65,
          color: 'rgba(255,255,255,0.42)',
          maxWidth: 560,
          margin: '0 0 44px',
        }}>
          Aquila gives pastors and ministry leaders real-time visibility into engagement,
          follow-up, and community health — beautifully designed for the modern Church.
        </p>

        {/* CTAs */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
          <Link href="/pricing" style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '14px 28px', borderRadius: 14, fontSize: 14, fontWeight: 600,
            background: 'linear-gradient(135deg, #A88A35 0%, #C9A84C 100%)',
            color: '#fff', textDecoration: 'none',
            boxShadow: '0 8px 32px rgba(201,168,76,0.45)',
          }}>
            See pricing
            <ArrowRight style={{ width: 15, height: 15 }} />
          </Link>
          <Link href="/login" style={{
            display: 'flex', alignItems: 'center',
            padding: '14px 28px', borderRadius: 14, fontSize: 14, fontWeight: 500,
            color: 'rgba(255,255,255,0.50)', textDecoration: 'none',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.09)',
          }}>
            Sign in to your workspace
          </Link>
        </div>

        {/* Stats row */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 48, marginTop: 64, flexWrap: 'wrap', justifyContent: 'center' }}>
          {STATS.map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.90)', margin: 0 }}>{s.value}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)', margin: '4px 0 0', fontWeight: 500 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.12), transparent)', margin: '0 auto', width: '100%', maxWidth: 1100 }} />

      {/* ── Features ── */}
      <section style={{ padding: '100px 24px', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', bottom: 0, right: '10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.07) 0%, transparent 65%)' }} />
        </div>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(201,168,76,0.60)', marginBottom: 14 }}>
              Everything you need
            </p>
            <h2 style={{
              fontFamily: 'var(--font-display, var(--font-geist-sans))',
              fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 700,
              letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.94)', margin: '0 0 16px',
            }}>
              Clarity at every layer of ministry
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.38)', maxWidth: 460, margin: '0 auto', lineHeight: 1.6 }}>
              From Sunday headcounts to pastoral follow-up, Aquila connects every layer of your church.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} style={{
                padding: '28px 24px',
                borderRadius: 20,
                background: 'linear-gradient(145deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.015) 100%)',
                border: '1px solid rgba(255,255,255,0.065)',
                backdropFilter: 'blur(20px)',
                display: 'flex', flexDirection: 'column', gap: 14,
                transition: 'border-color 0.2s',
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: 'linear-gradient(135deg, rgba(201,168,76,0.20) 0%, rgba(201,168,76,0.10) 100%)',
                  border: '1px solid rgba(201,168,76,0.20)',
                }}>
                  <Icon style={{ width: 18, height: 18, color: '#C9A84C' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.90)', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
                    {title}
                  </h3>
                  <p style={{ fontSize: 13, lineHeight: 1.65, color: 'rgba(255,255,255,0.40)', margin: 0 }}>
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)', maxWidth: 1100, margin: '0 auto', width: '100%' }} />

      {/* ── How it works ── */}
      <section style={{ padding: '100px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(201,168,76,0.60)', marginBottom: 14 }}>
              Getting started
            </p>
            <h2 style={{
              fontFamily: 'var(--font-display, var(--font-geist-sans))',
              fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 700,
              letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.94)', margin: 0,
            }}>
              Up and running in minutes
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
            {STEPS.map((step, i) => (
              <div key={step.num} style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'relative' }}>
                {i < STEPS.length - 1 && (
                  <div style={{ display: 'none' }} className="step-connector" />
                )}
                <div style={{
                  width: 52, height: 52, borderRadius: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: 'linear-gradient(135deg, rgba(201,168,76,0.15) 0%, rgba(201,168,76,0.08) 100%)',
                  border: '1px solid rgba(201,168,76,0.20)',
                }}>
                  <span style={{
                    fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em',
                    background: 'linear-gradient(135deg, #C9A84C 0%, #C9A84C 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    fontFamily: 'var(--font-display)',
                  }}>
                    {step.num}
                  </span>
                </div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.88)', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
                    {step.title}
                  </h3>
                  <p style={{ fontSize: 13, lineHeight: 1.65, color: 'rgba(255,255,255,0.38)', margin: 0 }}>
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '40px 24px 100px' }}>
        <div style={{
          maxWidth: 900, margin: '0 auto',
          borderRadius: 28,
          padding: '80px 48px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(145deg, rgba(201,168,76,0.12) 0%, rgba(55,48,163,0.08) 50%, rgba(5,8,16,0.95) 100%)',
          border: '1px solid rgba(201,168,76,0.18)',
        }}>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: -80, left: '50%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.18) 0%, transparent 65%)', transform: 'translateX(-50%)' }} />
          </div>

          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
              <Image src="/Aquila Logo.png" width={64} height={64} alt="Aquila" />
            </div>
            <h2 style={{
              fontFamily: 'var(--font-display, var(--font-geist-sans))',
              fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700,
              letterSpacing: '-0.035em', color: 'rgba(255,255,255,0.96)',
              margin: '0 0 16px',
            }}>
              Shepherd with clarity.
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.38)', maxWidth: 420, margin: '0 auto 40px', lineHeight: 1.65 }}>
              Your church deserves a platform that helps you see what&apos;s really happening.
              No complexity. No clutter. Just clarity.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
              <Link href="/signup" style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '14px 32px', borderRadius: 14, fontSize: 14, fontWeight: 600,
                background: 'linear-gradient(135deg, #A88A35 0%, #C9A84C 100%)',
                color: '#fff', textDecoration: 'none',
                boxShadow: '0 8px 32px rgba(201,168,76,0.40)',
              }}>
                Create your workspace — free
                <ArrowRight style={{ width: 15, height: 15 }} />
              </Link>
              <Link href="/login" style={{
                padding: '14px 28px', borderRadius: 14, fontSize: 14, fontWeight: 500,
                color: 'rgba(255,255,255,0.40)', textDecoration: 'none',
              }}>
                Sign in →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.055)',
        padding: '24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
        maxWidth: 1100, margin: '0 auto', width: '100%', boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Image src="/Aquila Logo.png" width={24} height={24} alt="Aquila" />
          <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.35)', margin: 0, fontFamily: 'var(--font-display)' }}>Aquila</p>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.20)', margin: 0 }}>
          © 2026 Aquila · by Oasis PFCC
        </p>
      </footer>
    </div>
  )
}
