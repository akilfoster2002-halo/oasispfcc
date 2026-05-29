import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { colors, spacing, radius } from '../../lib/theme'

interface FollowUp {
  id:          string
  person_name: string
  phone:       string | null
  event_name:  string
  event_date:  string
  message:     string | null
  status:      string
}

export default function FollowUpsScreen() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [churchId, setChurchId]   = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)
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
    const { data } = await supabase
      .from('follow_ups')
      .select('id, person_name, phone, event_name, event_date, message, status')
      .eq('church_id', cid)
      .eq('status', 'pending')
      .order('event_date', { ascending: false })
      .limit(40)
    setFollowUps(data ?? [])
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [churchId])

  async function markSent(id: string) {
    await supabase.from('follow_ups').update({ status: 'sent' }).eq('id', id)
    setFollowUps(prev => prev.filter(f => f.id !== id))
  }

  async function dismiss(id: string) {
    await supabase.from('follow_ups').update({ status: 'dismissed' }).eq('id', id)
    setFollowUps(prev => prev.filter(f => f.id !== id))
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
      <Text style={styles.title}>Follow-ups</Text>
      <Text style={styles.sub}>{followUps.length} pending</Text>

      {followUps.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>All caught up.</Text>
          <Text style={styles.emptySub}>No pending follow-ups right now.</Text>
        </View>
      )}

      {followUps.map(f => (
        <View key={f.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{f.person_name[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{f.person_name}</Text>
              <Text style={styles.meta}>
                {f.event_name} · {new Date(f.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            </View>
          </View>

          {f.message && (
            <View style={styles.messageBox}>
              <Text style={styles.messageText}>"{f.message}"</Text>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnSend} onPress={() => markSent(f.id)} activeOpacity={0.8}>
              <Text style={styles.btnSendText}>Mark sent</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnDismiss} onPress={() => dismiss(f.id)} activeOpacity={0.8}>
              <Text style={styles.btnDismissText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
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
  emptySub:  { fontSize: 14, color: colors.textTertiary, marginTop: 6 },
  card: {
    backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  avatar:     { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(200,169,107,0.18)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '500', color: colors.gold },
  name:       { fontSize: 15, fontWeight: '500', color: colors.textPrimary },
  meta:       { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  messageBox: { backgroundColor: colors.elevated, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  messageText:{ fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  actions:    { flexDirection: 'row', gap: spacing.sm },
  btnSend:    { flex: 1, backgroundColor: colors.gold, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  btnSendText:{ color: '#111318', fontSize: 13, fontWeight: '500' },
  btnDismiss: { flex: 1, backgroundColor: colors.elevated, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 0.5, borderColor: colors.border },
  btnDismissText: { color: colors.textTertiary, fontSize: 13, fontWeight: '500' },
})
