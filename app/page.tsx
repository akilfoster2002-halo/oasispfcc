import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Bot, Grid3x3, BarChart3, TrendingUp, TrendingDown, Users, CalendarCheck, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react'

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
          100% { opacity: 0; transform: translate(-50%,-50%) scale(1.45); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ring-pulse  { animation: pulse-ring 3.2s ease-out infinite; }
        .ring-delay  { animation: pulse-ring 3.2s ease-out 1.6s infinite; }
        .fade-up     { animation: fade-up 0.6s ease both; }
        .fade-up-1   { animation: fade-up 0.6s 0.1s ease both; }
        .fade-up-2   { animation: fade-up 0.6s 0.2s ease both; }
        .fade-up-3   { animation: fade-up 0.6s 0.3s ease both; }
        .bar-fill    { transition: width 1.2s cubic-bezier(0.4,0,0.2,1); }
      `}</style>

      {/* ── Navbar ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(5,8,16,0.90)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(255,255,255,0.055)',
      }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Image src="/Aquila Logo.png" width={32} height={32} alt="Aquila" />
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.94)', margin: 0, lineHeight: 1 }}>Aquila</p>
              <p style={{ fontSize: 10, color: 'rgba(201,168,76,0.50)', letterSpacing: '0.07em', fontWeight: 500, margin: '3px 0 0', textTransform: 'uppercase' }}>by Oasis PFCC</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href="/pricing" style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}>Pricing</Link>
            <Link href="/login"   style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}>Sign in</Link>
            <Link href="/signup"  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg,#A88A35,#C9A84C)', color: '#fff', textDecoration: 'none', boxShadow: '0 4px 16px rgba(201,168,76,0.35)' }}>
              Get started <ArrowRight style={{ width: 13, height: 13 }} />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: '110px 24px 120px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        {/* Glows */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: -200, left: '50%', width: 900, height: 900, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.11) 0%, transparent 62%)', transform: 'translateX(-50%)' }} />
          <div style={{ position: 'absolute', top: 60, left: '8%',  width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,127,196,0.07) 0%, transparent 65%)' }} />
          <div style={{ position: 'absolute', top: 40, right: '6%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(64,104,226,0.06) 0%, transparent 65%)' }} />
        </div>
        {/* Rings */}
        <div style={{ position: 'absolute', top: '46%', left: '50%', pointerEvents: 'none', zIndex: 0 }}>
          {[300, 460, 620].map((s, i) => (
            <div key={s} style={{ position: 'absolute', width: s, height: s, borderRadius: '50%', border: `1px solid rgba(201,168,76,${0.08 - i * 0.02})`, transform: 'translate(-50%,-50%)' }} />
          ))}
          <div className="ring-pulse" style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', border: '1px solid rgba(201,168,76,0.16)', transform: 'translate(-50%,-50%)' }} />
          <div className="ring-delay"  style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', border: '1px solid rgba(201,168,76,0.09)', transform: 'translate(-50%,-50%)' }} />
        </div>

        {/* Badge */}
        <div className="fade-up" style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 100, marginBottom: 28, background: 'rgba(201,168,76,0.10)', border: '1px solid rgba(201,168,76,0.22)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#C9A84C' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A84C', boxShadow: '0 0 8px #C9A84C' }} />
          Church Management Platform
        </div>

        {/* Headline */}
        <h1 className="fade-up-1" style={{ position: 'relative', zIndex: 1, fontSize: 'clamp(44px, 7.5vw, 84px)', fontWeight: 700, letterSpacing: '-0.038em', lineHeight: 1.03, margin: '0 0 26px', maxWidth: 800, color: 'rgba(255,255,255,0.97)' }}>
          See your church{' '}
          <span style={{ background: 'linear-gradient(135deg,#DDB95A 0%,#C9A84C 45%,#A88A35 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            clearly.
          </span>
        </h1>

        {/* Sub */}
        <p className="fade-up-2" style={{ position: 'relative', zIndex: 1, fontSize: 'clamp(15px, 2vw, 19px)', lineHeight: 1.7, color: 'rgba(255,255,255,0.40)', maxWidth: 560, margin: '0 0 44px' }}>
          Track every cell meeting, every service, every member — and let your AI assistant surface who needs attention before anyone slips away.
        </p>

        {/* CTAs */}
        <div className="fade-up-3" style={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginBottom: 72 }}>
          <Link href="/signup" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 28px', borderRadius: 14, fontSize: 14, fontWeight: 600, background: 'linear-gradient(135deg,#A88A35,#C9A84C)', color: '#fff', textDecoration: 'none', boxShadow: '0 8px 32px rgba(201,168,76,0.45)' }}>
            Create your workspace — free <ArrowRight style={{ width: 15, height: 15 }} />
          </Link>
          <Link href="/login" style={{ display: 'flex', alignItems: 'center', padding: '14px 28px', borderRadius: 14, fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.45)', textDecoration: 'none', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
            Sign in to your workspace
          </Link>
        </div>

        {/* ── Live analytics mockup ── */}
        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 920, borderRadius: 24, overflow: 'hidden', background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 40px 100px rgba(0,0,0,0.55), 0 0 0 1px rgba(201,168,76,0.08)' }}>
          {/* Window bar */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.025)' }}>
            {['#FF5F57','#FEBC2E','#28C840'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.8 }} />)}
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginLeft: 8, letterSpacing: '-0.01em' }}>Aquila — BLW Oasis Dashboard</span>
          </div>

          <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            {/* Stat cards */}
            {[
              { label: 'Sunday Attendance', value: '284', change: '+18', up: true, sub: 'vs last week' },
              { label: 'Active Cells',       value: '18/22', change: '82%', up: true, sub: 'health score' },
              { label: 'First-Timers',       value: '7',     change: '+3',  up: true, sub: 'this month' },
              { label: 'At-Risk Members',    value: '4',     change: '−2', up: true, sub: 'need follow-up' },
            ].map(s => (
              <div key={s.label} style={{ padding: '16px 18px', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: '0 0 8px', fontWeight: 500 }}>{s.label}</p>
                <p style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.92)', margin: '0 0 6px', lineHeight: 1 }}>{s.value}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {s.up
                    ? <TrendingUp style={{ width: 11, height: 11, color: '#4ADE80' }} />
                    : <TrendingDown style={{ width: 11, height: 11, color: '#F87171' }} />}
                  <span style={{ fontSize: 11, color: s.up ? '#4ADE80' : '#F87171', fontWeight: 600 }}>{s.change}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{s.sub}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Attendance bars */}
          <div style={{ padding: '0 24px 20px' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.30)', letterSpacing: '0.05em', textTransform: 'uppercase', margin: '0 0 14px' }}>Attendance — Last 6 Weeks</p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 64 }}>
              {[62, 74, 58, 81, 69, 100].map((pct, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                  <div style={{ width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: 6, overflow: 'hidden', height: 52 }}>
                    <div style={{ width: '100%', height: `${pct}%`, background: i === 5 ? 'linear-gradient(180deg,#DDB95A,#A88A35)' : 'rgba(201,168,76,0.30)', borderRadius: 6, marginTop: `${100 - pct}%`, transition: 'margin-top 0.8s ease' }} />
                  </div>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)' }}>{['W1','W2','W3','W4','W5','W6'][i]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cell health rows */}
          <div style={{ padding: '0 24px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { name: 'Cell 4B — North', leader: 'Marcus O.', pct: 91, status: 'healthy' },
              { name: 'Cell 7A — East',  leader: 'Priya N.',  pct: 63, status: 'watch'   },
              { name: 'Cell 2C — West',  leader: 'James K.',  pct: 85, status: 'healthy' },
              { name: 'Cell 9D — South', leader: 'Aisha M.',  pct: 38, status: 'alert'   },
            ].map(c => (
              <div key={c.name} style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.80)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', margin: 0 }}>{c.leader}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <div style={{ width: 36, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${c.pct}%`, borderRadius: 99, background: c.status === 'healthy' ? '#4ADE80' : c.status === 'watch' ? '#FACC15' : '#F87171' }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: c.status === 'healthy' ? '#4ADE80' : c.status === 'watch' ? '#FACC15' : '#F87171' }}>{c.pct}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* AI row */}
          <div style={{ margin: '0 24px 24px', padding: '14px 18px', borderRadius: 14, background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.16)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Bot style={{ width: 16, height: 16, color: '#C9A84C', flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: 'rgba(255,248,220,0.65)', margin: 0, lineHeight: 1.5 }}>
              <span style={{ color: '#C9A84C', fontWeight: 600 }}>Aquila:</span>{' '}
              Cell 9D has dropped 42% in 3 weeks. 4 members haven&apos;t attended any meeting this month — want me to draft follow-up messages?
            </p>
            <ChevronRight style={{ width: 14, height: 14, color: 'rgba(201,168,76,0.50)', flexShrink: 0 }} />
          </div>
        </div>
      </section>

      {/* ── 3 Pillars ── */}
      <section style={{ padding: '100px 24px', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '30%', left: '-5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,127,196,0.06) 0%, transparent 65%)' }} />
          <div style={{ position: 'absolute', bottom: '10%', right: '-5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 65%)' }} />
        </div>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(201,168,76,0.60)', margin: '0 0 14px' }}>Three pillars</p>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.94)', margin: 0 }}>
              Everything your church needs to thrive
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>

            {/* Pillar 1 — Cell System */}
            <div style={{ padding: '36px 32px', borderRadius: 24, background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, rgba(201,168,76,0.22), rgba(201,168,76,0.10))', border: '1px solid rgba(201,168,76,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Grid3x3 style={{ width: 20, height: 20, color: '#C9A84C' }} />
              </div>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.94)', margin: '0 0 12px' }}>Cell System</h3>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.40)', margin: '0 0 24px' }}>
                  Track every cell group with full attendance logs. Know who showed up, who led, and which cells need attention — down to the individual member.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  'Mark attendance per meeting, per member',
                  'Group cells by zone, region, or campus',
                  'See historical attendance for every cell',
                  'Leader accountability built in',
                ].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <CheckCircle2 style={{ width: 14, height: 14, color: '#C9A84C', flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.50)', lineHeight: 1.5 }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pillar 2 — Ministry Analytics */}
            <div style={{ padding: '36px 32px', borderRadius: 24, background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, rgba(201,168,76,0.22), rgba(201,168,76,0.10))', border: '1px solid rgba(201,168,76,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart3 style={{ width: 20, height: 20, color: '#C9A84C' }} />
              </div>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.94)', margin: '0 0 12px' }}>Ministry Analytics</h3>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.40)', margin: '0 0 24px' }}>
                  Real dashboards built for pastors. Track Sunday attendance trends, cell health scores, giving, and engagement — all in one view.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  'Attendance trends across weeks & months',
                  'Cell health scoring per group',
                  'First-timer tracking & follow-up rate',
                  'Giving summaries and donor history',
                ].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <CheckCircle2 style={{ width: 14, height: 14, color: '#C9A84C', flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.50)', lineHeight: 1.5 }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pillar 3 — Aquila Agent */}
            <div style={{ padding: '36px 32px', borderRadius: 24, background: 'linear-gradient(145deg, rgba(201,168,76,0.08) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(201,168,76,0.18)', display: 'flex', flexDirection: 'column', gap: 20, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 65%)', pointerEvents: 'none' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, rgba(201,168,76,0.30), rgba(201,168,76,0.14))', border: '1px solid rgba(201,168,76,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bot style={{ width: 20, height: 20, color: '#C9A84C' }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 99, background: 'rgba(201,168,76,0.14)', border: '1px solid rgba(201,168,76,0.24)', color: '#C9A84C' }}>AI-Powered</span>
              </div>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.94)', margin: '0 0 12px' }}>Aquila Agent</h3>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.40)', margin: '0 0 20px' }}>
                  Your AI ministry assistant. Ask questions, get insights, and take action — all in plain conversation. Powered by your church&apos;s own data.
                </p>
              </div>
              {/* Chat preview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 13, color: 'rgba(255,255,255,0.55)', fontStyle: 'italic' }}>
                  &ldquo;Who hasn&apos;t been to cell in 3 weeks?&rdquo;
                </div>
                <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.14)', fontSize: 13, color: 'rgba(255,248,220,0.70)', lineHeight: 1.55 }}>
                  6 members across 3 cells. Highest risk: James O., Priya N., and 4 others. Want me to draft follow-up messages?
                </div>
                <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 13, color: 'rgba(255,255,255,0.55)', fontStyle: 'italic' }}>
                  &ldquo;Yes — draft them.&rdquo;
                </div>
                <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.14)', fontSize: 13, color: 'rgba(255,248,220,0.70)', lineHeight: 1.55 }}>
                  Done. 6 personalized messages ready for your review. Each one references their last visit.
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Analytics deep-dive ── */}
      <section style={{ padding: '0 24px 100px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(201,168,76,0.60)', margin: '0 0 14px' }}>Live insight</p>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 700, letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.94)', margin: '0 0 16px' }}>
              Know what&apos;s really happening
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)', maxWidth: 500, margin: '0 auto', lineHeight: 1.65 }}>
              Stop guessing. Aquila turns attendance logs and cell reports into a clear picture of your church&apos;s health.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {[
              {
                icon: CalendarCheck,
                title: 'Service & Event Check-In',
                desc: 'Check members in from any device. Every tap builds your attendance record — no spreadsheets, no paper registers.',
                stat: '284', statLabel: 'last Sunday',
              },
              {
                icon: Users,
                title: 'People & Engagement Scores',
                desc: 'Every member gets an engagement score based on service attendance, cell attendance, and giving. Spot who\'s fading before it\'s too late.',
                stat: '94%', statLabel: 'retention this month',
              },
              {
                icon: AlertCircle,
                title: 'At-Risk Alerts',
                desc: 'Aquila flags members who are quietly disengaging — missing services, skipping cells, going silent. You get notified automatically.',
                stat: '4', statLabel: 'members flagged today',
              },
            ].map(({ icon: Icon, title, desc, stat, statLabel }) => (
              <div key={title} style={{ padding: '28px', borderRadius: 20, background: 'linear-gradient(145deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.015) 100%)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, rgba(201,168,76,0.20), rgba(201,168,76,0.08))', border: '1px solid rgba(201,168,76,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon style={{ width: 18, height: 18, color: '#C9A84C' }} />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.90)', margin: 0, lineHeight: 1 }}>{stat}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', margin: '4px 0 0' }}>{statLabel}</p>
                  </div>
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.88)', margin: '0 0 8px', letterSpacing: '-0.01em' }}>{title}</h3>
                  <p style={{ fontSize: 13, lineHeight: 1.65, color: 'rgba(255,255,255,0.38)', margin: 0 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.12), transparent)', maxWidth: 1120, margin: '0 auto', width: '100%' }} />

      {/* ── CTA ── */}
      <section style={{ padding: '100px 24px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', borderRadius: 28, padding: '80px 48px', textAlign: 'center', position: 'relative', overflow: 'hidden', background: 'linear-gradient(145deg, rgba(201,168,76,0.11) 0%, rgba(55,48,163,0.07) 50%, rgba(5,8,16,0.96) 100%)', border: '1px solid rgba(201,168,76,0.18)' }}>
          <div style={{ position: 'absolute', top: -100, left: '50%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.14) 0%, transparent 62%)', transform: 'translateX(-50%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
              <Image src="/Aquila Logo.png" width={72} height={72} alt="Aquila" />
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4.5vw, 48px)', fontWeight: 700, letterSpacing: '-0.038em', color: 'rgba(255,255,255,0.96)', margin: '0 0 18px', lineHeight: 1.08 }}>
              See your church clearly.
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.36)', maxWidth: 460, margin: '0 auto 44px', lineHeight: 1.65 }}>
              Know who&apos;s in every cell, every service, every week. Lead your congregation with data, not guesswork.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
              <Link href="/signup" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '15px 32px', borderRadius: 14, fontSize: 14, fontWeight: 600, background: 'linear-gradient(135deg,#A88A35,#C9A84C)', color: '#fff', textDecoration: 'none', boxShadow: '0 8px 32px rgba(201,168,76,0.42)' }}>
                Create your workspace — free <ArrowRight style={{ width: 15, height: 15 }} />
              </Link>
              <Link href="/pricing" style={{ padding: '15px 28px', borderRadius: 14, fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.40)', textDecoration: 'none' }}>
                See pricing →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.055)', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, maxWidth: 1120, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Image src="/Aquila Logo.png" width={24} height={24} alt="Aquila" />
          <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.32)', margin: 0 }}>Aquila</p>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.18)', margin: 0 }}>© 2026 Aquila · by Oasis PFCC</p>
      </footer>
    </div>
  )
}
