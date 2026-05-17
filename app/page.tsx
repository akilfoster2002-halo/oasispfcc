// The middleware handles routing from / to the correct church dashboard.
// This page is a fallback that should never render in practice.
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/select-church')
}
