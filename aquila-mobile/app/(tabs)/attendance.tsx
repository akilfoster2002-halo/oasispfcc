import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { colors, spacing, radius } from '../../lib/theme'

interface Cell { id: string; name: string; leader_name: string }
interface Person { id: string; first_name: string; last_name: string; present: boolean | null }
interface Event { id: string; name: string; event_date: string }

export default function AttendanceScreen() {
  const [churchId, setChurchId] = useState<string | null>(null)
  const [cells, setCells]       = useState<Cell[]>([])
  const [selectedCell, setSelectedCell] = useState<Cell | null>(null)
  const [events, setEvents]     = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [people, setPeople]     = useState<Person[]>([])
  const [saving, setSaving]     = useState(false)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    loadChurch()
  }, [])

  async function loadChurch() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('church_memberships').select('church_id').eq('user_id', user.id).maybeSingle()
    if (data?.church_id) {
      setChurchId(data.church_id)
      const { data: cellData } = await supabase.from('cells').select('id, name, leader_name').eq('church_id', data.church_id).eq('is_active', true).order('name')
      setCells(cellData ?? [])
    }
    setLoading(false)
  }

  async function selectCell(cell: Cell) {
    setSelectedCell(cell)
    setSelectedEvent(null)
    setPeople([])
    const { data } = await supabase.from('events').select('id, name, event_date').eq('cell_id', cell.id).order('event_date', { ascending: false }).limit(5)
    setEvents(data ?? [])
  }

  async function selectEvent(event: Event) {
    setSelectedEvent(event)
    const [membersRes, attendanceRes] = await Promise.all([
      supabase.from('people').select('id, first_name, last_name').eq('church_id', churchId!).eq('cell_name', selectedCell!.name).order('last_name'),
      supabase.from('attendance').select('person_id, attendance_status').eq('event_id', event.id),
    ])
    const attendanceMap: Record<string, boolean> = {}
    for (const a of attendanceRes.data ?? []) {
      attendanceMap[a.person_id] = a.attendance_status === 'present'
    }
    setPeople((membersRes.data ?? []).map(p => ({ ...p, present: attendanceMap[p.id] ?? null })))
  }

  function toggle(id: string) {
    setPeople(prev => prev.map(p => p.id === id ? { ...p, present: p.present === true ? false : true } : p))
  }

  async function save() {
    if (!selectedEvent) return
    setSaving(true)
    const rows = people.filter(p => p.present !== null).map(p => ({
      church_id:         churchId!,
      event_id:          selectedEvent.id,
      person_id:         p.id,
      attendance_status: p.present ? 'present' : 'absent',
    }))
    const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'event_id,person_id' })
    setSaving(false)
    if (error) Alert.alert('Error', error.message)
    else Alert.alert('Saved', 'Attendance recorded.')
  }

  const marked = people.filter(p => p.present !== null).length

  if (loading) return (
    <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={colors.gold} />
    </View>
  )

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Attendance</Text>

      {/* Step 1 — Pick cell */}
      <Text style={styles.stepLabel}>1. Select cell</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.xl }}>
        {cells.map(c => (
          <TouchableOpacity
            key={c.id}
            onPress={() => selectCell(c)}
            style={[styles.chip, selectedCell?.id === c.id && styles.chipActive]}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, selectedCell?.id === c.id && styles.chipTextActive]}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Step 2 — Pick event */}
      {selectedCell && (
        <>
          <Text style={styles.stepLabel}>2. Select meeting</Text>
          {events.map(e => (
            <TouchableOpacity
              key={e.id}
              onPress={() => selectEvent(e)}
              style={[styles.eventRow, selectedEvent?.id === e.id && styles.eventRowActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.eventName, selectedEvent?.id === e.id && { color: colors.gold }]}>{e.name}</Text>
              <Text style={styles.eventDate}>{new Date(e.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
            </TouchableOpacity>
          ))}
          <View style={{ marginBottom: spacing.xl }} />
        </>
      )}

      {/* Step 3 — Mark people */}
      {selectedEvent && people.length > 0 && (
        <>
          <View style={styles.memberHeader}>
            <Text style={styles.stepLabel}>3. Mark attendance</Text>
            <Text style={styles.memberCount}>{marked}/{people.length}</Text>
          </View>
          {people.map(p => (
            <TouchableOpacity
              key={p.id}
              onPress={() => toggle(p.id)}
              style={[styles.memberRow, p.present === true && styles.memberPresent, p.present === false && styles.memberAbsent]}
              activeOpacity={0.7}
            >
              <View style={[styles.avatar, p.present === true && { backgroundColor: 'rgba(127,168,135,0.25)' }]}>
                <Text style={[styles.avatarText, p.present === true && { color: colors.sage }]}>
                  {p.first_name[0]}{p.last_name[0]}
                </Text>
              </View>
              <Text style={[styles.memberName, p.present === false && { color: colors.textMuted, textDecorationLine: 'line-through' }]}>
                {p.first_name} {p.last_name}
              </Text>
              <View style={[styles.checkBox, p.present === true && styles.checkBoxChecked, p.present === false && styles.checkBoxX]}>
                <Text style={{ color: p.present === true ? colors.sage : p.present === false ? colors.rose : colors.textMuted, fontSize: 13, fontWeight: '500' }}>
                  {p.present === true ? '✓' : p.present === false ? '✕' : '·'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving} activeOpacity={0.8}>
            {saving
              ? <ActivityIndicator color="#111318" />
              : <Text style={styles.saveButtonText}>Save attendance</Text>}
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.base },
  content:   { padding: spacing.xl, paddingTop: 64, paddingBottom: 40 },
  title:     { fontSize: 28, fontWeight: '500', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: spacing.xl },
  stepLabel: { fontSize: 11, fontWeight: '500', color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 0.5, borderColor: colors.border, marginRight: spacing.sm,
  },
  chipActive:     { backgroundColor: 'rgba(200,169,107,0.18)', borderColor: 'rgba(200,169,107,0.40)' },
  chipText:       { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: colors.gold },
  eventRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.lg, backgroundColor: colors.surface,
    borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, marginBottom: spacing.sm,
  },
  eventRowActive: { borderColor: 'rgba(200,169,107,0.40)', backgroundColor: 'rgba(200,169,107,0.08)' },
  eventName:  { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  eventDate:  { fontSize: 12, color: colors.textTertiary },
  memberHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  memberCount:  { fontSize: 13, color: colors.textTertiary },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, borderRadius: radius.md,
    borderWidth: 0.5, borderColor: colors.border,
    backgroundColor: colors.surface, marginBottom: spacing.sm,
  },
  memberPresent: { borderColor: 'rgba(127,168,135,0.30)', backgroundColor: 'rgba(127,168,135,0.06)' },
  memberAbsent:  { borderColor: 'rgba(194,95,95,0.20)',  backgroundColor: 'rgba(194,95,95,0.04)' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontWeight: '500', color: colors.textTertiary },
  memberName: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  checkBox: { width: 28, height: 28, borderRadius: 8, borderWidth: 0.5, borderColor: colors.border, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  checkBoxChecked: { borderColor: 'rgba(127,168,135,0.50)', backgroundColor: 'rgba(127,168,135,0.12)' },
  checkBoxX:       { borderColor: 'rgba(194,95,95,0.40)',  backgroundColor: 'rgba(194,95,95,0.10)' },
  saveButton: { backgroundColor: colors.gold, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.xl },
  saveButtonText: { color: '#111318', fontSize: 15, fontWeight: '500' },
})
