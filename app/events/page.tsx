'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { Calendar, Plus, Clock, ChevronRight } from 'lucide-react'

interface EventRow {
  id: string
  title: string
  date: string
  cells: { name: string } | null
}

type Filter = 'upcoming' | 'past' | 'all'

export default function EventsPage() {
  const [events, setEvents] = useState<EventRow[]>([])
  const [filter, setFilter] = useState<Filter>('upcoming')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const supabase = getSupabase()
      const now = new Date().toISOString()

      let query = supabase
        .from('meetings')
        .select('id, title, date, cells(name)')
        .order('date', { ascending: filter !== 'past' })

      if (filter === 'upcoming') query = query.gte('date', now)
      if (filter === 'past') query = query.lt('date', now)

      const { data } = await query
      setEvents((data as unknown as EventRow[]) ?? [])
      setLoading(false)
    }
    load()
  }, [filter])

  const filters: { key: Filter; label: string }[] = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past' },
    { key: 'all', label: 'All' },
  ]

  return (
    <div className="p-6 md:p-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#111827' }}>Events</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Meetings and services</p>
        </div>
        <Link
          href="/events/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: '#4068E2' }}
        >
          <Plus className="w-4 h-4" />
          New Event
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-lg w-fit" style={{ backgroundColor: '#F3F4F6' }}>
        {filters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
            style={{
              backgroundColor: filter === key ? '#FFFFFF' : 'transparent',
              color: filter === key ? '#111827' : '#6B7280',
              boxShadow: filter === key ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Events list */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 rounded animate-pulse" style={{ backgroundColor: '#F3F4F6' }} />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="py-16 text-center">
            <Calendar className="w-10 h-10 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
            <p className="text-sm font-medium" style={{ color: '#6B7280' }}>
              {filter === 'upcoming' ? 'No upcoming events' : filter === 'past' ? 'No past events' : 'No events yet'}
            </p>
            <Link href="/events/new" className="mt-2 inline-block text-sm font-medium" style={{ color: '#4068E2' }}>
              Schedule one →
            </Link>
          </div>
        ) : (
          <ul>
            {events.map((event, i) => {
              const d = new Date(event.date)
              const isPast = d < new Date()
              return (
                <li key={event.id}>
                  <Link
                    href={`/events/${event.id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-[#F9FAFB] transition-colors"
                    style={i < events.length - 1 ? { borderBottom: '1px solid #F3F4F6' } : {}}
                  >
                    {/* Date badge */}
                    <div className="w-12 shrink-0 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide"
                        style={{ color: isPast ? '#D1D5DB' : '#4068E2' }}>
                        {d.toLocaleDateString('en-US', { month: 'short' })}
                      </p>
                      <p className="text-xl font-bold leading-tight"
                        style={{ color: isPast ? '#9CA3AF' : '#111827' }}>
                        {d.getDate()}
                      </p>
                      <p className="text-[10px]" style={{ color: '#9CA3AF' }}>
                        {d.toLocaleDateString('en-US', { weekday: 'short' })}
                      </p>
                    </div>

                    {/* Divider */}
                    <div className="w-px h-10 shrink-0"
                      style={{ backgroundColor: isPast ? '#E5E7EB' : '#BFDBFE' }} />

                    {/* Title + cell */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate"
                        style={{ color: isPast ? '#6B7280' : '#111827' }}>
                        {event.title}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
                        {event.cells?.name ?? 'No cell assigned'}
                      </p>
                    </div>

                    {/* Time */}
                    <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                      <Clock className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} />
                      <span className="text-sm" style={{ color: '#9CA3AF' }}>
                        {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>

                    <ChevronRight className="w-4 h-4 shrink-0" style={{ color: '#D1D5DB' }} />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
