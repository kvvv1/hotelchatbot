/**
 * Z-API Webhook Parser
 * Adaptado do doctorchatbot_ para o contexto hoteleiro.
 * Normaliza os diferentes formatos de payload Z-API.
 */

export interface ParsedWebhookMessage {
  instanceId: string
  phone: string
  name: string | null
  messageText: string
  messageId: string | null
  timestamp: Date
  isFromMe: boolean
  isAudio: boolean
  audioUrl: string | null
}

export interface ZapiWebhookPayload {
  instanceId?: string
  instance?: string
  messageId?: string
  phone?: string
  fromMe?: boolean
  moment?: number
  momment?: number
  chatName?: string
  senderName?: string
  text?: { message?: string }
  body?: string
  message?: unknown
  audio?: { audioUrl?: string; url?: string }
  image?: unknown
  video?: unknown
  document?: unknown
  location?: unknown
  contact?: unknown
  [key: string]: unknown
}

export function parseWebhookPayload(payload: unknown): ParsedWebhookMessage {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid payload: must be an object')
  }

  const p = payload as ZapiWebhookPayload

  const instanceId = p.instanceId || p.instance
  if (!instanceId || typeof instanceId !== 'string') {
    throw new Error('Missing or invalid instanceId')
  }

  const phone = normalizePhone(p.phone)
  if (!phone) throw new Error('Missing or invalid phone number')

  const isFromMe = p.fromMe === true
  const timestamp = extractTimestamp(p)
  const isAudio = !!p.audio
  const audioUrl = isAudio
    ? (typeof p.audio === 'object' && p.audio !== null
        ? ((p.audio as Record<string, unknown>).audioUrl || (p.audio as Record<string, unknown>).url || null) as string | null
        : null)
    : null

  const { messageText } = extractMessageText(p)
  const name = extractSenderName(p)

  let messageId: string | null = getString(p.messageId) || null
  if (!messageId) {
    const bucket = Math.floor(timestamp.getTime() / 10000)
    const interactiveId =
      getString((p as Record<string, unknown>).selectedButtonId) ||
      getString((p as Record<string, unknown>).selectedRowId)
    if (interactiveId) messageId = `interactive_${phone}_${interactiveId}_${bucket}`
  }

  return { instanceId, phone, name, messageText, messageId, timestamp, isFromMe, isAudio, audioUrl }
}

function normalizePhone(phone: unknown): string | null {
  if (!phone || typeof phone !== 'string') return null
  const normalized = phone.replace(/[\s\-\(\)@].*$/g, '').replace(/[^0-9+]/g, '')
  if (!/\d{8,}/.test(normalized)) return null
  return normalized
}

function extractMessageText(p: ZapiWebhookPayload): { messageText: string } {
  if (p.text && typeof p.text === 'object' && p.text.message) {
    return { messageText: String(p.text.message) }
  }
  if (p.body && typeof p.body === 'string') return { messageText: p.body }
  if (p.message && typeof p.message === 'string') return { messageText: p.message }
  if (p.audio) return { messageText: '[Áudio]' }
  if (p.image) return { messageText: '[Imagem]' }
  if (p.video) return { messageText: '[Vídeo]' }
  if (p.document) return { messageText: '[Documento]' }
  if (p.location) return { messageText: '[Localização]' }
  return { messageText: '[Mensagem]' }
}

function extractSenderName(p: ZapiWebhookPayload): string | null {
  const name = p.senderName || p.chatName
  return name && typeof name === 'string' && name.trim() ? name.trim() : null
}

function extractTimestamp(p: ZapiWebhookPayload): Date {
  const moment = p.moment || p.momment
  if (typeof moment === 'number' && moment > 0) return new Date(moment)
  return new Date()
}

function getString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

export function shouldProcessWebhook(parsed: ParsedWebhookMessage): boolean {
  if (parsed.isFromMe) return false
  if (!parsed.phone || parsed.phone.length < 8) return false
  return true
}
