import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { supabase } from '../../lib/supabase'
import { colors, spacing, radius } from '../../lib/theme'
import { router } from 'expo-router'

interface Stats {
  pendingFollowUps: number
  atRiskMembers:   number
  churchName:      string
  firstName:       string
}

export default function TodayScreen() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [membershipRes, profileRes] = await Promise.all([
      supabase.from('church_memberships').select('church_id, churches(name)').eq('user_id', user.id).maybeSingle(),
      supabase.from('user_profiles').select('role').eq('id', user.id).maybeSingle(),
    ])

    const churchId = membershipRes.data?.church_id
    const churches = membershipRes.data?.churches as unknown as { name: string } | null
    const churchName = churches?.name ?? 'Your Church'
    const firstName = (user.user_metadata?.full_name ?? user.email ?? '').split(/[\s@]/)[0]

    if (!churchId) { setLoading(false); return }

    const [followUpsRes, atRiskRes] = await Promise.all([
      supabase.from('follow_ups').select('id', { count: 'exact', head: true }).eq('church_id', churchId).eq('status', 'pending'),
      supabase.rpc('execute_readonly_sql', {
        sql: `SELECT COUNT(DISTINCT a.person_id) FROM attendance a JOIN events e ON e.id = a.event_id WHERE a.church_id = '${churchId}' AND e.cell_id IS NOT NULL AND a.attendance_status = 'present' AND a.person_id NOT IN (SELECT DISTINCT person_id FROM attendance aa JOIN events ee ON ee.id = aa.event_id WHERE aa.church_id = '${churchId}' AND ee.cell_id IS NOT NULL AND aa.attendance_status = 'present' AND ee.event_date >= NOW() - INTERVAL '21 days')`
      }),
    ])

    setStats({
      pendingFollowUps: followUpsRes.count ?? 0,
      atRiskMembers:    Number((atRiskRes.data as any)?.[0]?.count ?? 0),
      churchName,
      firstName,
    })
    setLoading(false)
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  if (loading) return (
    <View style={styles.container}>
      <Text style={{ color: colors.textMuted, marginTop: 80, textAlign: 'center' }}>Loading...</Text>
    </View>
  )

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting()}{stats?.firstName ? `, ${stats.firstName}` : ''}.</Text>
        <Text style={styles.church}>{stats?.churchName}</Text>
      </View>

      {/* At a glance */}
      <View style={styles.row}>
        <TouchableOpacity style={[styles.card, styles.cardHalf]} onPress={() => router.push('/followups')} activeOpacity={0.8}>
          <Text style={styles.cardNumber}>{stats?.pendingFollowUps ?? 0}</Text>
          <Text style={styles.cardLabel}>Follow-ups{'\n'}waiting</Text>
          {(stats?.pendingFollowUps ?? 0) > 0 && (
            <View style={[styles.dot, { backgroundColor: colors.amber }]} />
          )}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.card, styles.cardHalf]} onPress={() => router.push('/alerts')} activeOpacity={0.8}>
          <Text style={styles.cardNumber}>{stats?.atRiskMembers ?? 0}</Text>
          <Text style={styles.cardLabel}>Members{'\n'}at risk</Text>
          {(stats?.atRiskMembers ?? 0) > 0 && (
            <View style={[styles.dot, { backgroundColor: colors.rose }]} />
          )}
        </TouchableOpacity>
      </View>

      {/* Quick actions */}
      <Text style={styles.sectionLabel}>Quick Actions</Text>

      <TouchableOpacity style={styles.action} onPress={() => router.push('/attendance')} activeOpacity={0.8}>
        <View style={styles.actionIcon}><Text style={{ fontSize: 18 }}>✓</Text></View>
        <View style={styles.actionText}>
          <Text style={styles.actionTitle}>Mark attendance</Text>
          <Text style={styles.actionSub}>Record today's cell meeting</Text>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.action} onPress={() => router.push('/followups')} activeOpacity={0.8}>
        <View style={styles.actionIcon}><Text style={{ fontSize: 18 }}>↗</Text></View>
        <View style={styles.actionText}>
          <Text style={styles.actionTitle}>Review follow-ups</Text>
          <Text style={styles.actionSub}>Approve or edit drafted messages</Text>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.action} onPress={() => router.push('/alerts')} activeOpacity={0.8}>
        <View style={[styles.actionIcon, { backgroundColor: 'rgba(194,95,95,0.12)' }]}>
          <Text style={{ fontSize: 18 }}>!</Text>
        </View>
        <View style={styles.actionText}>
          <Text style={styles.actionTitle}>At-risk members</Text>
          <Text style={styles.actionSub}>People missing 3+ weeks</Text>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.base },
  content:   { padding: spacing.xl, paddingTop: 64 },
  header:    { marginBottom: spacing.xxl },
  greeting:  { fontSize: 28, fontWeight: '500', color: colors.textPrimary, letterSpacing: -0.5 },
  church:    { fontSize: 14, color: colors.textTertiary, marginTop: 4 },
  row:       { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xxl },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    position: 'relative',
  },
  cardHalf:    { flex: 1 },
  cardNumber:  { fontSize: 36, fontWeight: '500', color: colors.textPrimary, letterSpacing: -1 },
  cardLabel:   { fontSize: 13, color: colors.textTertiary, marginTop: 4, lineHeight: 18 },
  dot: {
    position: 'absolute', top: 12, right: 12,
    width: 8, height: 8, borderRadius: 4,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '500', color: colors.textMuted,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing.md,
  },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md,
  },
  actionIcon: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: 'rgba(200,169,107,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  actionText: { flex: 1 },
  actionTitle: { fontSize: 15, fontWeight: '500', color: colors.textPrimary },
  actionSub:   { fontSize: 13, color: colors.textTertiary, marginTop: 2 },
})
