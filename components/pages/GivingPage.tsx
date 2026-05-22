'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { DollarSign, Plus, Trash2, Search, ChevronDown, TrendingUp, Users, Calendar, X, Check, Link2 } from 'lucide-react'

interface Gift {
  id: string
  person_id: string | null
  person_name: string
  amount: number
  fund: string
  method: string
  given_at: string
  notes: string | null
}

interface Person { id: string; first_name: string; last_name: string }

const METHODS = ['cash', 'check', 'online', 'card', 'other'] as const
const METHOD_LABEL: Record<string, string> = { cash: 'Cash', check: 'Check', online: 'Online', card: 'Card', other: 'Other' }
const METHOD_COLOR: Record<string, string> = {
  cash: 'rgba(52,211,153,0.15)', check: 'rgba(251,191,36,0.15)',
  online: 'rgba(201,168,76,0.15)', card: 'rgba(96,165,250,0.15)', other: 'rgba(255,255,255,0.08)',
}
const METHOD_TEXT: Record<string, string> = {
  cash: '#34d399', check: '#fbbf24', online: '#C9A84C', card: '#60a5fa', other: 'rgba(255,255,255,0.45)',
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
function initials(name: string) {
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 13px', borderRadius: 10, fontSize: 13,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
  color: 'rgba(255,255,255,0.88)', outline: 'none', boxSizing: 'border-box',
}

export default function GivingPage() {
  const params = useParams()
  const slug = params?.slug as string

  const [churchId, setChurchId] = useState<string | null>(null)
  const [gifts, setGifts] = useState<Gift[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [fundFilter, setFundFilter] = useState('All')
  const [view, setView] = useState<'all' | 'by-person'>('all')
  const [showForm, setShowForm] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  // Form state
  const [fName, setFName] = useState('')
  const [fPersonId, setFPersonId] = useState<string | null>(null)
  const [fAmount, setFAmount] = useState('')
  const [fFund, setFFund] = useState('General')
  const [fMethod, setFMethod] = useState<typeof METHODS[number]>('cash')
  const [fDate, setFDate] = useState(new Date().toISOString().slice(0, 10))
  const [fNotes, setFNotes] = useState('')
  const [fSaving, setFSaving] = useState(false)
  const [fError, setFError] = useState('')
  const [personSearch, setPersonSearch] = useState('')
  const [showPersonDrop, setShowPersonDrop] = useState(false)

  useEffect(() => {
    if (!slug) return
    getSupabaseBrowser().from('churches').select('id').eq('slug', slug).single()
      .then(({ data }) => { if (data) setChurchId(data.id) })
  }, [slug])

  useEffect(() => {
    if (!churchId) return
    setLoading(true)
    Promise.all([
      fetch(`/api/giving?churchId=${churchId}`).then(r => r.json()),
      fetch(`/api/people/search?churchId=${churchId}&q=`).then(r => r.json()),
    ]).then(([gData, pData]) => {
      setGifts(gData.gifts ?? [])
      setPeople(pData.people ?? [])
    }).finally(() => setLoading(false))
  }, [churchId])

  const funds = useMemo(() => ['All', ...Array.from(new Set(gifts.map(g => g.fund)))], [gifts])

  const filtered = useMemo(() => gifts.filter(g => {
    if (fundFilter !== 'All' && g.fund !== fundFilter) return false
    if (search && !g.person_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [gifts, fundFilter, search])

  const totalGiven = useMemo(() => filtered.reduce((s, g) => s + g.amount, 0), [filtered])
  const uniqueGivers = useMemo(() => new Set(filtered.map(g => g.person_name)).size, [filtered])

  const byPerson = useMemo(() => {
    const map = new Map<string, { name: string; total: number; gifts: Gift[] }>()
    for (const g of filtered) {
      const key = g.person_id ?? g.person_name
      const e = map.get(key)
      if (e) { e.total += g.amount; e.gifts.push(g) }
      else map.set(key, { name: g.person_name, total: g.amount, gifts: [g] })
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [filtered])

  const filteredPeople = useMemo(() =>
    people.filter(p => `${p.first_name} ${p.last_name}`.toLowerCase().includes(personSearch.toLowerCase())).slice(0, 8),
    [people, personSearch]
  )

  async function submitGift(e: React.FormEvent) {
    e.preventDefault()
    if (!churchId || !fName || !fAmount) { setFError('Name and amount are required.'); return }
    setFError(''); setFSaving(true)
    try {
      const res = await fetch('/api/giving', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ churchId, personId: fPersonId, personName: fName, amount: fAmount, fund: fFund, method: fMethod, givenAt: fDate, notes: fNotes || null }),
      })
      const data = await res.json()
      if (!res.ok) { setFError(data.error ?? 'Failed to save'); return }
      setGifts(prev => [data.gift, ...prev])
      setShowForm(false)
      setFName(''); setFPersonId(null); setFAmount(''); setFFund('General')
      setFMethod('cash'); setFDate(new Date().toISOString().slice(0, 10)); setFNotes(''); setPersonSearch('')
    } finally { setFSaving(false) }
  }

  async function deleteGift(id: string) {
    if (!churchId) return
    await fetch(`/api/giving?id=${id}&churchId=${churchId}`, { method: 'DELETE' })
    setGifts(prev => prev.filter(g => g.id !== id))
  }

  function formatDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, fontFamily: 'var(--font-geist-sans, system-ui)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(52,211,153,0.20), rgba(16,185,129,0.10))', border: '1px solid rgba(52,211,153,0.22)' }}>
            <DollarSign style={{ width: 22, height: 22, color: '#34d399' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.94)', margin: 0, letterSpacing: '-0.02em' }}>Giving</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', margin: '2px 0 0' }}>Track and manage church giving records</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/give/${slug}`)
              setLinkCopied(true)
              setTimeout(() => setLinkCopied(false), 2000)
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 11, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: linkCopied ? '#34d399' : 'rgba(255,255,255,0.60)', transition: 'all 0.15s ease' }}
          >
            <Link2 style={{ width: 14, height: 14 }} /> {linkCopied ? 'Copied!' : 'Give Link'}
          </button>
          <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 11, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #A88A35, #C9A84C)', color: '#fff', boxShadow: '0 4px 14px rgba(201,168,76,0.35)' }}>
            <Plus style={{ width: 15, height: 15 }} /> Record Gift
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { icon: DollarSign, label: 'Total Given', value: fmt(totalGiven), color: '#34d399', bg: 'rgba(52,211,153,0.10)', border: 'rgba(52,211,153,0.18)' },
          { icon: Users, label: 'Unique Givers', value: uniqueGivers.toString(), color: '#C9A84C', bg: 'rgba(201,168,76,0.10)', border: 'rgba(201,168,76,0.18)' },
          { icon: TrendingUp, label: 'Avg per Gift', value: filtered.length ? fmt(totalGiven / filtered.length) : '$0', color: '#60a5fa', bg: 'rgba(96,165,250,0.10)', border: 'rgba(96,165,250,0.18)' },
          { icon: Calendar, label: 'Total Records', value: filtered.length.toString(), color: '#fbbf24', bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.18)' },
        ].map(s => (
          <div key={s.label} style={{ padding: '16px 18px', borderRadius: 16, background: s.bg, border: `1px solid ${s.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              <s.icon style={{ width: 14, height: 14, color: s.color }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{s.label}</span>
            </div>
            <p style={{ fontSize: 22, fontWeight: 700, color: s.color, margin: 0, letterSpacing: '-0.03em' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'rgba(255,255,255,0.28)', pointerEvents: 'none' }} />
          <input placeholder="Search by name…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: 36 }} />
        </div>
        <div style={{ position: 'relative' }}>
          <select value={fundFilter} onChange={e => setFundFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', paddingRight: 32, appearance: 'none', cursor: 'pointer' }}>
            {funds.map(f => <option key={f} value={f} style={{ background: '#0a0e23' }}>{f}</option>)}
          </select>
          <ChevronDown style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: 'rgba(255,255,255,0.35)', pointerEvents: 'none' }} />
        </div>
        <div style={{ display: 'flex', borderRadius: 10, padding: 3, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {(['all', 'by-person'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer', background: view === v ? 'rgba(201,168,76,0.22)' : 'transparent', color: view === v ? '#C9A84C' : 'rgba(255,255,255,0.38)' }}>
              {v === 'all' ? 'All Gifts' : 'By Person'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3,4].map(i => <div key={i} style={{ height: 58, borderRadius: 14, background: 'rgba(255,255,255,0.04)' }} />)}
        </div>
      ) : view === 'all' ? (
        filtered.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '64px 0', color: 'rgba(255,255,255,0.22)', fontSize: 13 }}>
            No gifts recorded yet — click <strong style={{ color: 'rgba(255,255,255,0.40)' }}>Record Gift</strong> to add one.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map(g => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.034)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(201,168,76,0.14)', fontSize: 12, fontWeight: 700, color: '#C9A84C' }}>
                  {initials(g.person_name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.88)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.person_name}</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.34)', margin: '2px 0 0' }}>{g.fund} · {formatDate(g.given_at)}</p>
                </div>
                <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: METHOD_COLOR[g.method], color: METHOD_TEXT[g.method], flexShrink: 0 }}>
                  {METHOD_LABEL[g.method]}
                </span>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#34d399', margin: 0, flexShrink: 0, minWidth: 72, textAlign: 'right' }}>{fmt(g.amount)}</p>
                <button onClick={() => deleteGift(g.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: 'rgba(255,255,255,0.18)', flexShrink: 0 }}>
                  <Trash2 style={{ width: 14, height: 14 }} />
                </button>
              </div>
            ))}
          </div>
        )
      ) : (
        byPerson.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '64px 0', color: 'rgba(255,255,255,0.22)', fontSize: 13 }}>No gifts found.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {byPerson.map(({ name, total, gifts: pg }) => (
              <details key={name} style={{ borderRadius: 14, background: 'rgba(255,255,255,0.034)', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <summary style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', cursor: 'pointer', listStyle: 'none' }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(201,168,76,0.14)', fontSize: 12, fontWeight: 700, color: '#C9A84C' }}>
                    {initials(name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.88)', margin: 0 }}>{name}</p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.34)', margin: '2px 0 0' }}>{pg.length} gift{pg.length !== 1 ? 's' : ''}</p>
                  </div>
                  <p style={{ fontSize: 18, fontWeight: 700, color: '#34d399', margin: 0 }}>{fmt(total)}</p>
                  <ChevronDown style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.28)', flexShrink: 0 }} />
                </summary>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '6px 16px 10px' }}>
                  {pg.map(g => (
                    <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', flex: 1 }}>{formatDate(g.given_at)} · {g.fund}</span>
                      <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: METHOD_COLOR[g.method], color: METHOD_TEXT[g.method] }}>{METHOD_LABEL[g.method]}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#34d399', minWidth: 70, textAlign: 'right' }}>{fmt(g.amount)}</span>
                      <button onClick={() => deleteGift(g.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'rgba(255,255,255,0.16)' }}>
                        <Trash2 style={{ width: 13, height: 13 }} />
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )
      )}

      {/* Record Gift Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}>
          <div style={{ width: '100%', maxWidth: 440, borderRadius: 24, background: 'linear-gradient(145deg, rgba(18,22,42,0.99), rgba(10,14,35,0.99))', border: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 32px 80px rgba(0,0,0,0.6)', padding: '28px 28px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.92)', margin: 0 }}>Record a Gift</h2>
              <button onClick={() => { setShowForm(false); setPersonSearch(''); setFName(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.32)', padding: 4 }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <form onSubmit={submitGift} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Person */}
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.40)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Person *</label>
                <input
                  placeholder="Search or type name…"
                  value={fPersonId ? fName : personSearch}
                  onChange={e => { setPersonSearch(e.target.value); setFName(e.target.value); setFPersonId(null); setShowPersonDrop(true) }}
                  onFocus={() => setShowPersonDrop(true)}
                  required style={inputStyle}
                />
                {showPersonDrop && filteredPeople.length > 0 && !fPersonId && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4, borderRadius: 12, background: 'rgba(15,19,40,0.99)', border: '1px solid rgba(255,255,255,0.10)', overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}>
                    {filteredPeople.map(p => (
                      <button key={p.id} type="button"
                        onClick={() => { const n = `${p.first_name} ${p.last_name}`; setFName(n); setFPersonId(p.id); setPersonSearch(n); setShowPersonDrop(false) }}
                        style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.78)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        {p.first_name} {p.last_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Amount */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.40)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Amount *</label>
                <input type="number" min="0.01" step="0.01" placeholder="0.00" value={fAmount} onChange={e => setFAmount(e.target.value)} required style={inputStyle} />
              </div>

              {/* Fund + Method */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.40)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fund</label>
                  <input placeholder="General" value={fFund} onChange={e => setFFund(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.40)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Method</label>
                  <select value={fMethod} onChange={e => setFMethod(e.target.value as typeof METHODS[number])} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
                    {METHODS.map(m => <option key={m} value={m} style={{ background: '#0a0e23' }}>{METHOD_LABEL[m]}</option>)}
                  </select>
                  <ChevronDown style={{ position: 'absolute', right: 10, bottom: 11, width: 13, height: 13, color: 'rgba(255,255,255,0.35)', pointerEvents: 'none' }} />
                </div>
              </div>

              {/* Date */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.40)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date</label>
                <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} style={inputStyle} />
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.40)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notes (optional)</label>
                <input placeholder="Memo, occasion…" value={fNotes} onChange={e => setFNotes(e.target.value)} style={inputStyle} />
              </div>

              {fError && <p style={{ fontSize: 12, color: '#f87171', margin: 0 }}>{fError}</p>}

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => { setShowForm(false); setPersonSearch(''); setFName('') }} style={{ flex: 1, padding: '12px 0', borderRadius: 11, fontSize: 13, fontWeight: 600, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.50)', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={fSaving} style={{ flex: 2, padding: '12px 0', borderRadius: 11, fontSize: 13, fontWeight: 600, border: 'none', cursor: fSaving ? 'not-allowed' : 'pointer', background: 'linear-gradient(135deg, #A88A35, #C9A84C)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: fSaving ? 0.65 : 1 }}>
                  {fSaving ? 'Saving…' : <><Check style={{ width: 14, height: 14 }} /> Save Gift</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
