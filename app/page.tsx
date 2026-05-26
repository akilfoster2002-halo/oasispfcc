import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Users, CalendarDays, BarChart3, MessageSquare, Bot, Grid3x3, UserCheck, MapPin, Bell } from 'lucide-react'

const FEATURES = [
  {
    icon: Bot,
    title: 'Aquila Agent',
    desc: 'Your AI ministry assistant. Ask about attendance trends, identify who hasn\'t been seen in weeks, or draft a follow-up message — all in plain conversation.',
    badge: 'AI-Powered',
  },
  {
    icon: Grid3x3,
    title: 'Cell Groups & Attendance',
    desc: 'Track every cell meeting with full attendance logs. See who showed up, who didn\'t, and which leaders are most active — down to the individual.',
    badge: null,
  },
  {
    icon: CalendarDays,
    title: 'Events & Check-In',
    desc: 'A live calendar for every Sunday service, midweek gathering, and special event. Check people in from any device. Real attendance data, not estimates.',
    badge: null,
  },
  {
    icon: UserCheck,
    title: 'First-Timer Follow-Up',
    desc: 'When a new face shows up, Aquila flags them and drafts a personalized follow-up message for your approval. Nobody slips through the cracks.',
    badge: 'AI-Powered',
  },
  {
    icon: Users,
    title: 'People Management',
    desc: 'Full member profiles with contact info, group memberships, giving history, and attendance records — all in one searchable place.',
    badge: null,
  },
  {
    icon: BarChart3,
    title: 'Ministry Analytics',
    desc: 'Dashboards that show service trends, cell health, engagement scores, and giving summaries. Know what\'s growing and what needs attention.',
    badge: null,
  },
  {
    icon: MessageSquare,
    title: 'Team Messaging',
    desc: 'Communicate directly with your pastoral team inside Aquila. Keep conversations tied to the context — a person, a cell, a service.',
    badge: null,
  },
  {
    icon: MapPin,
    title: 'Groups & Zones',
    desc: 'Organize your congregation into geographic zones, ministry groups, or life stages. Cells belong to groups, groups belong to your church structure.',
    badge: null,
  },
  {
    icon: Bell,
    title: 'Engagement Alerts',
    desc: 'Aquila watches for members who are quietly disengaging — missing services, missing cells, going silent. Get notified before you lose them.',
    badge: 'AI-Powered',
  },
]

const STEPS = [
  { num: '01', title: 'Create your workspace', desc: 'Sign up in 60 seconds. Name your church and get a private workspace instantly.' },
  { num: '02', title: 'Add your people', desc: 'Import your members or add them as they come in. Build the full picture of your congregation.' },
  { num: '03', title: 'Track cells & services', desc: 'Log attendance at every service and cell meeting. Real data, not guesswork.' },
  { num: '04', title: 'Let Aquila work', desc: 'Your AI agent surfaces who needs follow-up, who\'s thriving, and what\'s changing — before you have to ask.' },
]

export default function LandingPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#050810',
      fontFamily: 'var(--font-geist-sans, system-ui, sans-serif)',
      WebkitFontSmoothing: 'antialiased',
      color: 'rgba(255,255,255,0.88)',
    }}>
      <style>{`
        @keyframes pulse-ring {
          0% { opacity: 0.5; transform: translate(-50%,-50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%,-50%) scale(1.4); }
        }
        .ring-pulse { animation: pulse-ring 3s ease-out infinite; }
        .ring-pulse-delay { animation: pulse-ring 3s ease-out 1.5s infinite; }
      `}</style>

      {/* ── Navbar ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(5,8,16,0.88)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(255,255,255,0.055)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Image src="/Aquila Logo.png" width={32} height={32} alt="Aquila" />
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.94)', margin: 0, lineHeight: 1 }}>Aquila</p>
              <p style={{ fontSize: 10, color: 'rgba(201,168,76,0.50)', letterSpacing: '0.07em', fontWeight: 500, margin: '3px 0 0', textTransform: 'uppercase' }}>by Oasis PFCC</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href="/pricing" style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.50)', textDecoration: 'none' }}>
              Pricing
            </Link>
            <Link href="/login" style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.50)', textDecoration: 'none' }}>
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
        {/* Background glows */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: -180, left: '50%', width: 800, height: 800, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.13) 0%, transparent 65%)', transform: 'translateX(-50%)' }} />
          <div style={{ position: 'absolute', top: 80, left: '10%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,127,196,0.07) 0%, transparent 65%)' }} />
          <div style={{ position: 'absolute', top: 60, right: '8%', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(64,104,226,0.06) 0%, transparent 65%)' }} />
        </div>

        {/* Orbit rings */}
        <div style={{ position: 'absolute', top: '48%', left: '50%', pointerEvents: 'none', zIndex: 0 }}>
          {[320, 480, 640].map((size, i) => (
            <div key={size} style={{
              position: 'absolute',
              width: size, height: size,
              borderRadius: '50%',
              border: `1px solid rgba(201,168,76,${0.07 - i * 0.018})`,
              transform: 'translate(-50%, -50%)',
            }} />
          ))}
          <div className="ring-pulse" style={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', border: '1px solid rgba(201,168,76,0.14)', transform: 'translate(-50%, -50%)' }} />
          <div className="ring-pulse-delay" style={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', border: '1px solid rgba(201,168,76,0.08)', transform: 'translate(-50%, -50%)' }} />
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
          Church Management Platform
        </div>

        {/* Headline */}
        <h1 style={{
          position: 'relative', zIndex: 1,
          fontSize: 'clamp(40px, 7vw, 76px)',
          fontWeight: 700,
          letterSpacing: '-0.035em',
          lineHeight: 1.05,
          margin: '0 0 24px',
          maxWidth: 780,
          color: 'rgba(255,255,255,0.96)',
        }}>
          The command center for{' '}
          <span style={{
            background: 'linear-gradient(135deg, #C9A84C 0%, #DDB95A 50%, #A88A35 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            visionary ministry.
          </span>
        </h1>

        {/* Subheadline */}
        <p style={{
          position: 'relative', zIndex: 1,
          fontSize: 'clamp(15px, 2vw, 18px)',
          lineHeight: 1.7,
          color: 'rgba(255,255,255,0.42)',
          maxWidth: 580,
          margin: '0 0 44px',
        }}>
          Track cell attendance, manage your congregation, follow up with first-timers,
          and ask your AI agent anything — all in one platform built for the modern church.
        </p>

        {/* CTAs */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
          <Link href="/signup" style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '14px 28px', borderRadius: 14, fontSize: 14, fontWeight: 600,
            background: 'linear-gradient(135deg, #A88A35 0%, #C9A84C 100%)',
            color: '#fff', textDecoration: 'none',
            boxShadow: '0 8px 32px rgba(201,168,76,0.45)',
          }}>
            Create your workspace — free
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
      </section>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.14), transparent)', maxWidth: 1100, margin: '0 auto', width: '100%' }} />

      {/* ── AI spotlight ── */}
      <section style={{ padding: '100px 24px 80px', position: 'relative' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 48, alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(201,168,76,0.60)', marginBottom: 14, margin: '0 0 14px' }}>
              Meet your AI assistant
            </p>
            <h2 style={{
              fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 700,
              letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.94)', margin: '0 0 20px', lineHeight: 1.15,
            }}>
              Ask Aquila anything about your church
            </h2>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.40)', lineHeight: 1.7, margin: '0 0 28px' }}>
              Aquila Agent is your AI ministry assistant — trained on your church&apos;s data.
              Ask it who hasn&apos;t attended in three weeks, which cells are declining, or to write
              a follow-up message for a first-timer. Get answers in seconds.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                '"Who hasn\'t been to cell in the last 3 weeks?"',
                '"Draft a follow-up for John — first visit last Sunday."',
                '"Which cells had the highest attendance this month?"',
              ].map(q => (
                <div key={q} style={{
                  padding: '12px 16px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  fontSize: 13, color: 'rgba(255,255,255,0.55)',
                  fontStyle: 'italic',
                }}>
                  {q}
                </div>
              ))}
            </div>
          </div>
          <div style={{
            padding: '32px',
            borderRadius: 24,
            background: 'linear-gradient(145deg, rgba(201,168,76,0.08) 0%, rgba(255,255,255,0.03) 100%)',
            border: '1px solid rgba(201,168,76,0.16)',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, rgba(201,168,76,0.25), rgba(201,168,76,0.12))', border: '1px solid rgba(201,168,76,0.24)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot style={{ width: 16, height: 16, color: '#C9A84C' }} />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.80)', margin: 0 }}>Aquila Agent</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', margin: 0 }}>Powered by your church data</p>
              </div>
            </div>
            {[
              { role: 'user', msg: 'Which members haven\'t attended in the last 30 days?' },
              { role: 'agent', msg: '14 members haven\'t attended any service or cell in 30+ days. The most at-risk are James Okonkwo (last seen 6 weeks ago), Priya Nair, and 3 others from Cell 4B. Want me to draft follow-up messages?' },
            ].map((m, i) => (
              <div key={i} style={{
                padding: '12px 14px',
                borderRadius: 12,
                background: m.role === 'user' ? 'rgba(255,255,255,0.06)' : 'rgba(201,168,76,0.08)',
                border: `1px solid ${m.role === 'user' ? 'rgba(255,255,255,0.08)' : 'rgba(201,168,76,0.14)'}`,
                fontSize: 13,
                color: m.role === 'user' ? 'rgba(255,255,255,0.65)' : 'rgba(255,248,220,0.78)',
                lineHeight: 1.55,
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '90%',
              }}>
                {m.msg}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)', maxWidth: 1100, margin: '0 auto', width: '100%' }} />

      {/* ── Features grid ── */}
      <section style={{ padding: '100px 24px', position: 'relative' }}>
        <div style={{ position: 'absolute', bottom: 0, right: '8%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(201,168,76,0.60)', marginBottom: 14 }}>
              Everything in one place
            </p>
            <h2 style={{
              fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 700,
              letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.94)', margin: '0 0 16px',
            }}>
              Every tool your ministry needs
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.36)', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
              From Sunday attendance to cell follow-up, Aquila connects every layer of your church in one platform.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            {FEATURES.map(({ icon: Icon, title, desc, badge }) => (
              <div key={title} style={{
                padding: '26px 24px',
                borderRadius: 20,
                background: 'linear-gradient(145deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.015) 100%)',
                border: '1px solid rgba(255,255,255,0.065)',
                display: 'flex', flexDirection: 'column', gap: 12,
                position: 'relative',
                overflow: 'hidden',
              }}>
                {badge && (
                  <span style={{
                    position: 'absolute', top: 16, right: 16,
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                    padding: '3px 8px', borderRadius: 99,
                    background: 'rgba(201,168,76,0.14)',
                    border: '1px solid rgba(201,168,76,0.24)',
                    color: '#C9A84C',
                  }}>
                    {badge}
                  </span>
                )}
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(135deg, rgba(201,168,76,0.20) 0%, rgba(201,168,76,0.10) 100%)',
                  border: '1px solid rgba(201,168,76,0.20)',
                }}>
                  <Icon style={{ width: 17, height: 17, color: '#C9A84C' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.90)', margin: '0 0 7px', letterSpacing: '-0.01em' }}>
                    {title}
                  </h3>
                  <p style={{ fontSize: 13, lineHeight: 1.65, color: 'rgba(255,255,255,0.38)', margin: 0 }}>
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
              fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 700,
              letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.94)', margin: 0,
            }}>
              Up and running in minutes
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
            {STEPS.map((step, i) => (
              <div key={step.num} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(135deg, rgba(201,168,76,0.15) 0%, rgba(201,168,76,0.08) 100%)',
                  border: '1px solid rgba(201,168,76,0.20)',
                }}>
                  <span style={{
                    fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em',
                    background: 'linear-gradient(135deg, #C9A84C, #A88A35)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                  }}>
                    {step.num}
                  </span>
                </div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.88)', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
                    {step.title}
                  </h3>
                  <p style={{ fontSize: 13, lineHeight: 1.65, color: 'rgba(255,255,255,0.36)', margin: 0 }}>
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
          borderRadius: 28, padding: '80px 48px',
          textAlign: 'center', position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(145deg, rgba(201,168,76,0.11) 0%, rgba(55,48,163,0.07) 50%, rgba(5,8,16,0.96) 100%)',
          border: '1px solid rgba(201,168,76,0.18)',
        }}>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: -80, left: '50%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.16) 0%, transparent 65%)', transform: 'translateX(-50%)' }} />
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
              <Image src="/Aquila Logo.png" width={64} height={64} alt="Aquila" />
            </div>
            <h2 style={{
              fontSize: 'clamp(26px, 4vw, 44px)', fontWeight: 700,
              letterSpacing: '-0.035em', color: 'rgba(255,255,255,0.96)',
              margin: '0 0 16px',
            }}>
              Shepherd with clarity.
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.36)', maxWidth: 440, margin: '0 auto 40px', lineHeight: 1.65 }}>
              Know who&apos;s in every cell, every service, every week.
              Aquila gives your pastoral team the visibility to lead with confidence.
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
              <Link href="/pricing" style={{
                padding: '14px 28px', borderRadius: 14, fontSize: 14, fontWeight: 500,
                color: 'rgba(255,255,255,0.40)', textDecoration: 'none',
              }}>
                See pricing →
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
          <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.35)', margin: 0 }}>Aquila</p>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.20)', margin: 0 }}>
          © 2026 Aquila · by Oasis PFCC
        </p>
      </footer>
    </div>
  )
}
