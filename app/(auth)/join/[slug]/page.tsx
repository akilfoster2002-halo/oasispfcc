import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Church } from 'lucide-react'

interface Church {
  id: string
  name: string
  slug: string
}

async function getChurch(slug: string): Promise<Church | null> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  try {
    const res = await fetch(`${base}/api/churches/${slug}`, { cache: 'no-store' })
    if (!res.ok) return null
    const { church } = await res.json()
    return church
  } catch {
    return null
  }
}

export default async function JoinLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const church = await getChurch(slug)

  if (!church) notFound()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        {/* Church logo / icon */}
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center shadow"
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)' }}
          >
            <Church className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{church.name}</h1>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Link
            href={`/join/${slug}/create`}
            className="block w-full py-3 px-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Join {church.name}
          </Link>
          <Link
            href={`/login?next=/join/${slug}/create`}
            className="block w-full py-3 px-4 bg-white border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
          >
            I already have an account — Sign in
          </Link>
        </div>

        <p className="text-xs text-gray-400">
          By joining, you agree to this platform&apos;s terms of service.
        </p>
      </div>
    </div>
  )
}
