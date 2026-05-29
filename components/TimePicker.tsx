'use client'

import { ChevronDown } from 'lucide-react'

interface TimePickerProps {
  value: string          // "HH:MM" 24-hour
  onChange: (v: string) => void
  style?: React.CSSProperties
}

const HOURS   = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

function to24(h12: number, min: string, period: 'AM' | 'PM'): string {
  let h = h12
  if (period === 'AM' && h === 12) h = 0
  if (period === 'PM' && h !== 12) h += 12
  return `${String(h).padStart(2, '0')}:${min}`
}

function from24(value: string): { h12: number; min: string; period: 'AM' | 'PM' } {
  const [hStr, mStr] = value.split(':')
  const h24 = parseInt(hStr ?? '10', 10)
  const min = mStr ?? '00'
  const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 || 12
  return { h12, min, period }
}

const sel: React.CSSProperties = {
  appearance: 'none',
  background: 'var(--aq-elevated)',
  border: '0.5px solid var(--aq-border)',
  color: 'var(--aq-text-primary)',
  borderRadius: 10,
  padding: '9px 28px 9px 12px',
  fontSize: 14,
  outline: 'none',
  cursor: 'pointer',
  transition: 'border-color 0.15s',
}

export default function TimePicker({ value, onChange, style }: TimePickerProps) {
  const { h12, min, period } = from24(value)

  function setHour(h: number) { onChange(to24(h, min, period)) }
  function setMin(m: string)  { onChange(to24(h12, m, period)) }
  function setPeriod(p: 'AM' | 'PM') { onChange(to24(h12, min, p)) }

  const wrap: React.CSSProperties = { display: 'flex', gap: 6, ...style }
  const rel: React.CSSProperties  = { position: 'relative' }
  const icon: React.CSSProperties = { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--aq-text-tertiary)' }

  return (
    <div style={wrap}>
      {/* Hour */}
      <div style={rel}>
        <select value={h12} onChange={e => setHour(Number(e.target.value))} style={{ ...sel, width: 70 }}>
          {HOURS.map(h => <option key={h} value={h} style={{ background: 'var(--aq-base)' }}>{h}</option>)}
        </select>
        <ChevronDown size={12} style={icon} />
      </div>

      {/* Minute */}
      <div style={rel}>
        <select value={min} onChange={e => setMin(e.target.value)} style={{ ...sel, width: 68 }}>
          {MINUTES.map(m => <option key={m} value={m} style={{ background: 'var(--aq-base)' }}>{m}</option>)}
        </select>
        <ChevronDown size={12} style={icon} />
      </div>

      {/* AM/PM */}
      <div style={rel}>
        <select value={period} onChange={e => setPeriod(e.target.value as 'AM' | 'PM')} style={{ ...sel, width: 68 }}>
          <option value="AM" style={{ background: 'var(--aq-base)' }}>AM</option>
          <option value="PM" style={{ background: 'var(--aq-base)' }}>PM</option>
        </select>
        <ChevronDown size={12} style={icon} />
      </div>
    </div>
  )
}

/** Returns true if timeA (HH:MM) is before timeB */
export function timeBefore(a: string, b: string): boolean {
  return a < b
}

/** Adds minutes to a HH:MM time string */
export function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + mins
  const nh = Math.floor(total / 60) % 24
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}
