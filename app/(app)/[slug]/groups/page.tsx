'use client'

import GroupsPage from '@/components/pages/GroupsPage'
import PremiumGate from '@/components/PremiumGate'
import { Layers, TrendingUp, GitBranch, ClipboardList } from 'lucide-react'

export default function GroupsPageWrapper() {
  return (
    <PremiumGate
      title="Groups is a premium feature"
      subtitle="Structure your ministry into groups, each with their own cells, leaders, and analytics. See the full picture of your church's organization at a glance."
      features={[
        {
          icon: Layers,
          title: 'Ministry Groups',
          description: 'Organize your church into arms like MEGA, YPZ, or Charm City.',
        },
        {
          icon: TrendingUp,
          title: 'Group Analytics',
          description: 'Track attendance, soul-winning numbers, and growth metrics per group.',
        },
        {
          icon: GitBranch,
          title: 'Cell Hierarchy',
          description: 'Nest cells under groups for a clear org chart of your entire ministry.',
        },
        {
          icon: ClipboardList,
          title: 'Weekly Reports',
          description: 'Compare this week vs last across every group in a single view.',
        },
      ]}
    >
      <GroupsPage />
    </PremiumGate>
  )
}
