import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const zapi_instance_id = String(body.zapi_instance_id || '').trim()
    const zapi_token = String(body.zapi_token || '').trim()
    const zapi_client_token = String(body.zapi_client_token || '').trim()

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

    const res = await fetch(url, { method: 'GET', headers, cache: 'no-store' })

    const rawBody = await res.text()
    let data: unknown = null

    if (rawBody.length > 0) {
      try {
        data = JSON.parse(rawBody)
      } catch {
        data = rawBody
      }
    }

    const rawMessage =
      (typeof data === 'object' &&
        data &&
        (((data as Record<string, unknown>).message as string | undefined) ||
          ((data as Record<string, unknown>).error as string | undefined))) ||
      (typeof data === 'string' && data.trim().length > 0 ? data : null)

    const message =
      rawMessage === 'null not allowed'
        ? 'Client Token obrigatório: o Security Token da Z-API parece estar ativo nessa conta.'
        : rawMessage || 'Falha ao consultar a Z-API.'

    if (!res.ok) {
      return NextResponse.json({ error: message }, { status: res.status })
    }

    const connected = typeof data === 'object' && data ? Boolean((data as Record<string, unknown>).connected) : false
    const smartphoneConnected =
      typeof data === 'object' && data ? Boolean((data as Record<string, unknown>).smartphoneConnected) : false

    return NextResponse.json({
      connected,
      smartphoneConnected,
      message: connected
        ? 'Instância conectada ao WhatsApp.'
        : message || 'Instância acessível, mas ainda não conectada ao WhatsApp.',
    })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
