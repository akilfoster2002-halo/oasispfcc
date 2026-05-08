// Server-side only — never import from client components.
// Uses the service role key to bypass RLS. Falls back to anon key with a warning.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

export function getSupabaseServer() {
  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceRoleKey) {
    return createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }

  // Fall back to anon key — RLS policies must allow the operation
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!anonKey) {
    throw new Error(
      'Missing Supabase credentials: set SUPABASE_SERVICE_ROLE_KEY (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  }
  console.warn(
    '[supabase-server] SUPABASE_SERVICE_ROLE_KEY is not set — falling back to anon key. ' +
    'Server-side mutations may be blocked by RLS.'
  )
  return createClient(supabaseUrl, anonKey)
}
