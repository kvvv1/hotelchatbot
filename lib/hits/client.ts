/**
 * HITS PMS API Client
 * Baseado na documentação: https://api.hitspms.net/swagger/index.html
 *
 * Autenticação: POST /Authorize → Bearer token
 * Todos os requests exigem os headers X-API-TENANT-NAME, X-API-PROPERTY-CODE, etc.
 */

import type { HitsAvailabilityParams, HitsRoom, HitsRoomType } from './types'

export interface HitsCredentials {
  apiUrl: string        // ex: https://api.hitspms.net
  apiKey: string        // secret para autenticação no /Authorize
  tenantName: string    // X-API-TENANT-NAME
  propertyCode: number  // X-API-PROPERTY-CODE (inteiro)
  clientId: string      // X-Client-Id (partner key)
}

// Cache de tokens em memória com TTL
// Em serverless, isso pode ser resetado — o token será refetado quando necessário
interface CachedToken {
  token: string
  expiresAt: number // timestamp ms
}
const tokenCache = new Map<string, CachedToken>()

/**
 * Obtém (ou renova) o Bearer token para as credenciais informadas.
 * POST /Authorize
 */
async function getAccessToken(credentials: HitsCredentials): Promise<string> {
  const cacheKey = `${credentials.tenantName}:${credentials.propertyCode}`
  const cached = tokenCache.get(cacheKey)

  if (cached && Date.now() < cached.expiresAt) {
    return cached.token
  }

  const url = `${credentials.apiUrl}/Authorize`

  // O corpo exato do AccessSecret não está documentado publicamente.
  // Campo mais provável baseado em padrão de APIs de parceiro PMS:
  // { "key": clientId, "secret": apiKey }
  // Ajuste se a HITS retornar 400 na primeira chamada.
  const body = {
    key: credentials.clientId,
    secret: credentials.apiKey,
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-VERSION': '1',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    console.error('[HITS PMS] Falha na autenticação:', response.status, text)
    throw new Error(`HITS PMS: falha na autenticação (${response.status})`)
  }

  const data = await response.json() as Record<string, unknown>

  // O token pode vir em campos diferentes: token, accessToken, access_token
  const token = String(data.token || data.accessToken || data.access_token || '')
  if (!token) throw new Error('HITS PMS: token não encontrado na resposta de autenticação')

  // TTL: usa o campo expiresIn (segundos) se disponível, senão assume 8h
  const expiresInSeconds = Number(data.expiresIn || data.expires_in || 28800)
  const expiresAt = Date.now() + (expiresInSeconds - 60) * 1000 // -60s de margem

  tokenCache.set(cacheKey, { token, expiresAt })
  return token
}

/**
 * Monta os headers obrigatórios para todas as chamadas HITS PMS.
 */
function buildHeaders(credentials: HitsCredentials, token: string, apiVersion = '1'): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-API-VERSION': apiVersion,
    'X-API-TENANT-NAME': credentials.tenantName,
    'X-API-PROPERTY-CODE': String(credentials.propertyCode),
    'X-API-LANGUAGE-CODE': 'pt-br',
    'X-Client-Id': credentials.clientId,
  }
}

/**
 * Executa uma requisição autenticada para a HITS PMS API.
 */
async function hitsRequest<T>(
  credentials: HitsCredentials,
  path: string,
  options: RequestInit = {},
  apiVersion = '1'
): Promise<T> {
  if (!credentials.apiUrl) throw new Error('HITS PMS: URL da API não configurada')
  if (!credentials.tenantName) throw new Error('HITS PMS: Tenant Name não configurado')
  if (!credentials.propertyCode) throw new Error('HITS PMS: Property Code não configurado')

  const token = await getAccessToken(credentials)
  const url = `${credentials.apiUrl}${path}`

  const response = await fetch(url, {
    ...options,
    headers: { ...buildHeaders(credentials, token, apiVersion), ...(options.headers as Record<string, string> || {}) },
  })

  const rawBody = await response.text()
  let data: unknown = null
  if (rawBody.length > 0) {
    try { data = JSON.parse(rawBody) } catch { data = rawBody }
  }

  if (!response.ok) {
    const errorMsg =
      (typeof data === 'object' && data !== null
        ? ((data as Record<string, unknown>).message || (data as Record<string, unknown>).error || (data as Record<string, unknown>).title)
        : null) || `HITS PMS error: ${response.status}`
    console.error('[HITS PMS] Request failed:', { url, status: response.status, data })
    throw new Error(String(errorMsg))
  }

  return data as T
}

// ─── Tipos da API real HITS PMS ──────────────────────────────────────────────
// Baseado em /Datashare/ChannelManager/Availability
// Os campos exatos devem ser confirmados na primeira chamada real à API.
export interface HitsAvailabilityItem {
  // Campos prováveis do AvailabilityDto (ajustar se necessário após primeira chamada)
  roomTypeId?: number
  roomTypeCode?: string
  roomTypeName?: string
  date?: string
  availableRooms?: number
  totalRooms?: number
  minStay?: number
  maxStay?: number
  // Tarifas (se incluídas na resposta de disponibilidade)
  rate?: number
  rateCode?: string
  rateName?: string
  currency?: string
  // Campos alternativos que alguns PMS usam
  id?: number
  name?: string
  code?: string
  available?: number | boolean
  price?: number
  [key: string]: unknown
}

// ─── Funções públicas ─────────────────────────────────────────────────────────

/**
 * Verifica disponibilidade de quartos.
 * GET /Datashare/ChannelManager/Availability
 *
 * Datas no formato ISO: YYYY-MM-DDTHH:mm:ss (a API usa DateTime)
 */
export async function checkAvailability(
  credentials: HitsCredentials,
  params: HitsAvailabilityParams
): Promise<HitsAvailabilityItem[]> {
  // HITS PMS usa DateTime completo
  const iniDate = `${params.checkIn}T00:00:00`
  const finDate = `${params.checkOut}T23:59:59`

  const query = new URLSearchParams({ IniDate: iniDate, FinDate: finDate })
  if (params.roomTypeId) query.set('RoomTypeId', String(params.roomTypeId))

  const result = await hitsRequest<HitsAvailabilityItem | HitsAvailabilityItem[]>(
    credentials,
    `/Datashare/ChannelManager/Availability?${query}`
  )

  // A API pode retornar array direto ou objeto com propriedade data/items
  if (Array.isArray(result)) return result
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>
    if (Array.isArray(r.data)) return r.data as HitsAvailabilityItem[]
    if (Array.isArray(r.items)) return r.items as HitsAvailabilityItem[]
    return [result as HitsAvailabilityItem]
  }
  return []
}

/**
 * Verifica ocupação/inventário de quartos.
 * GET /Datashare/ChannelManager/OccupationInventory
 */
export async function getOccupationInventory(
  credentials: HitsCredentials,
  params: { checkIn: string; checkOut: string; page?: number; size?: number }
): Promise<unknown[]> {
  const query = new URLSearchParams({
    IniDate: `${params.checkIn}T00:00:00`,
    FinDate: `${params.checkOut}T23:59:59`,
    ...(params.page !== undefined ? { Page: String(params.page) } : {}),
    ...(params.size !== undefined ? { Size: String(params.size) } : {}),
  })

  const result = await hitsRequest<unknown>(credentials, `/Datashare/ChannelManager/OccupationInventory?${query}`)
  if (Array.isArray(result)) return result
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>
    if (Array.isArray(r.data)) return r.data as unknown[]
    if (Array.isArray(r.items)) return r.items as unknown[]
  }
  return []
}

/**
 * Formata a resposta de disponibilidade para exibição no WhatsApp.
 */
export function formatAvailabilityForChat(
  items: HitsAvailabilityItem[],
  checkIn: string,
  checkOut: string
): string {
  const available = items.filter(i => {
    if (typeof i.available === 'boolean') return i.available
    if (typeof i.available === 'number') return i.available > 0
    if (typeof i.availableRooms === 'number') return i.availableRooms > 0
    return true
  })

  if (!available.length) {
    return `Infelizmente não temos disponibilidade para ${formatDate(checkIn)} a ${formatDate(checkOut)}. Gostaria de verificar outras datas?`
  }

  // Agrupar por tipo de quarto (deduplicar)
  const byRoomType = new Map<string, HitsAvailabilityItem>()
  for (const item of available) {
    const key = item.roomTypeCode || item.code || item.roomTypeName || item.name || String(item.roomTypeId)
    if (!byRoomType.has(key)) byRoomType.set(key, item)
  }

  const options = [...byRoomType.values()].slice(0, 5)

  const lines = [
    `Temos disponibilidade para ${formatDate(checkIn)} a ${formatDate(checkOut)}! Veja as opções:\n`,
    ...options.map((item, i) => {
      const nome = item.roomTypeName || item.name || item.roomTypeCode || `Tipo ${i + 1}`
      const preco = item.rate || item.price
      const precoStr = preco ? `R$ ${Number(preco).toFixed(2)}/noite` : 'consultar preço'
      return `${i + 1}. *${nome}* — ${precoStr}`
    }),
    '\nQual opção te interessa?',
  ]

  return lines.join('\n')
}

/**
 * Converte HitsAvailabilityItem[] para o formato interno HitsRoom[]
 * para compatibilidade com o código existente.
 */
export function mapToHitsRooms(items: HitsAvailabilityItem[]): HitsRoom[] {
  const byRoomType = new Map<string, HitsAvailabilityItem>()
  for (const item of items) {
    const key = String(item.roomTypeCode || item.code || item.roomTypeId || Math.random())
    if (!byRoomType.has(key)) byRoomType.set(key, item)
  }

  return [...byRoomType.values()].map(item => ({
    id: String(item.roomTypeId || item.id || ''),
    code: String(item.roomTypeCode || item.code || ''),
    name: String(item.roomTypeName || item.name || ''),
    type: String(item.roomTypeCode || item.code || ''),
    maxGuests: 2,
    available: (() => {
      if (typeof item.available === 'boolean') return item.available
      if (typeof item.available === 'number') return item.available > 0
      if (typeof item.availableRooms === 'number') return item.availableRooms > 0
      return true
    })(),
    rate: Number(item.rate || item.price || 0),
    currency: String(item.currency || 'BRL'),
  }))
}

// ─── Web Check-In-Out ────────────────────────────────────────────────────────

/**
 * Lista hóspedes atualmente no hotel (in-house).
 * GET /Datashare/InternetControl/RoomingList
 *
 * Útil para: verificar se um hóspede já tem reserva, buscar por nome/telefone.
 */
export async function getRoomingList(
  credentials: HitsCredentials,
  params?: {
    checkInDate?: string   // YYYY-MM-DD
    guestNameOrRoom?: string
    mainGuestOnly?: boolean
    page?: number
    size?: number
  }
): Promise<unknown[]> {
  const query = new URLSearchParams()
  if (params?.checkInDate) query.set('CheckInDate', `${params.checkInDate}T00:00:00`)
  if (params?.guestNameOrRoom) query.set('RoomOrGuestNameOrCard', params.guestNameOrRoom)
  if (params?.mainGuestOnly !== undefined) query.set('MainGuest', String(params.mainGuestOnly))
  if (params?.page !== undefined) query.set('Page', String(params.page))
  if (params?.size !== undefined) query.set('Size', String(Math.min(params.size, 100)))

  const result = await hitsRequest<unknown>(credentials, `/Datashare/InternetControl/RoomingList?${query}`)
  if (Array.isArray(result)) return result
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>
    if (Array.isArray(r.data)) return r.data as unknown[]
    if (Array.isArray(r.items)) return r.items as unknown[]
  }
  return []
}

/**
 * Busca detalhes completos de uma reserva/folha pelo ID.
 * GET /Datashare/InternetControl/Folio/{folioId}
 *
 * Útil para: confirmar detalhes da reserva de um hóspede.
 */
export async function getFolio(
  credentials: HitsCredentials,
  folioId: number,
  showVoidedItems = true
): Promise<unknown> {
  const query = new URLSearchParams({ showVoidedItems: String(showVoidedItems) })
  return hitsRequest<unknown>(credentials, `/Datashare/InternetControl/Folio/${folioId}?${query}`)
}

/**
 * Realiza o check-in de uma reserva existente.
 * POST /Datashare/Folios/{reservationId}/CheckIn
 *
 * ATENÇÃO: Requer que a reserva já exista no HITS PMS.
 * O agente NÃO pode criar reservas — apenas fazer check-in de reservas existentes.
 */
export async function checkInReservation(
  credentials: HitsCredentials,
  reservationId: number
): Promise<unknown> {
  return hitsRequest<unknown>(credentials, `/Datashare/Folios/${reservationId}/CheckIn`, {
    method: 'POST',
  })
}

/**
 * Atualiza o documento de identificação do hóspede (RG, CPF, Passaporte).
 * PUT /Datashare/Folios/{folioId}/{entityId}/UpdateIdentificationCard
 *
 * Útil para: fluxo de web check-in (coletar documento antes da chegada).
 */
export async function updateGuestIdentification(
  credentials: HitsCredentials,
  folioId: number,
  entityId: number,
  identificationData: Record<string, unknown>
): Promise<unknown> {
  return hitsRequest<unknown>(
    credentials,
    `/Datashare/Folios/${folioId}/${entityId}/UpdateIdentificationCard`,
    { method: 'PUT', body: JSON.stringify(identificationData) }
  )
}

/**
 * Busca reservas encerradas no período.
 * GET /Datashare/InternetControl/FoliosClosed
 *
 * Útil para: histórico, relatórios, consultas de hóspedes anteriores.
 */
export async function getClosedFolios(
  credentials: HitsCredentials,
  params: {
    begin: string    // YYYY-MM-DD
    end: string      // YYYY-MM-DD
    page?: number
    size?: number
  }
): Promise<unknown[]> {
  const query = new URLSearchParams({
    Begin: `${params.begin}T00:00:00`,
    End: `${params.end}T23:59:59`,
    ...(params.page !== undefined ? { Page: String(params.page) } : {}),
    ...(params.size !== undefined ? { Size: String(Math.min(params.size, 100)) } : {}),
  })

  const result = await hitsRequest<unknown>(credentials, `/Datashare/InternetControl/FoliosClosed?${query}`)
  if (Array.isArray(result)) return result
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>
    if (Array.isArray(r.data)) return r.data as unknown[]
    if (Array.isArray(r.items)) return r.items as unknown[]
  }
  return []
}

// ─── HealthCheck ──────────────────────────────────────────────────────────────

/**
 * Verifica se a API do HITS PMS está respondendo.
 * GET /api/HealthCheck — não requer autenticação.
 */
export async function healthCheck(apiUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${apiUrl}/api/HealthCheck`, {
      headers: { 'X-API-VERSION': '1' },
    })
    return response.ok
  } catch {
    return false
  }
}

// ─── V2 — Tipos ──────────────────────────────────────────────────────────────

export interface ReservationGuest {
  mainGuest: boolean
  roomSequence: number
  name: string
  mainDoc?: string
  mainDocType?: 1 | 2 | 7  // 1=RG, 2=CPF, 7=Passaporte (presumido)
  gender?: 0 | 1
  contactMail?: string
  contactPhone?: string
  contactCellPhone?: string
  residesAbroad?: boolean
  addressZipCode?: string
  addressDetails?: string
  addressAddress?: string
  addressNeighborhood?: string
  addressNumber?: string
  addressCity?: string
  addressStateName?: string
  addressCountry?: string
}

export interface ReservationRoom {
  roomSequence: number
  roomTypeId: number
  roomId?: number
  ratePlanId: number
  checkIn: string  // ISO DateTime
  checkOut: string // ISO DateTime
  pax: number
  chd?: number
  roomDailyAmount: number
  roomRequirementAmount?: number
  chdAges?: { chdAge: number }[]
  dailies?: { date: string; value: number; dailyType: number }[]
  requirements?: { productId: number; productName: string; quantity: number; unitValue: number }[]
}

export interface ReservationRequest {
  reservationStatus: 1 | 4  // 1=Confirmada, 4=Cancelada
  reservationChannelId?: string
  reservationChannelName?: string
  reservationManagerId?: string
  reservationManagerName?: string
  reservationDailyAmount: number
  reservationFeeAmount: number
  reservationRequirementAmount: number
  groupName?: string
  companyId: number
  fees?: { feeType: 1 | 2 | 3; feeAmount: number }[]
  guests?: ReservationGuest[]
  rooms?: ReservationRoom[]
  notes?: { noteTypeId: number; note: string }[]
  payments?: { paymentTypeId: number; installment: number; amount: number; nsu?: string; numAuth?: string }[]
  commissions?: { entityId: number; percentage: number }[]
  revenueManagement?: { marketSegmentName?: string; purposeOfStay?: string; sourceChannelName?: string }
}

export interface SimpleReservationRequest {
  pax: number
  chd: number
  chdAges?: { chdAge: number }[]
  roomQuantity: number
  roomTypeId: number
  ratePlanId: number
  checkIn: string  // ISO DateTime
  checkOut: string // ISO DateTime
  mainGuestName?: string
  mainGuestContactPhone?: string
  mainGuestContactCellPhone?: string
  mainGuestContactEmail?: string
  valueForThePeriod: number
}

export interface ReservationResult {
  voucher: number
  warningMessages?: { message: string; field: string; value: string }[]
}

// ─── V2 — Reservas ───────────────────────────────────────────────────────────

/**
 * Cria uma reserva completa no HITS PMS.
 * POST /Datashare/V2/Bookings
 */
export async function createReservation(
  credentials: HitsCredentials,
  data: ReservationRequest
): Promise<ReservationResult> {
  return hitsRequest<ReservationResult>(
    credentials,
    '/Datashare/V2/Bookings',
    { method: 'POST', body: JSON.stringify(data) },
    '2'
  )
}

/**
 * Cria uma reserva simples (campos mínimos) no HITS PMS.
 * POST /Datashare/V2/Bookings/create-simple
 *
 * Ideal para o agente IA: apenas datas, tipo de quarto, tarifa e hóspede principal.
 */
export async function createSimpleReservation(
  credentials: HitsCredentials,
  data: SimpleReservationRequest
): Promise<ReservationResult> {
  // A API usa DateTime completo
  const payload = {
    ...data,
    checkIn: data.checkIn.includes('T') ? data.checkIn : `${data.checkIn}T14:00:00`,
    checkOut: data.checkOut.includes('T') ? data.checkOut : `${data.checkOut}T12:00:00`,
  }
  return hitsRequest<ReservationResult>(
    credentials,
    '/Datashare/V2/Bookings/create-simple',
    { method: 'POST', body: JSON.stringify(payload) },
    '2'
  )
}

/**
 * Atualiza uma reserva existente.
 * PUT /Datashare/V2/Bookings/{voucher}
 */
export async function updateReservation(
  credentials: HitsCredentials,
  voucher: number,
  data: ReservationRequest
): Promise<ReservationResult> {
  return hitsRequest<ReservationResult>(
    credentials,
    `/Datashare/V2/Bookings/${voucher}`,
    { method: 'PUT', body: JSON.stringify(data) },
    '2'
  )
}

/**
 * Cancela todos os apartamentos de uma reserva.
 * PATCH /Datashare/V2/Bookings/{voucher}/CancelAllReservation
 */
export async function cancelReservation(
  credentials: HitsCredentials,
  voucher: number
): Promise<number> {
  return hitsRequest<number>(
    credentials,
    `/Datashare/V2/Bookings/${voucher}/CancelAllReservation`,
    { method: 'PATCH' },
    '2'
  )
}

/**
 * Faz check-in de uma reserva (V2).
 * POST /Datashare/FoliosV2/{reservationId}/CheckIn
 */
export async function checkInReservationV2(
  credentials: HitsCredentials,
  reservationId: number
): Promise<unknown> {
  return hitsRequest<unknown>(
    credentials,
    `/Datashare/FoliosV2/${reservationId}/CheckIn`,
    { method: 'POST' },
    '2'
  )
}

// ─── V2 — Revenue Management ─────────────────────────────────────────────────

/**
 * Busca noites de hospedagem para revenue management.
 * GET /Datashare/V2/RevenueManagement/RoomingNights
 */
export async function getRevenueRoomingNights(
  credentials: HitsCredentials,
  params: { begin: string; end: string; page?: number; size?: number }
): Promise<unknown[]> {
  const query = new URLSearchParams({
    Begin: `${params.begin}T00:00:00`,
    End: `${params.end}T23:59:59`,
    ...(params.page !== undefined ? { Page: String(params.page) } : {}),
    ...(params.size !== undefined ? { Size: String(Math.min(params.size, 100)) } : {}),
  })
  const result = await hitsRequest<unknown>(
    credentials,
    `/Datashare/V2/RevenueManagement/RoomingNights?${query}`,
    {},
    '2'
  )
  if (Array.isArray(result)) return result
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>
    if (Array.isArray(r.data)) return r.data as unknown[]
    if (Array.isArray(r.items)) return r.items as unknown[]
  }
  return []
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-')
  return `${day}/${month}`
}
