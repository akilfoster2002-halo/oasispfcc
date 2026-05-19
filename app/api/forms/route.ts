import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// GET /api/forms?church_id=xxx
export async function GET(req: NextRequest) {
  const churchId = req.nextUrl.searchParams.get('church_id')
  if (!churchId) return Response.json({ error: 'church_id required' }, { status: 400 })

  const { data, error } = await db()
    .from('forms')
    .select('id, name, description, is_preset, fields, created_at')
    .eq('church_id', churchId)
    .order('is_preset', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

// POST /api/forms  { church_id, name, description?, fields }
export async function POST(req: Request) {
  const body = await req.json()
  const { church_id, name, description, fields } = body

  if (!church_id || !name?.trim()) {
    return Response.json({ error: 'church_id and name are required' }, { status: 400 })
  }

  const { data, error } = await db()
    .from('forms')
    .insert({ church_id, name: name.trim(), description: description || null, fields: fields ?? [] })
    .select('id')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
