/**
 * Z-API Client
 * Adaptado do doctorchatbot_ para o contexto hoteleiro.
 */

export interface ZapiCredentials {
  instanceId: string
  token: string
  clientToken?: string
}

export type ZapiStatus = 'connected' | 'disconnected' | 'connecting'

const ZAPI_BASE_URL = process.env.ZAPI_BASE_URL || 'https://api.z-api.io'

function getInstanceUrl(instanceId: string, token: string): string {
  return `${ZAPI_BASE_URL}/instances/${instanceId}/token/${token}`
}

async function zapiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })

  const rawBody = await response.text()
  let data: unknown = null

  if (rawBody.length > 0) {
    try { data = JSON.parse(rawBody) } catch { data = rawBody }
  }

  if (!response.ok) {
    const message =
      (typeof data === 'object' && data && ((data as Record<string, unknown>).message || (data as Record<string, unknown>).error)) ||
      (typeof data === 'string' && data.trim().length > 0 ? data : null) ||
      'Z-API request failed'
    throw new Error(String(message))
  }

  return data as T
}

export async function zapiSendText(
  credentials: ZapiCredentials,
  phone: string,
  text: string
): Promise<{ success: boolean; messageId?: string }> {
  const { instanceId, token, clientToken } = credentials
  const baseUrl = getInstanceUrl(instanceId, token)
  const cleanPhone = phone.replace(/[^0-9]/g, '')

  const data = await zapiRequest<Record<string, unknown>>(`${baseUrl}/send-text`, {
    method: 'POST',
    headers: clientToken ? { 'Client-Token': clientToken } : undefined,
    body: JSON.stringify({ phone: cleanPhone, message: text }),
  })

  return {
    success: true,
    messageId: String(data.messageId || data.id || data.zaapId || ''),
  }
}

export async function zapiGetStatus(credentials: ZapiCredentials): Promise<ZapiStatus> {
  const { instanceId, token, clientToken } = credentials
  const baseUrl = getInstanceUrl(instanceId, token)

  try {
    const data = await zapiRequest<Record<string, unknown>>(`${baseUrl}/status`, {
      method: 'GET',
      headers: clientToken ? { 'Client-Token': clientToken } : undefined,
    })

    if (typeof data.connected === 'boolean') {
      return data.connected ? 'connected' : 'disconnected'
    }

    const statusMap: Record<string, ZapiStatus> = {
      connected: 'connected', CONNECTED: 'connected', online: 'connected',
      disconnected: 'disconnected', DISCONNECTED: 'disconnected', offline: 'disconnected',
      connecting: 'connecting', QRCODE: 'connecting', qrcode: 'connecting',
    }

    const rawStatus = String(data.status || data.state || '')
    return statusMap[rawStatus] || 'disconnected'
  } catch {
    return 'disconnected'
  }
}

export async function zapiGetProfilePicture(
  credentials: ZapiCredentials,
  phone: string
): Promise<string | null> {
  const { instanceId, token, clientToken } = credentials
  const baseUrl = getInstanceUrl(instanceId, token)
  const cleanPhone = phone.replace(/[^0-9]/g, '')

  try {
    const data = await zapiRequest<{ link: string }>(
      `${baseUrl}/profile-picture?phone=${cleanPhone}`,
      { method: 'GET', headers: clientToken ? { 'Client-Token': clientToken } : undefined }
    )
    return data?.link ?? null
  } catch {
    return null
  }
}

export function validateCredentials(credentials: ZapiCredentials): boolean {
  return !!(credentials.instanceId?.trim() && credentials.token?.trim())
}

export async function zapiSendImage(
  credentials: ZapiCredentials,
  phone: string,
  imageUrl: string,
  caption?: string
): Promise<{ success: boolean; messageId?: string }> {
  const { instanceId, token, clientToken } = credentials
  const baseUrl = getInstanceUrl(instanceId, token)
  const cleanPhone = phone.replace(/[^0-9]/g, '')

  const data = await zapiRequest<Record<string, unknown>>(`${baseUrl}/send-image`, {
    method: 'POST',
    headers: clientToken ? { 'Client-Token': clientToken } : undefined,
    body: JSON.stringify({ phone: cleanPhone, image: imageUrl, caption: caption || '' }),
  })

  return {
    success: true,
    messageId: String(data.messageId || data.id || data.zaapId || ''),
  }
}
