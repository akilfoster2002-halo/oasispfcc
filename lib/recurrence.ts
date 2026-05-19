export type RepeatType   = 'none' | 'daily' | 'weekly' | 'monthly'
export type EndType      = 'never' | 'on_date' | 'after_count'
export type MonthlyType  = 'day_of_month' | 'day_of_week'

export interface RecurrenceRule {
  type:         RepeatType
  interval:     number       // every N days/weeks/months
  days:         string[]     // weekly only: ['SUN','MON','WED',...]
  monthlyType:  MonthlyType
  endType:      EndType
  endDate:      string       // YYYY-MM-DD
  endCount:     number
}

const DAY_NUMS: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
}
const DAY_ABBREVS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_KEYS    = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const ORDINALS    = ['', '1st', '2nd', '3rd', '4th', '5th']

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d)
  const targetDay = r.getDate()
  r.setMonth(r.getMonth() + n, 1)
  // Clamp to last day of new month
  const maxDay = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()
  r.setDate(Math.min(targetDay, maxDay))
  return r
}

function nthWeekdayInMonth(year: number, month: number, weekNum: number, dow: number): Date | null {
  const first = new Date(year, month, 1)
  const offset = (dow - first.getDay() + 7) % 7
  const day = 1 + offset + (weekNum - 1) * 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  if (day > daysInMonth) return null
  return new Date(year, month, day)
}

export function generateOccurrences(
  startDateStr: string,
  rule: RecurrenceRule,
  maxFutureDays = 730,
): string[] {
  if (rule.type === 'none') return [startDateStr]

  const MAX_COUNT = Math.min(
    rule.endType === 'after_count' ? (rule.endCount || 1) : 500,
    500,
  )

  const start = new Date(startDateStr + 'T12:00:00')

  const cutoff: Date =
    rule.endType === 'on_date' && rule.endDate
      ? new Date(rule.endDate + 'T23:59:59')
      : addDays(start, maxFutureDays)

  const results: string[] = []

  const done = (d: Date) =>
    results.length >= MAX_COUNT || d > cutoff

  // ── Daily ──────────────────────────────────────────
  if (rule.type === 'daily') {
    let d = new Date(start)
    while (!done(d)) {
      results.push(toDateStr(d))
      d = addDays(d, rule.interval)
    }
  }

  // ── Weekly ─────────────────────────────────────────
  else if (rule.type === 'weekly') {
    const activeDays = (rule.days.length > 0 ? rule.days : [DAY_KEYS[start.getDay()]])
      .map(k => DAY_NUMS[k])
      .sort((a, b) => a - b)

    // Rewind to Sunday of the start week
    let sunday = addDays(start, -start.getDay())

    while (!done(addDays(sunday, activeDays[activeDays.length - 1]))) {
      for (const dayNum of activeDays) {
        const d = addDays(sunday, dayNum)
        if (d >= start && !done(d)) results.push(toDateStr(d))
      }
      sunday = addDays(sunday, 7 * rule.interval)
    }
  }

  // ── Monthly ────────────────────────────────────────
  else if (rule.type === 'monthly') {
    if (rule.monthlyType === 'day_of_month') {
      let d = new Date(start)
      while (!done(d)) {
        results.push(toDateStr(d))
        d = addMonths(d, rule.interval)
      }
    } else {
      const weekNum  = Math.floor((start.getDate() - 1) / 7) + 1
      const dow      = start.getDay()
      let   year     = start.getFullYear()
      let   month    = start.getMonth()

      while (true) {
        const target = nthWeekdayInMonth(year, month, weekNum, dow)
        if (target && target >= start && !done(target)) {
          results.push(toDateStr(target))
        }
        month += rule.interval
        if (month > 11) { year += Math.floor(month / 12); month %= 12 }
        if (new Date(year, month, 1) > cutoff) break
        if (results.length >= MAX_COUNT) break
      }
    }
  }

  return results
}

export function describeRecurrence(rule: RecurrenceRule, startDateStr: string): string {
  if (rule.type === 'none') return 'Does not repeat'

  const start = new Date(startDateStr + 'T12:00:00')

  let base = ''

  if (rule.type === 'daily') {
    base = rule.interval === 1 ? 'Every day' : `Every ${rule.interval} days`
  }

  else if (rule.type === 'weekly') {
    const days = (rule.days.length > 0 ? rule.days : [DAY_KEYS[start.getDay()]])
      .map(k => DAY_ABBREVS[DAY_NUMS[k]])
      .join(', ')
    base = rule.interval === 1
      ? `Every week on ${days}`
      : `Every ${rule.interval} weeks on ${days}`
  }

  else if (rule.type === 'monthly') {
    if (rule.monthlyType === 'day_of_month') {
      const d = start.getDate()
      base = rule.interval === 1
        ? `Monthly on day ${d}`
        : `Every ${rule.interval} months on day ${d}`
    } else {
      const wn  = Math.floor((start.getDate() - 1) / 7) + 1
      const dow = DAY_ABBREVS[start.getDay()]
      base = rule.interval === 1
        ? `Monthly on the ${ORDINALS[wn]} ${dow}`
        : `Every ${rule.interval} months on the ${ORDINALS[wn]} ${dow}`
    }
  }

  if (rule.endType === 'on_date' && rule.endDate) {
    const d = new Date(rule.endDate + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
    return `${base} · until ${d}`
  }
  if (rule.endType === 'after_count') {
    return `${base} · ${rule.endCount} time${rule.endCount === 1 ? '' : 's'}`
  }
  return base
}
