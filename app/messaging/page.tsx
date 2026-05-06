import { MessageSquare } from 'lucide-react'

export default function MessagingPage() {
  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" style={{ color: '#111827' }}>Messaging</h1>
        <p className="text-sm mt-1" style={{ color: '#6B7280' }}>Send messages and announcements to your congregation.</p>
      </div>

      <div className="bg-white rounded-xl p-12 text-center" style={{ border: '1px solid #E5E7EB' }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: '#EEF2FF' }}>
          <MessageSquare className="w-7 h-7" style={{ color: '#4068E2' }} />
        </div>
        <h2 className="text-base font-semibold mb-2" style={{ color: '#111827' }}>
          Messaging module coming soon
        </h2>
        <p className="text-sm max-w-xs mx-auto" style={{ color: '#6B7280' }}>
          Bulk email, SMS broadcasts, and group messaging will be available here.
        </p>
      </div>
    </div>
  )
}
