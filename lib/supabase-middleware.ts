import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/signup', '/auth', '/join', '/invite', '/pending-approval', '/select-church', '/api/', '/pricing', '/give', '/forgot-password', '/reset-password']

function isPublicPath(pathname: string) {
  if (pathname === '/') return true
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p))
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Redirect unauthenticated users to /login (except public paths)
  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // For API routes, skip membership check (APIs do their own auth)
  if (pathname.startsWith('/api/')) {
    return supabaseResponse
  }

  // If authenticated and on a church-scoped route (/[slug]/...), verify membership
  if (user) {
    // Extract slug from path — first segment that isn't a known top-level page
    const segments = pathname.split('/').filter(Boolean)
    const topLevelPublic = ['login', 'signup', 'auth', 'join', 'invite', 'onboarding', 'pending-approval', 'select-church', 'api', 'give', 'forgot-password', 'reset-password']

    if (segments.length >= 1 && !topLevelPublic.includes(segments[0])) {
      const slug = segments[0]

      // Look up the church and user's membership
      const admin = adminClient()
      const { data: church } = await admin
        .from('churches')
        .select('id')
        .eq('slug', slug)
        .single()

      if (church) {
        const { data: membership } = await admin
          .from('church_memberships')
          .select('status')
          .eq('user_id', user.id)
          .eq('church_id', church.id)
          .single()

        if (!membership) {
          // User has no membership — send them to the join flow
          const url = request.nextUrl.clone()
          url.pathname = `/join/${slug}`
          return NextResponse.redirect(url)
        }

        if (membership.status === 'pending') {
          // Membership exists but not yet approved
          const url = request.nextUrl.clone()
          url.pathname = '/pending-approval'
          return NextResponse.redirect(url)
        }

        if (membership.status === 'rejected' || membership.status === 'suspended') {
          const url = request.nextUrl.clone()
          url.pathname = '/pending-approval'
          return NextResponse.redirect(url)
        }
      }
    }

    // Authenticated user at root — redirect to their dashboard if they have a church,
    // otherwise let them see the landing page so they can choose to create one.
    if (pathname === '/') {
      const admin = adminClient()
      const { data: memberships } = await admin
        .from('church_memberships')
        .select('status, church:churches(slug)')
        .eq('user_id', user.id)
        .eq('status', 'approved')

      const approved = memberships ?? []
      const url = request.nextUrl.clone()

      if (approved.length === 1) {
        const churchObj = approved[0].church as unknown
        const churchSlug = (churchObj && typeof churchObj === 'object' && !Array.isArray(churchObj))
          ? (churchObj as { slug: string }).slug
          : null
        if (churchSlug) {
          url.pathname = `/${churchSlug}/dashboard`
          return NextResponse.redirect(url)
        }
      } else if (approved.length > 1) {
        url.pathname = '/select-church'
        return NextResponse.redirect(url)
      }
      // No approved churches — show the landing page, let them click the CTA
    }
  }

  return supabaseResponse
}
