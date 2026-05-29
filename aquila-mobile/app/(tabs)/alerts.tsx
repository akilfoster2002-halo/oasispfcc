import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { colors, spacing, radius } from '../../lib/theme'

interface AtRisk {
  person_id:    string
  first_name:   string
  last_name:    string
  cell_name:    string | null
  last_seen:    string | null
  weeks_absent: number
}

export default function AlertsScreen() {
  const [people, setPeople]   = useState<AtRisk[]>([])
  const [churchId, setChurchId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('church_memberships').select('church_id').eq('user_id', user.id).maybeSingle()
    if (data?.church_id) { setChurchId(data.church_id); await load(data.church_id) }
    setLoading(false)
  }

  async function load(id?: string) {
    const cid = id ?? churchId
    if (!cid) return

    const { data } = await supabase.rpc('execute_readonly_sql', {
      sql: `
        WITH last_attendance AS (
          SELECT
            a.person_id,
            MAX(e.event_date) AS last_seen,
            FLOOR(EXTRACT(EPOCH FROM (NOW() - MAX(e.event_date))) / 604800)::int AS weeks_absent
          FROM attendance a
          JOIN events e ON e.id = a.event_id
          WHERE a.church_id = '${cid}'
            AND e.cell_id IS NOT NULL
            AND a.attendance_status = 'present'
          GROUP BY a.person_id
        )
        SELECT
          p.id AS person_id,
          p.first_name,
          p.last_name,
          p.cell_name,
          la.last_seen,
          la.weeks_absent
        FROM people p
        JOIN last_attendance la ON la.person_id = p.id
        WHERE la.weeks_absent >= 3
          AND p.church_id = '${cid}'
          AND p.designation IS DISTINCT FROM 'archived'
        ORDER BY la.weeks_absent DESC, p.last_name
        LIMIT 60
      `
    })

    setPeople((data as AtRisk[]) ?? [])
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [churchId])

  function urgencyColor(weeks: number) {
    if (weeks >= 6) return colors.rose
    if (weeks >= 4) return colors.amber
    return colors.textTertiary
  }

  if (loading) return (
    <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={colors.gold} />
    </View>
  )

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
    >
      <Text style={styles.title}>At Risk</Text>
      <Text style={styles.sub}>{people.length} members missing 3+ weeks of cell</Text>

      {people.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No one at risk.</Text>
          <Text style={styles.emptySub}>All cell members have been seen in the last 3 weeks.</Text>
        </View>
      )}

      {people.map(p => {
        const color = urgencyColor(p.weeks_absent)
        return (
          <View key={p.person_id} style={styles.row}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{p.first_name[0]}{p.last_name[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{p.first_name} {p.last_name}</Text>
              <Text style={styles.cell}>{p.cell_name ?? 'No cell assigned'}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: `${color}18`, borderColor: `${color}40` }]}>
              <Text style={[styles.badgeText, { color }]}>{p.weeks_absent}w</Text>
            </View>
          </View>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.base },
  content:   { padding: spacing.xl, paddingTop: 64, paddingBottom: 40 },
  title:     { fontSize: 28, fontWeight: '500', color: colors.textPrimary, letterSpacing: -0.5 },
  sub:       { fontSize: 14, color: colors.textTertiary, marginTop: 4, marginBottom: spacing.xl },
  empty:     { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 17, fontWeight: '500', color: colors.textSecondary },
  emptySub:  { fontSize: 14, color: colors.textTertiary, marginTop: 6, textAlign: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '500', color: colors.textTertiary },
  name:  { fontSize: 15, fontWeight: '500', color: colors.textPrimary },
  cell:  { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  badge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.xl, borderWidth: 0.5,
  },
  badgeText: { fontSize: 12, fontWeight: '500' },
})
