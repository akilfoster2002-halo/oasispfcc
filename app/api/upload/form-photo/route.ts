import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// POST /api/upload/form-photo
// FormData: file, formId, churchId
export async function POST(req: Request) {
  const formData = await req.formData()
  const file     = formData.get('file')     as File   | null
  const formId   = formData.get('formId')   as string | null
  const churchId = formData.get('churchId') as string | null

  if (!file || !formId || !churchId) {
    return Response.json({ error: 'file, formId, and churchId are required' }, { status: 400 })
  }

  const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${churchId}/${formId}/${crypto.randomUUID()}.${ext}`

  const supabase = db()
  const { error } = await supabase.storage
    .from('form-photos')
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { data } = supabase.storage.from('form-photos').getPublicUrl(path)
  return Response.json({ url: data.publicUrl })
}
