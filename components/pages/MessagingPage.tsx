'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MessageSquare, Send, Sparkles, RefreshCw, ArrowLeft,
  Check, X, Loader2, Plus, Search, Bot, Zap, Users,
  Edit3, Trash2, CheckCircle, AlertTriangle, ChevronDown,
  Flame, TrendingDown, Clock, UserCheck, Heart, Activity,
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { useUserProfile } from '@/lib/use-user-profile'
import type { FlaggedMember, EngagementFlag, FlagSection, RiskLevel } from '@/lib/engagement'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

// ─── Types ────────────────────────────────────────────────────────────────────

interface PendingDraft {
  id: string
  body: string
  tone: string | null
}

interface Conversation {
  id: string
  phone: string
  name: string
  status: string | null
  is_sensitive: boolean
  last_message_at: string | null
  attendee_id: string | null
  pending_draft: PendingDraft | null
}

interface Message {
  id: string
  conversation_id: string
  direction: 'inbound' | 'outbound'
  body: string
  ai_generated: boolean
  approved: boolean
  sent_at: string | null
  created_at: string
  tone: string | null
  pastoral_note: string | null
  is_sensitive: boolean
}

interface Recipient {
  attendee_id: string
  name: string
  phone: string
  generated_message: string
}

interface CampaignPreview {
  campaignName: string
  insight: string
  messageTemplate: string
  recipients: Recipient[]
}

interface Campaign {
  id: string
  name: string
  command: string
  status: 'draft' | 'approved' | 'sending' | 'sent' | 'failed'
  total_recipients: number
  sent_count: number
  created_at: string
}

type Tab = 'followup' | 'conversations' | 'campaigns'

// ─── Design tokens ────────────────────────────────────────────────────────────

const RISK_STYLE: Record<RiskLevel, { border: string; glow: string; badge: string; bg: string; text: string }> = {
  critical: { border: 'rgba(248,113,113,0.40)', glow: '0 0 24px rgba(248,113,113,0.18)', badge: '#f87171', bg: 'rgba(248,113,113,0.12)', text: 'CRITICAL' },
  high:     { border: 'rgba(251,146,60,0.35)',  glow: '0 0 20px rgba(251,146,60,0.14)',  badge: '#fb923c', bg: 'rgba(251,146,60,0.10)',  text: 'HIGH'     },
  medium:   { border: 'rgba(251,191,36,0.28)',  glow: '0 0 16px rgba(251,191,36,0.09)',  badge: '#fbbf24', bg: 'rgba(251,191,36,0.09)',  text: 'MEDIUM'   },
  low:      { border: 'rgba(96,165,250,0.22)',   glow: '0 0 12px rgba(96,165,250,0.07)', badge: '#60a5fa', bg: 'rgba(96,165,250,0.07)',  text: 'LOW'      },
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function GlassCard({ children, className = '', style = {} }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties
}) {
  return (
    <div className={className} style={{
      background: 'linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.022))',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, ...style,
    }}>
      {children}
    </div>
  )
}

function CampaignStatusBadge({ status }: { status: Campaign['status'] }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    draft:    { label: 'Draft',    color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
    approved: { label: 'Approved', color: '#34d399', bg: 'rgba(52,211,153,0.15)'  },
    sending:  { label: 'Sending',  color: '#fbbf24', bg: 'rgba(251,191,36,0.15)'  },
    sent:     { label: 'Sent',     color: '#818cf8', bg: 'rgba(129,140,248,0.15)' },
    failed:   { label: 'Failed',   color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
  }
  const s = map[status] ?? map.draft
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, color: s.color, background: s.bg }}>
      {s.label}
    </span>
  )
}

// ─── Follow-Up Tab Components ─────────────────────────────────────────────────

function AttRow({ label, history, color }: { label: string; history: boolean[]; color: string }) {
  if (history.length === 0) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.32)', width: 44, flexShrink: 0, letterSpacing: '0.02em' }}>
        {label}
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        {history.map((attended, i) => (
          <div
            key={i}
            title={i === 0 ? 'Most recent' : `${i + 1} meetings ago`}
            style={{
              width: 11, height: 11, borderRadius: 3,
              background: attended ? color : 'transparent',
              border: attended ? 'none' : '1.5px solid rgba(248,113,113,0.40)',
              opacity: attended ? (i === 0 ? 1 : 0.85) : 0.6,
            }}
          />
        ))}
      </div>
    </div>
  )
}

function FollowUpSendModal({ member, onClose }: { member: FlaggedMember; onClose: () => void }) {
  const [message, setMessage]   = useState('')
  const [loading, setLoading]   = useState(true)
  const [sending, setSending]   = useState(false)
  const [sent, setSent]         = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    fetch('/api/engagement/generate-followup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendee_id: member.id, flags: member.flags }),
    })
      .then(r => r.json())
      .then(d => { setMessage(d.message ?? ''); setLoading(false) })
      .catch(() => { setLoading(false) })
  }, [member.id, member.flags])

  async function send() {
    if (!message.trim() || !member.phone) return
    setSending(true); setError('')
    try {
      const res = await fetch('/api/messaging/new-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendee_id: member.id,
          name: member.name,
          phone: member.phone,
          body: message.trim(),
        }),
      })
      if (!res.ok) throw new Error('Failed to send')
      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
      setSending(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 460, background: 'linear-gradient(160deg, rgba(15,19,44,0.99) 0%, rgba(10,13,30,0.99) 100%)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 22, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.70)' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 14px rgba(99,102,241,0.40)' }}>
              <Sparkles style={{ width: 15, height: 15, color: '#fff' }} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.92)', lineHeight: 1.2 }}>AI Follow-Up</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>To: {member.name} · {member.phone}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.38)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {sent ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Check style={{ width: 24, height: 24, color: '#34d399' }} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.90)', marginBottom: 6 }}>Follow-Up Sent</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)', marginBottom: 22 }}>
              Your message to {member.name.split(' ')[0]} is on its way.
            </p>
            <button onClick={onClose} style={{ padding: '9px 24px', borderRadius: 10, fontSize: 13, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.70)', cursor: 'pointer' }}>
              Done
            </button>
          </div>
        ) : (
          <div style={{ padding: 20 }}>
            {/* Why we're following up */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {member.flags.map(f => (
                <span key={f.type} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(251,146,60,0.10)', border: '1px solid rgba(251,146,60,0.22)', color: '#fb923c', fontWeight: 500 }}>
                  {f.label}
                </span>
              ))}
            </div>

            {/* AI Draft */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Sparkles style={{ width: 11, height: 11, color: '#818cf8' }} />
                <span style={{ fontSize: 10, color: '#818cf8', fontWeight: 700, letterSpacing: '0.06em' }}>AI DRAFT</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>— edit before sending</span>
              </div>

              {loading ? (
                <div style={{ height: 90, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(129,140,248,0.15)', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(129,140,248,0.55)', display: 'inline-block', animation: 'bounce 1s infinite', animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              ) : (
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={4}
                  style={{ width: '100%', padding: '11px 13px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(129,140,248,0.22)', borderRadius: 11, color: 'rgba(255,255,255,0.86)', fontSize: 13, lineHeight: 1.6, outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 5 }}>
                <span style={{ fontSize: 10, color: message.length > 160 ? '#f87171' : 'rgba(255,255,255,0.25)' }}>
                  {message.length}/160
                </span>
              </div>
            </div>

            {error && <p style={{ fontSize: 12, color: '#f87171', marginBottom: 12 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.52)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={send}
                disabled={!message.trim() || sending || loading}
                style={{ flex: 2, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, background: message.trim() && !loading ? 'linear-gradient(135deg, #6366f1, #818cf8)' : 'rgba(255,255,255,0.06)', border: 'none', color: message.trim() && !loading ? '#fff' : 'rgba(255,255,255,0.28)', cursor: message.trim() && !loading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: message.trim() && !loading ? '0 0 18px rgba(99,102,241,0.38)' : 'none', transition: 'all 0.2s' }}
              >
                {sending ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Send style={{ width: 14, height: 14 }} />}
                {sending ? 'Sending…' : 'Send Follow-Up'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FlaggedMemberCard({ member, onSwitchToConversations }: {
  member: FlaggedMember
  onSwitchToConversations: () => void
}) {
  const rs = RISK_STYLE[member.risk_level]
  const [showModal, setShowModal] = useState(false)
  const firstName = member.name.split(' ')[0]

  const topFlag = member.flags[0]

  return (
    <>
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.050), rgba(255,255,255,0.018))',
        border: `1px solid ${rs.border}`,
        borderRadius: 16,
        boxShadow: rs.glow,
        overflow: 'hidden',
        transition: 'box-shadow 0.25s',
      }}>
        <div style={{ padding: '16px 16px 12px' }}>

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{
                width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                background: `linear-gradient(135deg, ${rs.badge}28, ${rs.badge}12)`,
                border: `1.5px solid ${rs.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, color: rs.badge,
              }}>
                {member.name.charAt(0)}
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.93)', marginBottom: 3 }}>{member.name}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.36)' }}>
                    {member.last_attended
                      ? `Last seen ${member.days_since_last}d ago`
                      : 'No recent record'}
                  </span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)' }}>·</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.36)' }}>
                    {member.total_attended} visit{member.total_attended !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
            <span style={{
              fontSize: 9, fontWeight: 800, padding: '4px 10px', borderRadius: 20,
              background: rs.bg, color: rs.badge, border: `1px solid ${rs.border}`,
              letterSpacing: '0.08em', flexShrink: 0,
            }}>
              {rs.text}
            </span>
          </div>

          {/* Flag chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
            {member.flags.map(f => (
              <span key={f.type} style={{
                fontSize: 11, padding: '3px 9px', borderRadius: 20,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)',
                color: 'rgba(255,255,255,0.62)',
              }}>
                {f.label}
              </span>
            ))}
          </div>

          {/* Attendance history dots */}
          {(member.sunday_history.length > 0 || member.midweek_history.length > 0 || member.cell_history.length > 0) && (
            <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.22)', borderRadius: 10, marginBottom: 14 }}>
              <AttRow label="Sunday"  history={member.sunday_history}  color="#34d399" />
              <AttRow label="Midweek" history={member.midweek_history} color="#60a5fa" />
              <AttRow label={member.home_cell || 'Cell'} history={member.cell_history} color="#a78bfa" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)' }}>← older</span>
                <div style={{ display: 'flex', gap: 10, fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: '#34d399', display: 'inline-block' }} />
                    attended
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, border: '1.5px solid rgba(248,113,113,0.40)', display: 'inline-block' }} />
                    missed
                  </span>
                </div>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', marginLeft: 'auto' }}>recent →</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {member.phone ? (
              <button
                onClick={() => setShowModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, fontSize: 12, fontWeight: 600, background: 'linear-gradient(135deg, #6366f1, #818cf8)', border: 'none', color: '#fff', cursor: 'pointer', boxShadow: '0 0 14px rgba(99,102,241,0.32)', transition: 'opacity 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <Sparkles style={{ width: 12, height: 12 }} />
                AI Follow-Up
              </button>
            ) : (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', display: 'flex', alignItems: 'center', padding: '8px 0' }}>
                No phone on file
              </span>
            )}
            <button
              onClick={onSwitchToConversations}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 9, fontSize: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.58)', cursor: 'pointer' }}
            >
              <MessageSquare style={{ width: 12, height: 12 }} />
              Conversations
            </button>
          </div>
        </div>
      </div>

      {showModal && <FollowUpSendModal member={member} onClose={() => setShowModal(false)} />}
    </>
  )
}

interface SectionConfig {
  id: FlagSection
  label: string
  icon: React.ReactNode
  color: string
  defaultOpen: boolean
}

const SECTIONS: SectionConfig[] = [
  { id: 'red_flag',       label: 'Red Flags',          icon: <Flame style={{ width: 14, height: 14 }} />,         color: '#f87171', defaultOpen: true  },
  { id: 'first_timer',    label: 'First Timers',        icon: <Heart style={{ width: 14, height: 14 }} />,         color: '#fbbf24', defaultOpen: true  },
  { id: 'missed_sunday',  label: 'Missed Last Sunday',  icon: <AlertTriangle style={{ width: 14, height: 14 }} />, color: '#60a5fa', defaultOpen: true  },
  { id: 'missed_midweek', label: 'Missing Midweek',     icon: <Clock style={{ width: 14, height: 14 }} />,         color: '#818cf8', defaultOpen: false },
  { id: 'missed_cell',    label: 'Missing Cell',        icon: <Users style={{ width: 14, height: 14 }} />,         color: '#a78bfa', defaultOpen: false },
  { id: 'inactive',       label: 'Going Inactive',      icon: <TrendingDown style={{ width: 14, height: 14 }} />,  color: '#fb923c', defaultOpen: false },
]

function EngagementSection({ config, members, onSwitchToConversations }: {
  config: SectionConfig
  members: FlaggedMember[]
  onSwitchToConversations: () => void
}) {
  const [open, setOpen] = useState(config.defaultOpen)
  if (members.length === 0) return null

  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '11px 2px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ color: config.color, display: 'flex', alignItems: 'center' }}>{config.icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: config.color }}>{config.label}</span>
        <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 20, background: `${config.color}18`, color: config.color, border: `1px solid ${config.color}30`, fontWeight: 700 }}>
          {members.length}
        </span>
        <span style={{ flex: 1 }} />
        <ChevronDown style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.28)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {open && (
        <div style={{ display: 'grid', gap: 10, paddingBottom: 16 }}>
          {members.map(m => (
            <FlaggedMemberCard key={m.id} member={m} onSwitchToConversations={onSwitchToConversations} />
          ))}
        </div>
      )}
    </div>
  )
}

function FollowUpTab({ onSwitchToConversations }: { onSwitchToConversations: () => void }) {
  const { profile, loading: profileLoading, isMaster } = useUserProfile()
  const [groups, setGroups]         = useState<{ id: string; name: string }[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [members, setMembers]       = useState<FlaggedMember[]>([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [refreshed, setRefreshed]   = useState<Date | null>(null)

  // Fetch group list for master selector
  useEffect(() => {
    if (!profileLoading && isMaster) {
      sb.from('groups').select('id, name').order('name').then(({ data }) => setGroups(data ?? []))
    }
  }, [profileLoading, isMaster])

  // Effective group: master picks one; group-role users use their assigned group
  const effectiveGroupId = isMaster ? selectedGroupId : (profile?.group_id ?? null)

  const load = useCallback(async () => {
    if (!effectiveGroupId) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/engagement/flags?groupId=${effectiveGroupId}`)
      if (!res.ok) throw new Error('Failed to load')
      setMembers(await res.json())
      setRefreshed(new Date())
    } catch {
      setError('Could not load engagement data.')
    } finally {
      setLoading(false)
    }
  }, [effectiveGroupId])

  useEffect(() => {
    if (!profileLoading) load()
  }, [load, profileLoading])

  // Bucket members into sections — red_flag members show only in that section
  const redFlags    = members.filter(m => m.sections.includes('red_flag'))
  const firstTimers = members.filter(m => m.sections.includes('first_timer') && !m.sections.includes('red_flag'))
  const missedSun   = members.filter(m => m.sections.includes('missed_sunday') && !m.sections.includes('red_flag'))
  const missedMid   = members.filter(m => m.sections.includes('missed_midweek') && !m.sections.includes('red_flag'))
  const missedCell  = members.filter(m => m.sections.includes('missed_cell') && !m.sections.includes('red_flag'))
  const inactive    = members.filter(m => m.sections.includes('inactive') && !m.sections.includes('red_flag'))

  const sectionData: Record<FlagSection, FlaggedMember[]> = {
    red_flag: redFlags, first_timer: firstTimers,
    missed_sunday: missedSun, missed_midweek: missedMid,
    missed_cell: missedCell, inactive: inactive,
  }

  const totalFlags = members.length

  const stats = [
    { label: 'Need Follow-Up', value: totalFlags,         color: '#818cf8', icon: <Activity style={{ width: 16, height: 16 }} /> },
    { label: 'Red Flags',      value: redFlags.length,    color: '#f87171', icon: <Flame style={{ width: 16, height: 16 }} /> },
    { label: 'First Timers',   value: firstTimers.length, color: '#fbbf24', icon: <Heart style={{ width: 16, height: 16 }} /> },
    { label: 'Going Inactive', value: inactive.length,    color: '#fb923c', icon: <TrendingDown style={{ width: 16, height: 16 }} /> },
  ]

  const selectedGroupName = groups.find(g => g.id === selectedGroupId)?.name

  return (
    <div>
      {/* Group selector — master only */}
      {isMaster && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.08em', marginBottom: 8 }}>
            SELECT GROUP
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {groups.map(g => {
              const active = g.id === selectedGroupId
              return (
                <button
                  key={g.id}
                  onClick={() => setSelectedGroupId(g.id)}
                  style={{
                    padding: '7px 16px', borderRadius: 20, fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer',
                    background: active ? 'linear-gradient(135deg, #6366f1, #818cf8)' : 'rgba(255,255,255,0.05)',
                    border: active ? 'none' : '1px solid rgba(255,255,255,0.10)',
                    color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                    boxShadow: active ? '0 0 14px rgba(99,102,241,0.30)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  {g.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* If master and no group chosen yet, show prompt */}
      {isMaster && !selectedGroupId ? (
        <GlassCard style={{ padding: 52, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 14 }}>👆</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.82)', marginBottom: 8 }}>Select a group above</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', maxWidth: 260, margin: '0 auto' }}>
            Choose a group to see who needs follow-up.
          </p>
        </GlassCard>
      ) : (
        <>
          {/* Stats bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
            {stats.map(s => (
              <div key={s.label} style={{ padding: '14px', borderRadius: 14, background: 'linear-gradient(135deg, rgba(255,255,255,0.050), rgba(255,255,255,0.018))', border: `1px solid ${s.color}22`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: s.color, opacity: 0.7 }}>{s.icon}</span>
                </div>
                <p style={{ fontSize: 26, fontWeight: 700, color: loading ? 'rgba(255,255,255,0.15)' : s.color, lineHeight: 1 }}>
                  {loading ? '—' : s.value}
                </p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', letterSpacing: '0.02em', lineHeight: 1.3 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)' }}>
              {loading ? 'Loading…' : refreshed
                ? `${selectedGroupName ? selectedGroupName + ' · ' : ''}Refreshed ${refreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : ''}
            </p>
            <button
              onClick={load}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', borderRadius: 9, fontSize: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.55)', cursor: 'pointer' }}
            >
              <RefreshCw style={{ width: 12, height: 12, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              Refresh
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ height: 100, borderRadius: 16, background: 'rgba(255,255,255,0.04)', animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }} />
              ))}
            </div>
          ) : error ? (
            <GlassCard style={{ padding: 32, textAlign: 'center' }}>
              <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</p>
              <button onClick={load} style={{ fontSize: 12, color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer' }}>Try again</button>
            </GlassCard>
          ) : totalFlags === 0 ? (
            <GlassCard style={{ padding: 52, textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 14 }}>✅</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.88)', marginBottom: 8 }}>All clear</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.40)', maxWidth: 260, margin: '0 auto' }}>
                No members need follow-up right now. Check back after the next service.
              </p>
            </GlassCard>
          ) : (
            <div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginBottom: 8 }} />
              {SECTIONS.map(sec => (
                <EngagementSection
                  key={sec.id}
                  config={sec}
                  members={sectionData[sec.id]}
                  onSwitchToConversations={onSwitchToConversations}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── New Message Modal ────────────────────────────────────────────────────────

interface Attendee { id: string; name: string; phone: string | null }

function NewMessageModal({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState<Attendee[]>([])
  const [selected, setSelected]     = useState<Attendee | null>(null)
  const [messageBody, setMessageBody] = useState('')
  const [sending, setSending]       = useState(false)
  const [error, setError]           = useState('')

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/people/search?q=${encodeURIComponent(query)}&hasPhone=true`)
      if (res.ok) setResults(await res.json())
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  async function send() {
    if (!selected?.phone || !messageBody.trim()) return
    setSending(true); setError('')
    try {
      const res = await fetch('/api/messaging/new-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendee_id: selected.id, name: selected.name, phone: selected.phone, body: messageBody }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      onSent()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setSending(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 440, background: 'linear-gradient(135deg, rgba(15,19,40,0.98), rgba(10,14,30,0.99))', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-3">
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus className="w-4 h-4 text-white" /></div>
            <span className="font-semibold text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>New Message</span>
          </div>
          <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>To</label>
            {selected ? (
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{selected.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>{selected.name}</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{selected.phone}</p>
                </div>
                <button onClick={() => { setSelected(null); setQuery('') }} style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name..." className="w-full text-sm outline-none" style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.85)' }} />
                {results.length > 0 && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 10, background: 'rgba(12,16,36,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                    {results.map(a => (
                      <button key={a.id} onClick={() => { setSelected(a); setQuery(''); setResults([]) }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)' }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(129,140,248,0.08)')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{a.name.charAt(0)}</div>
                        <div>
                          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{a.name}</p>
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{a.phone}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Message</label>
            <textarea value={messageBody} onChange={e => setMessageBody(e.target.value)} rows={4} placeholder="Type your message..." className="w-full text-sm outline-none resize-none" style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }} />
            <p style={{ fontSize: 11, color: messageBody.length > 160 ? '#f87171' : 'rgba(255,255,255,0.25)', textAlign: 'right', marginTop: 4 }}>{messageBody.length} / 160</p>
          </div>
          {error && <p style={{ fontSize: 12, color: '#f87171' }}>{error}</p>}
          <button onClick={send} disabled={!selected || !messageBody.trim() || sending} style={{ padding: 11, borderRadius: 10, fontSize: 14, fontWeight: 600, background: selected && messageBody.trim() ? 'linear-gradient(135deg, #6366f1, #818cf8)' : 'rgba(255,255,255,0.06)', border: 'none', color: selected && messageBody.trim() ? '#fff' : 'rgba(255,255,255,0.3)', cursor: selected && messageBody.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all 0.2s' }}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Message
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── AI Draft Card ────────────────────────────────────────────────────────────

const TONES = ['Warm', 'Encouraging', 'Pastoral', 'Direct'] as const

function AIDraftCard({
  message, conversationId,
  onApprove, onDiscard, onRegenerate,
}: {
  message: Message
  conversationId: string
  onApprove: (msg: Message, editedBody?: string) => Promise<void>
  onDiscard: (msg: Message) => Promise<void>
  onRegenerate: (msg: Message, tone?: string) => Promise<void>
}) {
  const [editing, setEditing]         = useState(false)
  const [editedBody, setEditedBody]   = useState(message.body)
  const [sending, setSending]         = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const activeTone = message.tone?.toLowerCase()

  async function approve() {
    setSending(true)
    try { await onApprove(message, editing ? editedBody : undefined) }
    finally { setSending(false) }
  }

  async function regen(tone?: string) {
    setRegenerating(true)
    try { await onRegenerate(message, tone) }
    finally { setRegenerating(false) }
  }

  function startEdit() {
    setEditing(true)
    setTimeout(() => textareaRef.current?.focus(), 40)
  }

  return (
    <div style={{ margin: '6px 0 4px', padding: '14px 16px', borderRadius: 16, border: '1px solid rgba(129,140,248,0.35)', background: 'linear-gradient(135deg, rgba(99,102,241,0.07), rgba(139,92,246,0.03))' }}>
      <div className="flex items-center gap-2 mb-3">
        <div style={{ width: 20, height: 20, borderRadius: 6, background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Sparkles className="w-2.5 h-2.5 text-white" />
        </div>
        <span style={{ fontSize: 11, color: '#818cf8', fontWeight: 700, letterSpacing: '0.05em' }}>AI DRAFT</span>
        {message.is_sensitive && (
          <span style={{ fontSize: 10, color: '#fbbf24', background: 'rgba(251,191,36,0.12)', padding: '2px 7px', borderRadius: 10, fontWeight: 600 }}>⚠ Sensitive</span>
        )}
        {message.pastoral_note && (
          <span style={{ fontSize: 10, color: '#34d399', background: 'rgba(52,211,153,0.10)', padding: '2px 7px', borderRadius: 10, fontWeight: 600 }}>Pastor note</span>
        )}
        <div className="flex-1" />
        <button onClick={() => onDiscard(message)} style={{ color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {message.pastoral_note && (
        <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.15)', marginBottom: 10 }}>
          <p style={{ fontSize: 11, color: 'rgba(52,211,153,0.85)', lineHeight: 1.5 }}>
            <span style={{ fontWeight: 600 }}>Pastoral note: </span>{message.pastoral_note}
          </p>
        </div>
      )}

      {editing ? (
        <div className="mb-3">
          <textarea ref={textareaRef} value={editedBody} onChange={e => setEditedBody(e.target.value)} rows={3} style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(129,140,248,0.30)', borderRadius: 8, color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 1.5, outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <button onClick={() => setEditing(false)} style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
            <span style={{ fontSize: 10, color: editedBody.length > 160 ? '#f87171' : 'rgba(255,255,255,0.3)' }}>{editedBody.length}/160</span>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)', lineHeight: 1.55, marginBottom: 12 }}>{message.body}</p>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={approve} disabled={sending} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'linear-gradient(135deg, #6366f1, #818cf8)', border: 'none', color: '#fff', cursor: 'pointer' }}>
          {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          {editing ? 'Send Edited' : 'Send'}
        </button>
        {!editing && (
          <button onClick={startEdit} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 11px', borderRadius: 8, fontSize: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)', cursor: 'pointer' }}>
            <Edit3 className="w-3 h-3" />Edit
          </button>
        )}
        <button onClick={() => regen()} disabled={regenerating} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 11px', borderRadius: 8, fontSize: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)', cursor: 'pointer' }}>
          {regenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}Regenerate
        </button>
        {TONES.map(tone => (
          <button key={tone} onClick={() => regen(tone.toLowerCase())} disabled={regenerating} style={{ padding: '4px 9px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: activeTone === tone.toLowerCase() ? 'rgba(129,140,248,0.20)' : 'rgba(255,255,255,0.05)', border: `1px solid ${activeTone === tone.toLowerCase() ? 'rgba(129,140,248,0.30)' : 'rgba(255,255,255,0.08)'}`, color: activeTone === tone.toLowerCase() ? '#818cf8' : 'rgba(255,255,255,0.40)', cursor: 'pointer' }}>
            {tone}
          </button>
        ))}
      </div>
    </div>
  )
}

function GeneratingSkeleton() {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 16, border: '1px solid rgba(129,140,248,0.20)', background: 'rgba(99,102,241,0.04)' }}>
      <div className="flex items-center gap-2 mb-3">
        <div style={{ width: 20, height: 20, borderRadius: 6, background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles className="w-2.5 h-2.5 text-white" />
        </div>
        <span style={{ fontSize: 11, color: '#818cf8', fontWeight: 700 }}>AI is writing a response…</span>
      </div>
      <div style={{ display: 'flex', gap: 5 }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(129,140,248,0.50)', display: 'inline-block', animation: 'bounce 1s infinite', animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )
}

// ─── Thread Detail ────────────────────────────────────────────────────────────

function ThreadDetail({ conv, onBack }: { conv: Conversation; onBack: () => void }) {
  const [messages, setMessages]         = useState<Message[]>([])
  const [loading, setLoading]           = useState(true)
  const [replyBody, setReplyBody]       = useState('')
  const [sending, setSending]           = useState(false)
  const [generatingDraft, setGeneratingDraft] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const threadMessages = messages.filter(m => m.approved || m.direction === 'inbound')
  const pendingDraft   = messages.find(m => m.ai_generated && !m.approved && m.direction === 'outbound') ?? null

  useEffect(() => {
    setLoading(true)
    sb.from('sms_messages')
      .select('*')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => { setMessages((data ?? []) as Message[]); setLoading(false) })

    const channel = sb
      .channel(`thread-${conv.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sms_messages', filter: `conversation_id=eq.${conv.id}` }, payload => {
        const msg = payload.new as Message
        setMessages(prev => [...prev, msg])
        if (!msg.approved && msg.ai_generated) setGeneratingDraft(false)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sms_messages', filter: `conversation_id=eq.${conv.id}` }, payload => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new as Message : m))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'sms_messages', filter: `conversation_id=eq.${conv.id}` }, payload => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id))
      })
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [conv.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    if (!pendingDraft) return
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') approveDraft(pendingDraft!)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingDraft])

  async function approveDraft(draft: Message, editedBody?: string) {
    await fetch(`/api/messaging/messages/${draft.id}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: editedBody }),
    })
  }

  async function discardDraft(draft: Message) {
    setMessages(prev => prev.filter(m => m.id !== draft.id))
    await fetch(`/api/messaging/messages/${draft.id}`, { method: 'DELETE' })
  }

  async function regenerateDraft(draft: Message, tone?: string) {
    setMessages(prev => prev.filter(m => m.id !== draft.id))
    setGeneratingDraft(true)
    await fetch(`/api/messaging/conversations/${conv.id}/regenerate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_id: draft.id, tone }),
    })
  }

  async function sendManualReply() {
    if (!replyBody.trim()) return
    setSending(true)
    try {
      await fetch(`/api/messaging/conversations/${conv.id}/reply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: replyBody }),
      })
      setReplyBody('')
    } finally { setSending(false) }
  }

  return (
    <div className="flex flex-col" style={{ height: 600 }}>
      <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}><ArrowLeft className="w-5 h-5" /></button>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: conv.is_sensitive ? 'linear-gradient(135deg, #f59e0b, #fbbf24)' : 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
          {conv.name?.charAt(0) ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>{conv.name}</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{conv.phone}</p>
        </div>
        {conv.is_sensitive && (
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(251,191,36,0.15)', color: '#fbbf24', flexShrink: 0 }}>Sensitive</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2" style={{ minHeight: 0 }}>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" style={{ color: '#818cf8' }} /></div>
        ) : threadMessages.length === 0 && !generatingDraft && !pendingDraft ? (
          <div className="flex-1 flex items-center justify-center">
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>No messages yet</p>
          </div>
        ) : (
          <>
            {threadMessages.map(m => (
              <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                <div style={{ maxWidth: '72%', padding: '10px 14px', borderRadius: m.direction === 'outbound' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: m.direction === 'outbound' ? 'linear-gradient(135deg, #6366f1, #818cf8)' : 'rgba(255,255,255,0.07)', color: m.direction === 'outbound' ? '#fff' : 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 1.5 }}>
                  {m.body}
                  {m.ai_generated && m.approved && <span style={{ display: 'block', fontSize: 10, opacity: 0.55, marginTop: 3 }}>AI-assisted</span>}
                  <span style={{ display: 'block', fontSize: 10, opacity: 0.4, marginTop: 2 }}>
                    {new Date(m.sent_at ?? m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
            {generatingDraft && !pendingDraft && <GeneratingSkeleton />}
            {pendingDraft && (
              <AIDraftCard message={pendingDraft} conversationId={conv.id} onApprove={approveDraft} onDiscard={discardDraft} onRegenerate={regenerateDraft} />
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 flex gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <input
          value={replyBody}
          onChange={e => setReplyBody(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendManualReply()}
          placeholder={pendingDraft ? 'Or type a manual reply...' : 'Type a reply...'}
          className="flex-1 text-sm outline-none"
          style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.85)' }}
        />
        <button onClick={sendManualReply} disabled={sending || !replyBody.trim()} style={{ width: 40, height: 40, borderRadius: 10, background: replyBody.trim() ? 'linear-gradient(135deg, #6366f1, #818cf8)' : 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', cursor: replyBody.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

// ─── Notifications ────────────────────────────────────────────────────────────

function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission()
}

function showNotif(name: string, body: string, onClick?: () => void) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const n = new Notification(`💬 ${name}`, { body: body.length > 120 ? body.slice(0, 117) + '...' : body, icon: '/favicon.ico', tag: 'oasis-sms' })
  if (onClick) n.onclick = () => { window.focus(); onClick() }
}

// ─── Conversations Tab ────────────────────────────────────────────────────────

function ConversationsTab() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected]           = useState<Conversation | null>(null)
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [showNew, setShowNew]             = useState(false)
  const [quickSending, setQuickSending]   = useState<string | null>(null)
  const convsRef = useRef<Conversation[]>([])

  async function loadConversations() {
    try {
      const res = await fetch('/api/messaging/conversations')
      if (res.ok) {
        const data: Conversation[] = await res.json()
        setConversations(data); convsRef.current = data
      }
    } catch (e) { console.error('[conversations]', e) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    requestNotifPermission()
    loadConversations()

    const channel = sb.channel('conversations-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => loadConversations())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sms_messages' }, payload => {
        const msg = payload.new as { id: string; conversation_id: string; direction: string; body: string; approved: boolean; ai_generated: boolean; tone: string | null }
        if (msg.direction === 'inbound') {
          const conv = convsRef.current.find(c => c.id === msg.conversation_id)
          showNotif(conv?.name ?? 'New message', msg.body, () => { if (conv) setSelected(conv) })
          loadConversations()
        } else if (!msg.approved && msg.ai_generated) {
          setConversations(prev => {
            const next = prev.map(c => c.id === msg.conversation_id ? { ...c, pending_draft: { id: msg.id, body: msg.body, tone: msg.tone } } : c)
            convsRef.current = next; return next
          })
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sms_messages' }, payload => {
        const msg = payload.new as { id: string; conversation_id: string; approved: boolean }
        if (msg.approved) {
          setConversations(prev => {
            const next = prev.map(c => c.pending_draft?.id === msg.id ? { ...c, pending_draft: null } : c)
            convsRef.current = next; return next
          })
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'sms_messages' }, payload => {
        const old = payload.old as { id: string }
        setConversations(prev => {
          const next = prev.map(c => c.pending_draft?.id === old.id ? { ...c, pending_draft: null } : c)
          convsRef.current = next; return next
        })
      })
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [])

  async function quickSend(conv: Conversation) {
    if (!conv.pending_draft) return
    setQuickSending(conv.id)
    try {
      await fetch(`/api/messaging/messages/${conv.pending_draft.id}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      })
    } finally { setQuickSending(null) }
  }

  const filtered = conversations.filter(c => {
    const q = search.toLowerCase()
    return c.name?.toLowerCase().includes(q) || c.phone?.includes(q)
  })

  if (selected) {
    return (
      <GlassCard style={{ overflow: 'hidden' }}>
        <ThreadDetail conv={selected} onBack={() => { setSelected(null); loadConversations() }} />
      </GlassCard>
    )
  }

  return (
    <div>
      {showNew && <NewMessageModal onClose={() => setShowNew(false)} onSent={() => { setShowNew(false); loadConversations() }} />}

      <div className="flex gap-3 mb-4">
        <div className="flex-1 flex items-center gap-2" style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10 }}>
          <Search className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations..." className="flex-1 bg-transparent outline-none text-sm" style={{ color: 'rgba(255,255,255,0.8)' }} />
        </div>
        <button onClick={() => setShowNew(true)} style={{ padding: '0 14px', height: 38, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #818cf8)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
          <Plus className="w-4 h-4" />New
        </button>
        <button onClick={loadConversations} style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: '#818cf8' }} /></div>
      ) : filtered.length === 0 ? (
        <GlassCard className="p-10 text-center">
          <MessageSquare className="w-8 h-8 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.2)' }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>No conversations yet</p>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 4 }}>Configure your Clearstream webhook to start receiving texts</p>
        </GlassCard>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(c => (
            <div key={c.id} style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.022))', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: c.pending_draft ? '1px solid rgba(129,140,248,0.3)' : '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
              <button onClick={() => setSelected(c)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: c.is_sensitive ? 'linear-gradient(135deg, #f59e0b, #fbbf24)' : 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {c.name?.charAt(0) ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>{c.name}</span>
                    {c.is_sensitive && <AlertTriangle className="w-3 h-3" style={{ color: '#fbbf24', flexShrink: 0 }} />}
                    {c.pending_draft && <span style={{ fontSize: 10, color: '#818cf8', background: 'rgba(129,140,248,0.15)', padding: '1px 7px', borderRadius: 10, fontWeight: 600, flexShrink: 0 }}>AI Draft</span>}
                  </div>
                  {c.pending_draft ? (
                    <p className="text-xs truncate" style={{ color: 'rgba(129,140,248,0.75)', marginTop: 2 }}>✦ {c.pending_draft.body}</p>
                  ) : (
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{c.phone}</p>
                  )}
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  {c.last_message_at && (
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                      {new Date(c.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </p>
                  )}
                </div>
              </button>

              {c.pending_draft && (
                <div className="flex items-center gap-2 px-4 pb-3" style={{ borderTop: '1px solid rgba(129,140,248,0.12)' }}>
                  <p className="flex-1 text-xs truncate" style={{ color: 'rgba(255,255,255,0.5)', paddingTop: 10 }}>{c.pending_draft.body}</p>
                  <div className="flex gap-2 flex-shrink-0" style={{ paddingTop: 8 }}>
                    <button onClick={() => quickSend(c)} disabled={quickSending === c.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'linear-gradient(135deg, #6366f1, #818cf8)', border: 'none', color: '#fff', cursor: 'pointer' }}>
                      {quickSending === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}Send
                    </button>
                    <button onClick={() => setSelected(c)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8, fontSize: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)', cursor: 'pointer' }}>
                      <Edit3 className="w-3 h-3" />Edit
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Campaigns Tab ────────────────────────────────────────────────────────────

function CommandBar({ onPreview }: { onPreview: (p: CampaignPreview) => void }) {
  const [command, setCommand] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const suggestions = [
    'Text everyone who missed last Sunday',
    'Follow up with new visitors from this month',
    'Check in with people absent 3+ weeks',
    'Send encouragement to youth group members',
  ]

  async function run() {
    if (!command.trim()) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/messaging/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Command failed')
      onPreview(data)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error') }
    finally { setLoading(false) }
  }

  return (
    <GlassCard className="p-5 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(99,102,241,0.4)' }}><Zap className="w-4 h-4 text-white" /></div>
        <div>
          <p className="font-semibold text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>AI Outreach Command</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Describe who to reach and what to say</p>
        </div>
      </div>
      <div className="flex gap-3">
        <input value={command} onChange={e => setCommand(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} placeholder="e.g. Text everyone who missed last Sunday..." className="flex-1 text-sm outline-none bg-transparent" style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.85)' }} />
        <button onClick={run} disabled={loading || !command.trim()} style={{ padding: '10px 18px', background: command.trim() ? 'linear-gradient(135deg, #6366f1, #818cf8)' : 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 10, color: command.trim() ? '#fff' : 'rgba(255,255,255,0.3)', cursor: command.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}Generate
        </button>
      </div>
      {error && <p className="mt-3 text-xs" style={{ color: '#f87171' }}>{error}</p>}
      <div className="flex flex-wrap gap-2 mt-3">
        {suggestions.map(s => (
          <button key={s} onClick={() => setCommand(s)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)', color: 'rgba(129,140,248,0.85)', cursor: 'pointer' }}>{s}</button>
        ))}
      </div>
    </GlassCard>
  )
}

function CampaignPreviewPanel({ preview, onSave, onDiscard }: { preview: CampaignPreview; onSave: () => void; onDiscard: () => void }) {
  const [recipients, setRecipients] = useState(preview.recipients)
  const [saving, setSaving]         = useState(false)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editVal, setEditVal]       = useState('')

  async function handleSave() {
    setSaving(true)
    try {
      await fetch('/api/messaging/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: preview.campaignName, command: preview.insight, messageTemplate: preview.messageTemplate, recipients }) })
      onSave()
    } finally { setSaving(false) }
  }

  return (
    <GlassCard className="mb-6">
      <div className="p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-1" style={{ color: 'rgba(255,255,255,0.9)' }}>{preview.campaignName}</h3>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{preview.insight}</p>
          </div>
          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(129,140,248,0.15)', color: '#818cf8', flexShrink: 0 }}>{recipients.length} recipients</span>
        </div>
        <div className="p-3 rounded-xl text-xs" style={{ background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.15)', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
          <span style={{ color: '#818cf8', fontWeight: 600 }}>Template: </span>{preview.messageTemplate}
        </div>
      </div>
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {recipients.map((rec, idx) => (
          <div key={rec.attendee_id} className="p-4 flex items-start gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{rec.name.charAt(0)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>{rec.name}</span>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{rec.phone}</span>
              </div>
              {editingIdx === idx ? (
                <div className="flex gap-2">
                  <textarea value={editVal} onChange={e => setEditVal(e.target.value)} rows={2} className="flex-1 text-xs outline-none resize-none" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(129,140,248,0.3)', borderRadius: 8, padding: '6px 8px', color: 'rgba(255,255,255,0.8)' }} />
                  <div className="flex flex-col gap-1">
                    <button onClick={() => { setRecipients(r => r.map((x, i) => i === idx ? { ...x, generated_message: editVal } : x)); setEditingIdx(null) }} style={{ color: '#34d399', cursor: 'pointer', background: 'none', border: 'none' }}><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditingIdx(null)} style={{ color: '#94a3b8', cursor: 'pointer', background: 'none', border: 'none' }}><X className="w-4 h-4" /></button>
                  </div>
                </div>
              ) : (
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{rec.generated_message}</p>
              )}
            </div>
            {editingIdx !== idx && (
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => { setEditingIdx(idx); setEditVal(rec.generated_message) }} style={{ color: '#94a3b8', cursor: 'pointer', background: 'none', border: 'none', padding: 2 }}><Edit3 className="w-3.5 h-3.5" /></button>
                <button onClick={() => setRecipients(r => r.filter((_, i) => i !== idx))} style={{ color: '#f87171', cursor: 'pointer', background: 'none', border: 'none', padding: 2 }}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="p-4 flex justify-end gap-3">
        <button onClick={onDiscard} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>Discard</button>
        <button onClick={handleSave} disabled={saving || recipients.length === 0} style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg, #6366f1, #818cf8)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Save Campaign
        </button>
      </div>
    </GlassCard>
  )
}

function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading]     = useState(true)
  const [preview, setPreview]     = useState<CampaignPreview | null>(null)
  const [sending, setSending]     = useState<string | null>(null)

  async function load() {
    try {
      const res = await fetch('/api/messaging/campaigns')
      if (res.ok) setCampaigns(await res.json())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function launch(id: string) {
    setSending(id)
    try { await fetch(`/api/messaging/campaigns/${id}/send`, { method: 'POST' }); await load() }
    finally { setSending(null) }
  }

  return (
    <div>
      <CommandBar onPreview={setPreview} />
      {preview && <CampaignPreviewPanel preview={preview} onSave={() => { setPreview(null); load() }} onDiscard={() => setPreview(null)} />}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: '#818cf8' }} /></div>
      ) : campaigns.length === 0 ? (
        <GlassCard className="p-10 text-center">
          <Sparkles className="w-8 h-8 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.2)' }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>No campaigns yet</p>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 4 }}>Use the AI command bar above to create your first outreach</p>
        </GlassCard>
      ) : (
        <div className="flex flex-col gap-3">
          {campaigns.map(c => (
            <GlassCard key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>{c.name}</span>
                    <CampaignStatusBadge status={c.status} />
                  </div>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{c.command}</p>
                </div>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{new Date(c.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.35)' }} /><span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{c.total_recipients} recipients</span></div>
                {c.status === 'sent' && <div className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" style={{ color: '#34d399' }} /><span style={{ fontSize: 12, color: 'rgba(52,211,153,0.8)' }}>{c.sent_count} sent</span></div>}
                {(c.status === 'draft' || c.status === 'approved') && (
                  <button onClick={() => launch(c.id)} disabled={sending === c.id} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'linear-gradient(135deg, #6366f1, #818cf8)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                    {sending === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}Launch
                  </button>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MessagingPage() {
  const [tab, setTab] = useState<Tab>('followup')

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'followup',       label: 'Follow-Up',    icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'conversations',  label: 'Conversations', icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { id: 'campaigns',      label: 'Campaigns',     icon: <Sparkles className="w-3.5 h-3.5" /> },
  ]

  return (
    <div
      className="min-h-screen px-5 md:px-8 py-8"
      style={{ background: 'linear-gradient(180deg, rgba(10,14,35,0.95) 0%, rgba(8,12,26,0.98) 100%)' }}
    >
      <div className="max-w-3xl mx-auto">

        {/* Page header */}
        <div className="flex items-center gap-4 mb-8">
          <div style={{ width: 42, height: 42, borderRadius: 13, background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 22px rgba(99,102,241,0.42)' }}>
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'rgba(255,255,255,0.94)' }}>Ministry Engagement</h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
              AI-powered pastoral follow-up & relationship intelligence
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-7 p-1 w-fit" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 13 }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 9,
                fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer',
                background: tab === t.id
                  ? 'linear-gradient(135deg, rgba(99,102,241,0.28), rgba(129,140,248,0.18))'
                  : 'transparent',
                color: tab === t.id ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.42)',
                boxShadow: tab === t.id ? '0 0 0 1px rgba(129,140,248,0.22)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === 'followup'      && <FollowUpTab onSwitchToConversations={() => setTab('conversations')} />}
        {tab === 'conversations' && <ConversationsTab />}
        {tab === 'campaigns'     && <CampaignsTab />}
      </div>
    </div>
  )
}
