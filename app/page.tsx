'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight, Bot, Grid3x3, BarChart3, TrendingUp, TrendingDown,
  Users, CalendarCheck, AlertCircle, CheckCircle2, ChevronRight,
  MapPin, Clock, UserCheck, MessageSquare, Zap, Eye, Activity,
} from 'lucide-react'

/* ─── Scroll-reveal hook ─────────────────────────────────── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

/* ─── Animated counter ──────────────────────────────────── */
function Counter({ to, suffix = '', duration = 1400 }: { to: number; suffix?: string; duration?: number }) {
  const [val, setVal] = useState(0)
  const started = useRef(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true
        const start = performance.now()
        const tick = (now: number) => {
          const p = Math.min((now - start) / duration, 1)
          const ease = 1 - Math.pow(1 - p, 3)
          setVal(Math.round(ease * to))
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
        obs.disconnect()
      }
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [to, duration])
  return <span ref={ref}>{val}{suffix}</span>
}

/* ─── Particles ─────────────────────────────────────────── */
const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  x: Math.round(Math.random() * 100),
  y: Math.round(Math.random() * 100),
  size: 1 + Math.round(Math.random() * 2),
  dur: 6 + Math.round(Math.random() * 10),
  delay: Math.round(Math.random() * 8),
  opacity: 0.12 + Math.round(Math.random() * 20) / 100,
}))

export default function LandingPage() {
  /* hero entrance */
  const [heroIn, setHeroIn] = useState(false)
  useEffect(() => { const t = setTimeout(() => setHeroIn(true), 80); return () => clearTimeout(t) }, [])

  /* animated bar chart on hero mockup */
  const [barsIn, setBarsIn] = useState(false)
  useEffect(() => { const t = setTimeout(() => setBarsIn(true), 700); return () => clearTimeout(t) }, [])

  /* scroll sections */
  const cellSec  = useInView()
  const msgSec   = useInView()
  const agentSec = useInView()
  const tileSec  = useInView()
  const ctaSec   = useInView()

  const fadeUp = (visible: boolean, delay = 0): React.CSSProperties => ({
    opacity:   visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(32px)',
    transition: `opacity 0.72s cubic-bezier(.22,1,.36,1) ${delay}ms, transform 0.72s cubic-bezier(.22,1,.36,1) ${delay}ms`,
  })

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      background: '#050810',
      fontFamily: 'var(--font-geist-sans, system-ui, sans-serif)',
      WebkitFontSmoothing: 'antialiased', color: 'rgba(255,255,255,0.88)',
      overflowX: 'hidden',
    }}>
      <style>{`
        @keyframes pulse-ring {
          0%   { opacity: 0.55; transform: translate(-50%,-50%) scale(1); }
          100% { opacity: 0;    transform: translate(-50%,-50%) scale(1.55); }
        }
        @keyframes float-slow {
          0%,100% { transform: translateY(0px) translateX(0px); }
          33%     { transform: translateY(-18px) translateX(8px); }
          66%     { transform: translateY(10px) translateX(-6px); }
        }
        @keyframes float-med {
          0%,100% { transform: translateY(0px) translateX(0px); }
          50%     { transform: translateY(-24px) translateX(12px); }
        }
        @keyframes orbit {
          from { transform: translate(-50%,-50%) rotate(0deg); }
          to   { transform: translate(-50%,-50%) rotate(360deg); }
        }
        @keyframes shimmer-gold {
          0%,100% { opacity: 0.7; }
          50%     { opacity: 1; }
        }
        @keyframes bar-grow {
          from { height: 0%; }
          to   { height: var(--h); }
        }
        @keyframes ping-dot {
          0%,100% { transform: scale(1); opacity: 1; }
          50%     { transform: scale(1.6); opacity: 0.5; }
        }
        @keyframes slide-chat {
          from { opacity: 0; transform: translateX(-10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes glow-pulse {
          0%,100% { box-shadow: 0 0 20px rgba(201,168,76,0.25); }
          50%     { box-shadow: 0 0 40px rgba(201,168,76,0.55); }
        }
        @keyframes particle-float {
          0%,100% { transform: translateY(0); opacity: var(--op); }
          50%     { transform: translateY(-20px); opacity: calc(var(--op) * 0.4); }
        }
        .ring-pulse { animation: pulse-ring 3.5s ease-out infinite; }
        .ring-delay  { animation: pulse-ring 3.5s ease-out 1.75s infinite; }
        .orb-1 { animation: float-slow 14s ease-in-out infinite; }
        .orb-2 { animation: float-med 10s ease-in-out 2s infinite; }
        .orb-3 { animation: float-slow 18s ease-in-out 5s infinite; }
        .glow-cta { animation: glow-pulse 3s ease-in-out infinite; }
        a { text-decoration: none; }
        button { font-family: inherit; }
      `}</style>

      {/* ── Navbar ── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(5,8,16,0.88)', backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', borderBottom: '1px solid rgba(255,255,255,0.055)', transition: 'background 0.3s' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Image src="/Aquila Logo.png" width={32} height={32} alt="Aquila" />
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.94)', margin: 0, lineHeight: 1 }}>Aquila</p>
              <p style={{ fontSize: 10, color: 'rgba(201,168,76,0.50)', letterSpacing: '0.07em', fontWeight: 500, margin: '3px 0 0', textTransform: 'uppercase' }}>by Oasis PFCC</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href="/pricing" style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.45)' }}>Pricing</Link>
            <Link href="/login"   style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.45)' }}>Sign in</Link>
            <Link href="/signup"  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg,#A88A35,#C9A84C)', color: '#fff', boxShadow: '0 4px 16px rgba(201,168,76,0.35)' }}>
              Get started <ArrowRight style={{ width: 13, height: 13 }} />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: '110px 24px 100px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>

        {/* Particle field */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
          {PARTICLES.map(p => (
            <div key={p.id} style={{
              position: 'absolute',
              left: `${p.x}%`, top: `${p.y}%`,
              width: p.size, height: p.size,
              borderRadius: '50%',
              background: '#C9A84C',
              // @ts-expect-error css var
              '--op': p.opacity,
              opacity: p.opacity,
              animation: `particle-float ${p.dur}s ease-in-out ${p.delay}s infinite`,
            }} />
          ))}
        </div>

        {/* Ambient orbs */}
        <div className="orb-1" style={{ position: 'absolute', top: -180, left: '15%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.10) 0%, transparent 62%)', pointerEvents: 'none' }} />
        <div className="orb-2" style={{ position: 'absolute', bottom: -100, right: '10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,127,196,0.10) 0%, transparent 62%)', pointerEvents: 'none' }} />

        {/* Pulse rings */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', pointerEvents: 'none', zIndex: 0 }}>
          {[320, 500, 680].map((s, i) => (
            <div key={s} style={{ position: 'absolute', width: s, height: s, borderRadius: '50%', border: `1px solid rgba(201,168,76,${0.07 - i * 0.018})`, transform: 'translate(-50%,-50%)' }} />
          ))}
          <div className="ring-pulse" style={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', border: '1px solid rgba(201,168,76,0.18)', transform: 'translate(-50%,-50%)' }} />
          <div className="ring-delay"  style={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', border: '1px solid rgba(201,168,76,0.10)', transform: 'translate(-50%,-50%)' }} />
        </div>

        {/* Badge */}
        <div style={{ position: 'relative', zIndex: 1, ...fadeUp(heroIn, 0) }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 100, marginBottom: 28, background: 'rgba(201,168,76,0.10)', border: '1px solid rgba(201,168,76,0.22)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#C9A84C' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A84C', boxShadow: '0 0 8px #C9A84C', animation: 'ping-dot 2s ease-in-out infinite' }} />
            Church Management Platform
          </div>
        </div>

        {/* Headline */}
        <h1 style={{ position: 'relative', zIndex: 1, fontSize: 'clamp(48px, 8vw, 92px)', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.01, margin: '0 0 26px', maxWidth: 820, color: 'rgba(255,255,255,0.97)', ...fadeUp(heroIn, 120) }}>
          See your church{' '}
          <span style={{ background: 'linear-gradient(135deg,#EDD06A 0%,#C9A84C 40%,#A88A35 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', animation: 'shimmer-gold 4s ease-in-out infinite' }}>clearly.</span>
        </h1>

        <p style={{ position: 'relative', zIndex: 1, fontSize: 'clamp(15px, 2vw, 20px)', lineHeight: 1.7, color: 'rgba(255,255,255,0.38)', maxWidth: 560, margin: '0 0 44px', ...fadeUp(heroIn, 220) }}>
          Track every cell meeting, every service, every member — and let your AI assistant surface who needs attention before anyone slips away.
        </p>

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginBottom: 80, ...fadeUp(heroIn, 320) }}>
          <Link href="/signup" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 28px', borderRadius: 14, fontSize: 14, fontWeight: 600, background: 'linear-gradient(135deg,#A88A35,#C9A84C)', color: '#fff', boxShadow: '0 8px 32px rgba(201,168,76,0.45)', transition: 'transform 0.18s ease, box-shadow 0.18s ease' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(201,168,76,0.60)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(201,168,76,0.45)' }}
          >
            Create your workspace — free <ArrowRight style={{ width: 15, height: 15 }} />
          </Link>
          <Link href="/login" style={{ display: 'flex', alignItems: 'center', padding: '14px 28px', borderRadius: 14, fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', transition: 'background 0.18s, color 0.18s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)' }}
          >
            Sign in to your workspace
          </Link>
        </div>

        {/* ── Dashboard mockup ── */}
        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 960, ...fadeUp(heroIn, 440) }}>
          {/* Glow behind mockup */}
          <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%)', width: '80%', height: '60%', background: 'radial-gradient(ellipse, rgba(201,168,76,0.12) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none' }} />

          <div style={{ borderRadius: 24, overflow: 'hidden', background: 'linear-gradient(145deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.018) 100%)', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 50px 120px rgba(0,0,0,0.65), 0 0 0 1px rgba(201,168,76,0.08)', transform: 'perspective(1600px) rotateX(2.5deg)', transformOrigin: 'top center', transition: 'transform 0.6s ease' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'perspective(1600px) rotateX(0deg)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'perspective(1600px) rotateX(2.5deg)' }}
          >
            {/* Title bar */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.025)' }}>
              {['#FF5F57','#FEBC2E','#28C840'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.8 }} />)}
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.22)', marginLeft: 8 }}>Aquila — BLW Oasis Dashboard</span>
            </div>

            {/* Stat cards */}
            <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              {[
                { label: 'Sunday Attendance', value: '284', change: '+18', up: true },
                { label: 'Active Cells',       value: '18/22', change: '82% health', up: true },
                { label: 'First-Timers',       value: '7',  change: '+3 this month', up: true },
                { label: 'At-Risk Members',    value: '4',  change: 'need follow-up', up: false },
              ].map((s, i) => (
                <div key={s.label} style={{ padding: '16px', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', opacity: heroIn ? 1 : 0, transform: heroIn ? 'translateY(0)' : 'translateY(12px)', transition: `opacity 0.5s ease ${600 + i * 80}ms, transform 0.5s ease ${600 + i * 80}ms` }}>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.32)', margin: '0 0 8px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</p>
                  <p style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.92)', margin: '0 0 6px', lineHeight: 1 }}>{s.value}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {s.up ? <TrendingUp style={{ width: 10, height: 10, color: '#4ADE80' }} /> : <AlertCircle style={{ width: 10, height: 10, color: '#FACC15' }} />}
                    <span style={{ fontSize: 10, color: s.up ? '#4ADE80' : '#FACC15', fontWeight: 600 }}>{s.change}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Animated bar chart */}
            <div style={{ padding: '0 24px 20px' }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 12px' }}>Attendance — Last 6 Weeks</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 64 }}>
                {[62,74,58,81,69,100].map((pct, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                    <div style={{ width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: 6, height: 52, overflow: 'hidden', display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{
                        width: '100%',
                        height: barsIn ? `${pct}%` : '0%',
                        background: i === 5 ? 'linear-gradient(180deg,#EDD06A,#A88A35)' : `rgba(201,168,76,${0.2 + pct/300})`,
                        borderRadius: 6,
                        transition: `height 0.9s cubic-bezier(.22,1,.36,1) ${300 + i * 90}ms`,
                      }} />
                    </div>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.20)' }}>{['W1','W2','W3','W4','W5','W6'][i]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cell cards */}
            <div style={{ padding: '0 24px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { name: 'Cell 4B — North', leader: 'Marcus O.',  pct: 91, status: 'healthy' },
                { name: 'Cell 7A — East',  leader: 'Priya N.',   pct: 63, status: 'watch'   },
                { name: 'Cell 2C — West',  leader: 'James K.',   pct: 85, status: 'healthy' },
                { name: 'Cell 9D — South', leader: 'Aisha M.',   pct: 38, status: 'alert'   },
              ].map((c, i) => (
                <div key={c.name} style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12, opacity: barsIn ? 1 : 0, transform: barsIn ? 'translateY(0)' : 'translateY(8px)', transition: `opacity 0.5s ease ${900 + i * 70}ms, transform 0.5s ease ${900 + i * 70}ms` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.78)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.26)', margin: 0 }}>{c.leader}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <div style={{ width: 44, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: barsIn ? `${c.pct}%` : '0%', borderRadius: 99, background: c.status === 'healthy' ? '#4ADE80' : c.status === 'watch' ? '#FACC15' : '#F87171', transition: `width 1s cubic-bezier(.22,1,.36,1) ${1100 + i * 80}ms` }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: c.status === 'healthy' ? '#4ADE80' : c.status === 'watch' ? '#FACC15' : '#F87171' }}>{c.pct}%</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Agent bar */}
            <div style={{ margin: '0 24px 24px', padding: '14px 18px', borderRadius: 14, background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.16)', display: 'flex', alignItems: 'center', gap: 12, opacity: barsIn ? 1 : 0, transition: 'opacity 0.6s ease 1400ms' }}>
              <Bot style={{ width: 15, height: 15, color: '#C9A84C', flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: 'rgba(255,248,220,0.62)', margin: 0, lineHeight: 1.5 }}>
                <span style={{ color: '#C9A84C', fontWeight: 600 }}>Aquila:</span>{' '}Cell 9D dropped 42% over 3 weeks. 4 members haven&apos;t attended any meeting this month — want me to draft follow-up messages?
              </p>
              <ChevronRight style={{ width: 13, height: 13, color: 'rgba(201,168,76,0.45)', flexShrink: 0 }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '36px 24px', background: 'rgba(255,255,255,0.015)' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, textAlign: 'center' }}>
          {[
            { num: 284, suffix: '+', label: 'Members tracked weekly' },
            { num: 22,  suffix: ' cells', label: 'Cells managed per church' },
            { num: 98,  suffix: '%', label: 'Follow-up completion rate' },
          ].map(s => (
            <div key={s.label}>
              <p style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 700, letterSpacing: '-0.04em', color: 'rgba(255,255,255,0.88)', margin: '0 0 6px', background: 'linear-gradient(135deg,#EDD06A,#C9A84C)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                <Counter to={s.num} suffix={s.suffix} />
              </p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.30)', margin: 0 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════ SECTION 1 — CELL ANALYTICS ═══════ */}
      <section style={{ padding: '120px 24px', position: 'relative', background: 'linear-gradient(180deg, #050810 0%, #070A16 100%)' }}>
        <div className="orb-3" style={{ position: 'absolute', top: '10%', right: '-8%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 62%)', pointerEvents: 'none' }} />
        <div ref={cellSec.ref} style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 72, alignItems: 'center' }}>

          <div style={fadeUp(cellSec.visible, 0)}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 99, background: 'rgba(201,168,76,0.10)', border: '1px solid rgba(201,168,76,0.20)', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 20 }}>
              <Grid3x3 style={{ width: 12, height: 12 }} /> Cell Analytics
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.95)', margin: '0 0 20px', lineHeight: 1.1 }}>
              Know exactly what&apos;s happening in every cell
            </h2>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.38)', lineHeight: 1.75, margin: '0 0 36px' }}>
              Most churches lose members silently — people stop coming and nobody notices for months. Aquila makes that impossible. Every meeting is logged, every absence tracked, and declining cells flagged before they collapse.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              {[
                { icon: CalendarCheck, title: 'Per-meeting attendance logs', desc: 'Mark each member present or absent at every cell meeting. Full history, searchable by person or by cell.' },
                { icon: Activity,      title: 'Cell health scoring',          desc: 'Each cell gets a health score based on attendance consistency. Scores update automatically after every meeting.' },
                { icon: Eye,           title: '3-week absence detection',     desc: 'Aquila flags anyone who has missed 3 or more consecutive cell meetings and surfaces them for follow-up.' },
                { icon: TrendingUp,    title: 'Trend analysis per cell',      desc: 'See attendance going up or down week-over-week. Spot growth and decline early, not after it\'s too late.' },
              ].map(({ icon: Icon, title, desc }, i) => (
                <div key={title} style={{ display: 'flex', gap: 14, opacity: cellSec.visible ? 1 : 0, transform: cellSec.visible ? 'translateY(0)' : 'translateY(20px)', transition: `opacity 0.6s ease ${200 + i * 80}ms, transform 0.6s ease ${200 + i * 80}ms` }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(201,168,76,0.10)', border: '1px solid rgba(201,168,76,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <Icon style={{ width: 15, height: 15, color: '#C9A84C' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)', margin: '0 0 4px' }}>{title}</p>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.36)', lineHeight: 1.65, margin: 0 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cell visuals */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, ...fadeUp(cellSec.visible, 160) }}>
            {/* Healthy cell */}
            <div style={{ padding: '22px', borderRadius: 22, background: 'linear-gradient(145deg, rgba(255,255,255,0.055), rgba(255,255,255,0.018))', border: '1px solid rgba(255,255,255,0.09)', transition: 'transform 0.25s ease, box-shadow 0.25s ease' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 20px 60px rgba(0,0,0,0.4)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.88)', margin: 0 }}>Cell 4B — North Zone</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', margin: '3px 0 0' }}>Leader: Marcus Okonkwo · Thursdays 7pm</p>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.24)', color: '#4ADE80' }}>Healthy</span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {[8,9,8,10,9,10].map((v, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ height: 48, background: 'rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'flex-end', marginBottom: 5 }}>
                      <div style={{ width: '100%', height: cellSec.visible ? `${(v/11)*100}%` : '0%', background: 'linear-gradient(180deg,rgba(74,222,128,0.75),rgba(74,222,128,0.35))', borderRadius: 8, transition: `height 0.8s cubic-bezier(.22,1,.36,1) ${400 + i * 60}ms` }} />
                    </div>
                    <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.22)' }}>W{i+1}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[{ label: 'Avg Attendance', value: '9.0/11' }, { label: 'Health Score', value: '91%' }, { label: 'Streak', value: '6 wks' }].map(s => (
                  <div key={s.label} style={{ padding: '10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', textAlign: 'center' }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.88)', margin: '0 0 3px' }}>{s.value}</p>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', margin: 0 }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Declining cell */}
            <div style={{ padding: '22px', borderRadius: 22, background: 'linear-gradient(145deg, rgba(248,113,113,0.07), rgba(255,255,255,0.015))', border: '1px solid rgba(248,113,113,0.20)', transition: 'transform 0.25s ease, box-shadow 0.25s ease' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 20px 60px rgba(0,0,0,0.4)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.88)', margin: 0 }}>Cell 9D — South Zone</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', margin: '3px 0 0' }}>Leader: Aisha Mitchell · Tuesdays 6:30pm</p>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.28)', color: '#F87171' }}>At Risk</span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {[10,9,7,5,4,3].map((v, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ height: 48, background: 'rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'flex-end', marginBottom: 5 }}>
                      <div style={{ width: '100%', height: cellSec.visible ? `${(v/11)*100}%` : '0%', background: `linear-gradient(180deg,rgba(248,113,113,${0.75 - i * 0.08}),rgba(248,113,113,0.30))`, borderRadius: 8, transition: `height 0.8s cubic-bezier(.22,1,.36,1) ${500 + i * 60}ms` }} />
                    </div>
                    <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.22)' }}>W{i+1}</span>
                  </div>
                ))}
              </div>
              <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.14)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertCircle style={{ width: 14, height: 14, color: '#F87171', flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: 'rgba(248,200,200,0.70)', margin: 0, lineHeight: 1.5 }}>
                  Attendance dropped from 10 → 3 in 6 weeks. 5 members haven&apos;t attended in 3+ weeks.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ SECTION 2 — MESSAGING & FOLLOW-UP ═══════ */}
      <section style={{ padding: '120px 24px', background: 'linear-gradient(180deg, #070A16 0%, #050810 100%)', position: 'relative' }}>
        <div className="orb-1" style={{ position: 'absolute', top: '20%', left: '-8%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,127,196,0.07) 0%, transparent 62%)', pointerEvents: 'none' }} />
        <div ref={msgSec.ref} style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 72, alignItems: 'center' }}>

          {/* Follow-up visuals */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, ...fadeUp(msgSec.visible, 0) }}>
            <div style={{ padding: '22px', borderRadius: 22, background: 'linear-gradient(145deg, rgba(201,168,76,0.07), rgba(255,255,255,0.015))', border: '1px solid rgba(201,168,76,0.16)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(201,168,76,0.16)', border: '1px solid rgba(201,168,76,0.24)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bot style={{ width: 14, height: 14, color: '#C9A84C' }} />
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#C9A84C', margin: 0 }}>Aquila drafted 3 follow-up messages</p>
              </div>
              {[
                { name: 'James Okonkwo', tag: 'First visit · Sun 4 Feb', msg: 'Hi James! It was great seeing you at Oasis last Sunday. We\'d love to have you back — our next service is this Sunday at 10am.' },
                { name: 'Priya Nair',    tag: 'Missed 4 cells · Cell 7A', msg: 'Hey Priya, we\'ve missed you at cell! Hope all is well. Our next meeting is Tuesday at 7pm — would love to see you there.' },
              ].map((m, i) => (
                <div key={m.name} style={{ padding: '14px', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', marginBottom: 10, opacity: msgSec.visible ? 1 : 0, transform: msgSec.visible ? 'translateX(0)' : 'translateX(-12px)', transition: `opacity 0.6s ease ${200 + i * 100}ms, transform 0.6s ease ${200 + i * 100}ms` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.82)', margin: 0 }}>{m.name}</p>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.20)', color: '#C9A84C', fontWeight: 600 }}>{m.tag}</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)', margin: '0 0 12px', lineHeight: 1.6 }}>&ldquo;{m.msg}&rdquo;</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ flex: 1, padding: '7px', borderRadius: 9, background: 'linear-gradient(135deg,#A88A35,#C9A84C)', border: 'none', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Send</button>
                    <button style={{ flex: 1, padding: '7px', borderRadius: 9, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.50)', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>Edit first</button>
                  </div>
                </div>
              ))}
            </div>

            {/* First-timer log */}
            <div style={{ padding: '18px 20px', borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 14px' }}>First-Timers This Month</p>
              {[
                { name: 'James Okonkwo', date: 'Feb 4',  status: 'Followed up' },
                { name: 'Maria Santos',   date: 'Feb 4',  status: 'Followed up' },
                { name: 'David Chen',     date: 'Feb 11', status: 'Pending'     },
                { name: 'Amara Diallo',   date: 'Feb 11', status: 'Pending'     },
              ].map((p, i) => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: msgSec.visible ? 1 : 0, transition: `opacity 0.5s ease ${400 + i * 80}ms` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#C9A84C' }}>{p.name[0]}</div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.78)', margin: 0 }}>{p.name}</p>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', margin: 0 }}>First visit {p.date}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: p.status === 'Followed up' ? 'rgba(74,222,128,0.10)' : 'rgba(250,204,21,0.10)', border: `1px solid ${p.status === 'Followed up' ? 'rgba(74,222,128,0.22)' : 'rgba(250,204,21,0.22)'}`, color: p.status === 'Followed up' ? '#4ADE80' : '#FACC15' }}>{p.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={fadeUp(msgSec.visible, 160)}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 99, background: 'rgba(201,168,76,0.10)', border: '1px solid rgba(201,168,76,0.20)', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 20 }}>
              <MessageSquare style={{ width: 12, height: 12 }} /> Follow-Up System
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.95)', margin: '0 0 20px', lineHeight: 1.1 }}>
              No first-timer falls through the cracks
            </h2>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.38)', lineHeight: 1.75, margin: '0 0 36px' }}>
              When someone visits for the first time, Aquila registers them and immediately drafts a personalized follow-up message. You review, edit if needed, and send — in under a minute.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              {[
                { icon: UserCheck,    title: 'Auto-detect first-timers',        desc: 'When a new person is checked in at a service, Aquila flags them and adds them to your follow-up queue.' },
                { icon: Bot,          title: 'AI-drafted personalized messages', desc: 'Aquila writes using the person\'s name, service they attended, and context from your church. Not a template — a real message.' },
                { icon: CheckCircle2, title: 'You approve before it sends',      desc: 'Every message goes to you for review first. Edit it, send it as-is, or dismiss it. You stay in control.' },
                { icon: Zap,          title: 'Cell follow-up, not just services',desc: '3 missed meetings? Aquila drafts a check-in message and alerts the cell leader — automatically.' },
              ].map(({ icon: Icon, title, desc }, i) => (
                <div key={title} style={{ display: 'flex', gap: 14, opacity: msgSec.visible ? 1 : 0, transform: msgSec.visible ? 'translateY(0)' : 'translateY(16px)', transition: `opacity 0.6s ease ${280 + i * 80}ms, transform 0.6s ease ${280 + i * 80}ms` }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(201,168,76,0.10)', border: '1px solid rgba(201,168,76,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <Icon style={{ width: 15, height: 15, color: '#C9A84C' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)', margin: '0 0 4px' }}>{title}</p>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.36)', lineHeight: 1.65, margin: 0 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ SECTION 3 — AQUILA AGENT ═══════ */}
      <section style={{ padding: '120px 24px', background: 'linear-gradient(180deg, #050810 0%, #070A16 100%)', position: 'relative' }}>
        <div className="orb-2" style={{ position: 'absolute', top: '15%', right: '-5%', width: 650, height: 650, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.07) 0%, transparent 62%)', pointerEvents: 'none' }} />
        <div ref={agentSec.ref} style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 72, alignItems: 'center' }}>

          <div style={fadeUp(agentSec.visible, 0)}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 99, background: 'rgba(201,168,76,0.10)', border: '1px solid rgba(201,168,76,0.20)', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 20 }}>
              <Bot style={{ width: 12, height: 12 }} /> Aquila Agent · AI-Powered
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.95)', margin: '0 0 20px', lineHeight: 1.1 }}>
              Ask anything. Get answers instantly.
            </h2>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.38)', lineHeight: 1.75, margin: '0 0 36px' }}>
              Aquila Agent is trained on your church&apos;s live data — members, attendance, cells, giving. Ask it questions in plain English and get instant, specific answers. No reports to run, no spreadsheets to open.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                '"Who hasn\'t been to cell in the last 3 weeks?"',
                '"Which cells are declining this month?"',
                '"Give me a summary of last Sunday\'s service."',
                '"Who are our most engaged members right now?"',
                '"Draft a follow-up for everyone who visited in January."',
              ].map((q, i) => (
                <div key={q} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', cursor: 'default', opacity: agentSec.visible ? 1 : 0, transform: agentSec.visible ? 'translateX(0)' : 'translateX(-12px)', transition: `opacity 0.55s ease ${200 + i * 70}ms, transform 0.55s ease ${200 + i * 70}ms` }}>
                  <ChevronRight style={{ width: 13, height: 13, color: 'rgba(201,168,76,0.50)', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.50)', fontStyle: 'italic' }}>{q}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Agent chat */}
          <div style={{ padding: '26px', borderRadius: 26, background: 'linear-gradient(145deg, rgba(201,168,76,0.07), rgba(255,255,255,0.018))', border: '1px solid rgba(201,168,76,0.16)', display: 'flex', flexDirection: 'column', gap: 12, ...fadeUp(agentSec.visible, 160) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(201,168,76,0.18)', border: '1px solid rgba(201,168,76,0.26)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'glow-pulse 3s ease-in-out infinite' }}>
                <Bot style={{ width: 16, height: 16, color: '#C9A84C' }} />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.82)', margin: 0 }}>Aquila Agent</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', margin: 0 }}>Connected to your church data</p>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ADE80', boxShadow: '0 0 8px #4ADE80', animation: 'ping-dot 2.5s ease-in-out infinite' }} />
                <span style={{ fontSize: 10, color: '#4ADE80', fontWeight: 600 }}>Live</span>
              </div>
            </div>

            {[
              { role: 'user',  msg: 'Which cells are at risk right now?' },
              { role: 'agent', msg: '2 cells need attention: Cell 9D (South) dropped from 10 to 3 members attending over 6 weeks — a 70% decline. Cell 7A (East) is at 63% health, down from 88% last month. Want me to pull the member list for both?' },
              { role: 'user',  msg: 'Yes, and flag the ones who haven\'t been in 3 weeks.' },
              { role: 'agent', msg: 'Done. 9 members flagged across both cells. Top priority: James O., Priya N., Daniel W. (Cell 9D — all 4+ weeks absent). I\'ve drafted follow-up messages for each. Ready to review?' },
            ].map((m, i) => (
              <div key={i} style={{
                padding: '12px 14px', borderRadius: 14,
                background: m.role === 'user' ? 'rgba(255,255,255,0.06)' : 'rgba(201,168,76,0.09)',
                border: `1px solid ${m.role === 'user' ? 'rgba(255,255,255,0.09)' : 'rgba(201,168,76,0.16)'}`,
                fontSize: 13, lineHeight: 1.65,
                color: m.role === 'user' ? 'rgba(255,255,255,0.58)' : 'rgba(255,248,220,0.75)',
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '92%',
                opacity: agentSec.visible ? 1 : 0,
                transform: agentSec.visible ? 'translateY(0)' : 'translateY(10px)',
                transition: `opacity 0.55s ease ${400 + i * 120}ms, transform 0.55s ease ${400 + i * 120}ms`,
              }}>
                {m.msg}
              </div>
            ))}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, padding: '11px 14px', borderRadius: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.20)', flex: 1 }}>Ask Aquila anything…</span>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,#A88A35,#C9A84C)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ArrowRight style={{ width: 13, height: 13, color: '#fff' }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ SECTION 4 — PLATFORM TILES ═══════ */}
      <section style={{ padding: '80px 24px 100px' }}>
        <div ref={tileSec.ref} style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56, ...fadeUp(tileSec.visible, 0) }}>
            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 38px)', fontWeight: 700, letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.94)', margin: '0 0 14px' }}>Everything else, built in</h2>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.32)', margin: 0, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>Every tool your pastoral team needs, in one place.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {[
              { icon: CalendarCheck, title: 'Service Check-In',  desc: 'Check members in at any service from any device. Attendance logged instantly.' },
              { icon: Users,         title: 'People Management', desc: 'Full profiles with contact info, giving history, attendance records, and group memberships.' },
              { icon: BarChart3,     title: 'Giving & Reports',  desc: 'Track offerings per fund, per member. Export reports for your finance team.' },
              { icon: Clock,         title: 'Event Calendar',    desc: 'All services, cells, and gatherings in one calendar. Plan and schedule everything in one place.' },
              { icon: Activity,      title: 'Engagement Scores', desc: 'Each member gets a score based on service attendance, cell attendance, and giving consistency.' },
              { icon: TrendingDown,  title: 'At-Risk Alerts',    desc: 'Aquila flags members quietly disengaging before they leave. Act while you still can.' },
            ].map(({ icon: Icon, title, desc }, i) => (
              <div key={title} style={{ padding: '22px', borderRadius: 20, background: 'rgba(255,255,255,0.033)', border: '1px solid rgba(255,255,255,0.065)', display: 'flex', flexDirection: 'column', gap: 12, opacity: tileSec.visible ? 1 : 0, transform: tileSec.visible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.97)', transition: `opacity 0.6s ease ${100 + i * 70}ms, transform 0.6s cubic-bezier(.22,1,.36,1) ${100 + i * 70}ms`, cursor: 'default' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(201,168,76,0.06)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(201,168,76,0.18)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.033)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.065)' }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon style={{ width: 16, height: 16, color: '#C9A84C' }} />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)', margin: '0 0 6px' }}>{title}</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.34)', lineHeight: 1.65, margin: 0 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '0 24px 100px' }}>
        <div ref={ctaSec.ref} style={{ maxWidth: 880, margin: '0 auto', borderRadius: 32, padding: '90px 48px', textAlign: 'center', position: 'relative', overflow: 'hidden', background: 'linear-gradient(145deg, rgba(201,168,76,0.11) 0%, rgba(55,48,163,0.07) 50%, rgba(5,8,16,0.96) 100%)', border: '1px solid rgba(201,168,76,0.18)', ...fadeUp(ctaSec.visible, 0) }}>
          <div style={{ position: 'absolute', top: -120, left: '50%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.15) 0%, transparent 60%)', transform: 'translateX(-50%)', pointerEvents: 'none' }} />
          <div className="orb-1" style={{ position: 'absolute', bottom: -100, right: -80, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,127,196,0.10) 0%, transparent 65%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
              <Image src="/Aquila Logo.png" width={80} height={80} alt="Aquila" style={{ filter: 'drop-shadow(0 0 24px rgba(201,168,76,0.40))' }} />
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4.5vw, 52px)', fontWeight: 700, letterSpacing: '-0.04em', color: 'rgba(255,255,255,0.96)', margin: '0 0 18px', lineHeight: 1.06 }}>
              See your church clearly.
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.34)', maxWidth: 480, margin: '0 auto 48px', lineHeight: 1.7 }}>
              Know who&apos;s in every cell, every service, every week. Lead with data, not guesswork.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
              <Link href="/signup" className="glow-cta" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '15px 32px', borderRadius: 14, fontSize: 14, fontWeight: 600, background: 'linear-gradient(135deg,#A88A35,#C9A84C)', color: '#fff', boxShadow: '0 8px 32px rgba(201,168,76,0.42)', transition: 'transform 0.18s ease' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
              >
                Create your workspace — free <ArrowRight style={{ width: 15, height: 15 }} />
              </Link>
              <Link href="/pricing" style={{ padding: '15px 28px', borderRadius: 14, fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.38)', transition: 'color 0.18s' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.38)' }}
              >
                See pricing →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, maxWidth: 1120, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Image src="/Aquila Logo.png" width={24} height={24} alt="Aquila" />
          <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.28)', margin: 0 }}>Aquila</p>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.16)', margin: 0 }}>© 2026 Aquila · by Oasis PFCC</p>
      </footer>
    </div>
  )
}
