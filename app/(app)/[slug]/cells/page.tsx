'use client'

import CellsPage from '@/components/pages/CellsPage'
import PremiumGate from '@/components/PremiumGate'
import { Users, BarChart2, MapPin, RefreshCw } from 'lucide-react'

export default function CellsPageWrapper() {
  return (
    <PremiumGate
      title="Cells is a premium feature"
      subtitle="Organize your congregation into small groups, track attendance at every meeting, and monitor the health of each cell — all from one place."
      features={[
        {
          icon: Users,
          title: 'Manage Cell Groups',
          description: 'Create and organize small groups with leaders, schedules, and locations.',
        },
        {
          icon: BarChart2,
          title: 'Cell Health Metrics',
          description: 'Spot your most active cells, flag declining groups, and track growth over time.',
        },
        {
          icon: MapPin,
          title: 'Attendance Tracking',
          description: 'Record who shows up to each meeting and see patterns per member.',
        },
        {
          icon: RefreshCw,
          title: 'Recurring Meetings',
          description: 'Set weekly schedules and auto-generate events across your full calendar.',
        },
      ]}
    >
      <CellsPage />
    </PremiumGate>
  )
}
