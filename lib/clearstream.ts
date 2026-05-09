const BASE = 'https://api.getclearstream.com/v1'

function headers() {
  const key = process.env.CLEARSTREAM_API_KEY
  if (!key) throw new Error('CLEARSTREAM_API_KEY not set')
  return { 'X-Api-Key': key, 'Content-Type': 'application/json', 'Accept': 'application/json' }
}

export interface SendResult {
  id: number | string
  status: string
}

export interface ClearstreamThread {
  id: number
  unread: boolean
  reply_count: number
  replied_at: string | null
  subscriber: {
    mobile_number: string
    status: string
    first: string
    last: string
    email?: string
    avatar_url?: string
  }
  related_message: {
    id: number
    text: { full: string; header: string; body: string }
    sent_at: string
  } | null
  recent_replies: ClearstreamReply[]
  created_at: string
  updated_at: string
}

export interface ClearstreamReply {
  id: number
  text: string
  status: string
  incoming: boolean
  sent_at: string
  user?: { name?: string }
}

export async function sendSMS(to: string, textBody: string): Promise<SendResult> {
  const res = await fetch(`${BASE}/texts`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ to, text_body: textBody, use_default_header: true }),
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(`Clearstream send failed (${res.status}): ${msg}`)
  }
  const json = await res.json()
  return { id: json.data?.id ?? '', status: json.data?.status ?? 'QUEUED' }
}

export async function listThreads(page = 1): Promise<ClearstreamThread[]> {
  const res = await fetch(`${BASE}/threads?page=${page}&limit=50`, { headers: headers() })
  if (!res.ok) throw new Error(`Clearstream listThreads failed (${res.status})`)
  const json = await res.json()
  return json.data ?? []
}

export async function getThreadReplies(threadId: number | string): Promise<ClearstreamReply[]> {
  const res = await fetch(`${BASE}/threads/${threadId}/replies?limit=50`, { headers: headers() })
  if (!res.ok) return []
  const json = await res.json()
  return json.data ?? []
}

export async function lookupSubscriber(phone: string) {
  const res = await fetch(`${BASE}/subscribers/${encodeURIComponent(phone)}`, { headers: headers() })
  if (res.status === 404) return null
  if (!res.ok) return null
  const json = await res.json()
  return json.data ?? null
}
