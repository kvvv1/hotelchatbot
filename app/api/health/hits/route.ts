import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      hits_api_url,
      hits_api_key,
      hits_tenant_name,
      hits_property_code,
      hits_client_id,
    } = body

    if (!hits_api_url || !hits_tenant_name) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
    }

    const url = `${hits_api_url.replace(/\/$/, '')}/Authorize`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-VERSION': '1',
      },
      body: JSON.stringify({
        key: hits_client_id ?? '',
        secret: hits_api_key ?? '',
      }),
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'HITS authorization failed' }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
