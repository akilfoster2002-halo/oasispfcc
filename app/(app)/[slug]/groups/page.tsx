'use client'

import GroupsPage from '@/components/pages/GroupsPage'
import PremiumGate from '@/components/PremiumGate'

const GROUPS_FEATURES = [
  {
    icon: '🏛️',
    title: 'Ministry Groups',
    description: 'Organize your church into ministry arms like MEGA, YPZ, or Charm City.',
  },
  {
    icon: '📈',
    title: 'Group Analytics',
    description: 'See attendance trends, soul-winning numbers, and growth metrics per group.',
  },
  {
    icon: '🔗',
    title: 'Cell Hierarchy',
    description: 'Nest cells under groups for a clear org chart of your entire ministry.',
  },
  {
    icon: '📋',
    title: 'Weekly Reports',
    description: 'Compare this week vs last week across every group at a glance.',
  },
]

export default function GroupsPageWrapper() {
  return (
    <PremiumGate
      title="Groups is a premium feature"
      subtitle="Structure your ministry into groups, each with their own cells, leaders, and analytics. See the full picture of your church's organization."
      features={GROUPS_FEATURES}
    >
      <GroupsPage />
    </PremiumGate>
  )
}
