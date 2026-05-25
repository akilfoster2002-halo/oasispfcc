'use client'

import CellsPage from '@/components/pages/CellsPage'
import PremiumGate from '@/components/PremiumGate'

const CELLS_FEATURES = [
  {
    icon: '👥',
    title: 'Manage Cell Groups',
    description: 'Create and organize all your small groups with leaders, schedules, and locations.',
  },
  {
    icon: '📍',
    title: 'Track Attendance',
    description: 'Record who shows up to each cell meeting and see trends over time.',
  },
  {
    icon: '📊',
    title: 'Cell Health Metrics',
    description: 'Spot your most active cells, flag declining groups, and measure growth.',
  },
  {
    icon: '🔁',
    title: 'Recurring Meetings',
    description: 'Set weekly or bi-weekly schedules and auto-generate events in your calendar.',
  },
]

export default function CellsPageWrapper() {
  return (
    <PremiumGate
      title="Cells is a premium feature"
      subtitle="Organize your congregation into small groups, track attendance at each meeting, and monitor the health of every cell — all in one place."
      features={CELLS_FEATURES}
    >
      <CellsPage />
    </PremiumGate>
  )
}
