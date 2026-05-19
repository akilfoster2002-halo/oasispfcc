import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  const via = searchParams.get('via') // 'google' when coming from join flow

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      const userId = data.user.id

      // Check if there's a pending church slug cookie (set by the join/create page)
      const pendingSlug = cookieStore.get('pending_church_slug')?.value

      if (pendingSlug || via === 'google') {
        const slug = pendingSlug

        if (slug) {
          const admin = adminClient()

          // Look up the church
          const { data: church } = await admin
            .from('churches')
            .select('id')
            .eq('slug', slug)
            .single()

          if (church) {
            const status = 'approved'

            // Create or update the membership
            await admin
              .from('church_memberships')
              .upsert({
                user_id: userId,
                church_id: church.id,
                role: 'member',
                status,
                joined_via: 'google_oauth',
                updated_at: new Date().toISOString(),
              }, { onConflict: 'user_id,church_id' })

            // Also ensure user_profile exists for backward compat
            await admin.from('user_profiles').upsert({
              id: userId,
              role: 'group',
              group_id: null,
            }, { onConflict: 'id' })

            // Clear the pending slug cookie
            cookieStore.set('pending_church_slug', '', { maxAge: 0 })

            return NextResponse.redirect(`${origin}/${slug}/dashboard`)
          }
        }
      }

      // Default: redirect to next or root (middleware will route from there)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
