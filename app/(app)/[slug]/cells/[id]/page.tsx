'use client'

import { use, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { ArrowLeft, MapPin, Trash2 } from 'lucide-react'
import TimePicker from '@/components/TimePicker'

const CELL_COLORS = [
  '#6366f1', '#34d399', '#f59e0b', '#f472b6',
  '#38bdf8', '#a78bfa', '#fb923c', '#ef4444',
]
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface Person { id: string; first_name: string; last_name: string }

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(145deg, rgba(255,255,255,0.052) 0%, rgba(255,255,255,0.018) 100%)',
  backdropFilter: 'blur(32px) saturate(180%)',
  WebkitBackdropFilter: 'blur(32px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.065)',
  borderRadius: 20,
  boxShadow: '0 1px 0 rgba(255,255,255,0.07) inset, 0 16px 48px rgba(0,0,0,0.35)',
  padding: 24,
}

const inputBase: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.032)',
  border: '1px solid rgba(255,255,255,0.080)',
  color: 'rgba(255,255,255,0.88)',
  borderRadius: 12,
  padding: '10px 14px',
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  boxSizing: 'border-box',
}

const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500,
  color: 'rgba(255,255,255,0.45)', marginBottom: 6,
}

function focusIn(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = 'rgba(99,102,241,0.50)'
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.10)'
}
function focusOut(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.080)'
  e.currentTarget.style.boxShadow = 'none'
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelSt}>{label}</label>
      {children}
    </div>
  )
}

export default function CellDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: cellId } = use(params)
  const routeParams = useParams()
  const router = useRouter()
  const slug = routeParams?.slug as string

  const [churchId,    setChurchId]    = useState<string | null>(null)
  const [groups,      setGroups]      = useState<{ id: string; name: string }[]>([])
  const [loaded,      setLoaded]      = useState(false)
  const [name,        setName]        = useState('')
  const [groupId,     setGroupId]     = useState('')
  const [color,       setColor]       = useState('#6366f1')
  const [day,         setDay]         = useState<number>(3)
  const [time,        setTime]        = useState('19:00')
  const [location,    setLocation]    = useState('')
  const [saving,      setSaving]      = useState(false)
  const [deleting,    setDeleting]    = useState(false)

  // Leader
  const [leaderQuery, setLeaderQuery] = useState('')
  const [leaderId,    setLeaderId]    = useState<string | null>(null)
  const [leaderName,  setLeaderName]  = useState('')
  const [people,      setPeople]      = useState<Person[]>([])

  useEffect(() => {
    getSupabaseBrowser()
      .from('churches').select('id').eq('slug', slug).single()
      .then(({ data }) => {
        if (!data) return
        setChurchId(data.id)
        getSupabaseBrowser().from('groups').select('id, name').eq('church_id', data.id).order('name')
          .then(({ data: grps }) => setGroups(grps ?? []))
      })
  }, [slug])

  // Load cell
  useEffect(() => {
    if (!churchId) return
    fetch(`/api/cells?churchId=${churchId}`)
      .then(r => r.json())
      .then(d => {
        const cell = (d.cells ?? []).find((c: { id: string }) => c.id === cellId)
        if (!cell) return
        setName(cell.name)
        setColor(cell.color ?? '#6366f1')
        setDay(cell.meeting_day ?? 3)
        setTime(cell.meeting_time ?? '19:00')
        setLocation(cell.location ?? '')
        setGroupId(cell.group_id ?? '')
        setLeaderId(cell.leader_id ?? null)
        setLeaderName(cell.leader_name ?? '')
        setLeaderQuery(cell.leader_name ?? '')
        setLoaded(true)
      })
  }, [churchId, cellId])

  // Leader search
  useEffect(() => {
    if (!churchId || !leaderQuery.trim() || leaderName === leaderQuery) { setPeople([]); return }
    const t = setTimeout(() => {
      fetch(`/api/people/search?q=${encodeURIComponent(leaderQuery)}&churchId=${churchId}&limit=6`)
        .then(r => r.json())
        .then(d => setPeople(d.people ?? []))
    }, 250)
    return () => clearTimeout(t)
  }, [leaderQuery, churchId, leaderName])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!churchId || !name.trim()) return
    setSaving(true)
    await fetch(`/api/cells?id=${cellId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        churchId, name: name.trim(),
        groupId: groupId || null,
        leaderId, leaderName: leaderName || null,
        meetingDay: day, meetingTime: time,
        location: location.trim() || null, color,
      }),
    })
    setSaving(false)
    router.push(`/${slug}/cells`)
  }

  async function handleDelete() {
    if (!churchId) return
    if (!confirm(`Archive "${name}"? It will no longer appear in the cells list.`)) return
    setDeleting(true)
    await fetch(`/api/cells?id=${cellId}&churchId=${churchId}`, { method: 'DELETE' })
    router.push(`/${slug}/cells`)
  }

  if (!loaded) {
    return (
      <div className="min-h-screen px-6 py-8" style={{ maxWidth: 600, margin: '0 auto' }}>
        <div className="h-8 w-32 rounded-lg shimmer mb-8" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="h-64 rounded-2xl shimmer" style={{ background: 'rgba(255,255,255,0.04)' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen px-6 py-8" style={{ maxWidth: 600, margin: '0 auto' }}>

      {/* Back */}
      <Link href={`/${slug}/cells`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.40)', textDecoration: 'none', marginBottom: 24 }}
        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.40)')}
      >
        <ArrowLeft style={{ width: 14, height: 14 }} /> Cells
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 8px ${color}80` }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.022em', color: 'rgba(255,255,255,0.92)', margin: 0 }}>{name}</h1>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={cardStyle}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginBottom: 16, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Basic Info</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Cell Name">
              <input value={name} onChange={e => setName(e.target.value)} required
                style={inputBase} onFocus={focusIn} onBlur={focusOut} />
            </Field>
            <Field label="Group">
              <select value={groupId} onChange={e => setGroupId(e.target.value)}
                style={{ ...inputBase, colorScheme: 'dark', color: groupId ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.30)' }}
              >
                <option value="">No group</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </Field>

            <Field label="Color">
              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                {CELL_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: color === c ? '3px solid rgba(255,255,255,0.80)' : '2px solid transparent', transition: 'border 0.15s ease', outline: 'none' }}
                  />
                ))}
              </div>
            </Field>
          </div>
        </div>

        <div style={cardStyle}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginBottom: 16, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Leader</p>
          <div style={{ position: 'relative' }}>
            <label style={labelSt}>Cell Leader <span style={{ color: 'rgba(255,255,255,0.25)' }}>(optional)</span></label>
            <input value={leaderQuery}
              onChange={e => { setLeaderQuery(e.target.value); setLeaderId(null); setLeaderName('') }}
              placeholder="Search by name…" style={inputBase} autoComplete="off"
              onFocus={focusIn} onBlur={focusOut}
            />
            {people.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, borderRadius: 12, background: 'rgba(10,14,35,0.97)', border: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 16px 40px rgba(0,0,0,0.50)', zIndex: 20, overflow: 'hidden' }}>
                {people.map(p => (
                  <button key={p.id} type="button"
                    onClick={() => { setLeaderId(p.id); setLeaderName(`${p.first_name} ${p.last_name}`); setLeaderQuery(`${p.first_name} ${p.last_name}`); setPeople([]) }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 13, color: 'rgba(255,255,255,0.80)', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >{p.first_name} {p.last_name}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={cardStyle}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginBottom: 16, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Schedule</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Meeting Day">
              <div style={{ display: 'flex', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                {DAY_NAMES.map((d, i) => (
                  <button key={i} type="button" onClick={() => setDay(i)}
                    style={{ padding: '7px 12px', borderRadius: 10, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', transition: 'all 0.12s ease', background: day === i ? '#6366f1' : 'rgba(255,255,255,0.07)', color: day === i ? '#fff' : 'rgba(255,255,255,0.50)', boxShadow: day === i ? '0 2px 8px rgba(99,102,241,0.35)' : 'none' }}
                  >{d}</button>
                ))}
              </div>
            </Field>
            <Field label="Meeting Time">
              <TimePicker value={time} onChange={setTime} style={{ marginTop: 2 }} />
            </Field>
            <Field label="Location">
              <div style={{ position: 'relative' }}>
                <MapPin style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'rgba(255,255,255,0.28)', pointerEvents: 'none' }} />
                <input value={location} onChange={e => setLocation(e.target.value)}
                  placeholder="Address or room…"
                  style={{ ...inputBase, paddingLeft: 34 }}
                  onFocus={focusIn} onBlur={focusOut}
                />
              </div>
            </Field>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" disabled={saving || !name.trim()}
            style={{ flex: 1, padding: '13px 0', borderRadius: 14, fontSize: 14, fontWeight: 600, border: 'none', cursor: saving || !name.trim() ? 'not-allowed' : 'pointer', background: name.trim() ? 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)' : 'rgba(255,255,255,0.06)', color: name.trim() ? '#fff' : 'rgba(255,255,255,0.30)', boxShadow: name.trim() ? '0 4px 18px rgba(99,102,241,0.40)' : 'none' }}
          >{saving ? 'Saving…' : 'Save Changes'}</button>
          <button type="button" onClick={handleDelete} disabled={deleting}
            style={{ padding: '13px 16px', borderRadius: 14, fontSize: 14, cursor: 'pointer', background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.20)' } as React.CSSProperties}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.18)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.10)')}
          >
            <Trash2 style={{ width: 15, height: 15 }} />
          </button>
        </div>
      </form>
    </div>
  )
}
