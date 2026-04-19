import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { zapi_instance_id, zapi_token, zapi_client_token } = body

    if (!zapi_instance_id || !zapi_token) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
    }

    const baseUrl = process.env.ZAPI_BASE_URL || 'https://api.z-api.io'
    const url = `${baseUrl}/instances/${zapi_instance_id}/token/${zapi_token}/status`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (zapi_client_token) {
      headers['Client-Token'] = zapi_client_token
    }

    const res = await fetch(url, { headers })

    if (!res.ok) {
      return NextResponse.json({ error: 'Z-API unreachable' }, { status: 502 })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
