import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/auth', '/join', '/pending-approval', '/select-church']

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
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
    const topLevelPublic = ['login', 'auth', 'join', 'pending-approval', 'select-church', 'api']

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

    // Authenticated user at root — route to their church(es)
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
        const churchSlug = (approved[0].church as { slug: string } | null)?.slug
        url.pathname = churchSlug ? `/${churchSlug}/dashboard` : '/select-church'
      } else if (approved.length > 1) {
        url.pathname = '/select-church'
      } else {
        url.pathname = '/pending-approval'
      }
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
