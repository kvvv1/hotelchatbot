import type { HitsRoom } from '@/lib/hits/types'

export interface ManualInventoryRoom {
  roomTypeId?: number
  roomTypeCode?: string
  roomTypeName: string
  availableRooms?: number
  totalRooms?: number
  rate?: number
  currency?: string
}

export interface ManualInventorySnapshot {
  source: 'manual_csv'
  importedAt: string
  sourceFileName?: string | null
  checkIn?: string | null
  checkOut?: string | null
  rows: ManualInventoryRoom[]
}

export interface ManualInventoryImportResult {
  snapshot: ManualInventorySnapshot
  summary: {
    totalRows: number
    importedRoomTypes: number
    availableRoomTypes: number
  }
}

const ROOM_NAME_ALIASES = [
  'roomtypename',
  'tipodequarto',
  'tipoquarto',
  'roomtype',
  'acomodacao',
  'acomodação',
  'categoria',
  'roomname',
  'quarto',
  'tipo',
  'name',
]

const ROOM_CODE_ALIASES = [
  'roomtypecode',
  'codigotipodequarto',
  'codigodoquarto',
  'roomcode',
  'codigo',
  'code',
]

const AVAILABLE_ALIASES = [
  'availablerooms',
  'quartosdisponiveis',
  'apartamentosdisponiveis',
  'disponiveis',
  'disponiveisuh',
  'disponibilidade',
  'livres',
  'estoquedisponivel',
  'inventoryavailable',
  'available',
]

const TOTAL_ALIASES = [
  'totalrooms',
  'quartos',
  'apartamentos',
  'totais',
  'quantidade',
  'qtde',
  'total',
  'uhs',
]

const RATE_ALIASES = [
  'rate',
  'dailyrate',
  'valor',
  'valorfinal',
  'tarifa',
  'tarifario',
  'tarifamedia',
  'diaria',
  'diária',
  'price',
  'preco',
  'preço',
]

const CURRENCY_ALIASES = ['currency', 'moeda', 'curr']
const ROOM_TYPE_ID_ALIASES = ['roomtypeid', 'idtipodequarto', 'tipodequartoid']

function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function detectDelimiter(text: string): string {
  const firstLine = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => line.length > 0)

  if (!firstLine) return ','

  const candidates = [';', ',', '\t']
  let winner = ','
  let maxCount = -1

  for (const candidate of candidates) {
    const count = firstLine.split(candidate).length - 1
    if (count > maxCount) {
      maxCount = count
      winner = candidate
    }
  }

  return winner
}

function parseDelimitedText(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let currentCell = ''
  let currentRow: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && char === delimiter) {
      currentRow.push(currentCell.trim())
      currentCell = ''
      continue
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') i += 1
      currentRow.push(currentCell.trim())
      if (currentRow.some(cell => cell.length > 0)) rows.push(currentRow)
      currentRow = []
      currentCell = ''
      continue
    }

    currentCell += char
  }

  currentRow.push(currentCell.trim())
  if (currentRow.some(cell => cell.length > 0)) rows.push(currentRow)

  return rows
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  const normalizedHeaders = headers.map(normalizeHeader)
  const normalizedAliases = aliases.map(normalizeHeader)

  for (const alias of normalizedAliases) {
    const directIndex = normalizedHeaders.indexOf(alias)
    if (directIndex >= 0) return directIndex
  }

  for (let i = 0; i < normalizedHeaders.length; i += 1) {
    const header = normalizedHeaders[i]
    if (normalizedAliases.some(alias => header.includes(alias) || alias.includes(header))) {
      return i
    }
  }

  return -1
}

function parseLooseNumber(value: string): number | null {
  const text = String(value || '').trim()
  if (!text) return null

  const sanitized = text.replace(/[^\d,.\-]/g, '')
  if (!sanitized) return null

  let normalized = sanitized

  if (sanitized.includes(',') && sanitized.includes('.')) {
    normalized =
      sanitized.lastIndexOf(',') > sanitized.lastIndexOf('.')
        ? sanitized.replace(/\./g, '').replace(',', '.')
        : sanitized.replace(/,/g, '')
  } else if (sanitized.includes(',')) {
    normalized = sanitized.replace(',', '.')
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseLooseBoolean(value: string): boolean | null {
  const normalized = normalizeHeader(value)
  if (!normalized) return null
  if (['sim', 'yes', 'true', 'available', 'disponivel', 'livre', 'ok'].includes(normalized)) return true
  if (['nao', 'no', 'false', 'unavailable', 'indisponivel', 'ocupado'].includes(normalized)) return false
  return null
}

function cleanText(value: string | undefined): string | undefined {
  const text = String(value || '').trim()
  return text || undefined
}

export function importManualInventoryCsv(
  csvText: string,
  options?: { fileName?: string | null; checkIn?: string | null; checkOut?: string | null }
): ManualInventoryImportResult {
  const text = String(csvText || '').trim()
  if (!text) {
    throw new Error('Envie um CSV com os quartos exportados do PMS.')
  }

  const delimiter = detectDelimiter(text)
  const rows = parseDelimitedText(text, delimiter)

  if (rows.length < 2) {
    throw new Error('Não encontrei linhas suficientes no CSV. Verifique se o arquivo tem cabeçalho e dados.')
  }

  const [headers, ...dataRows] = rows
  const roomNameIndex = findColumnIndex(headers, ROOM_NAME_ALIASES)
  if (roomNameIndex < 0) {
    throw new Error('Não encontrei uma coluna de tipo/nome do quarto no CSV.')
  }

  const roomCodeIndex = findColumnIndex(headers, ROOM_CODE_ALIASES)
  const availableIndex = findColumnIndex(headers, AVAILABLE_ALIASES)
  const totalIndex = findColumnIndex(headers, TOTAL_ALIASES)
  const rateIndex = findColumnIndex(headers, RATE_ALIASES)
  const currencyIndex = findColumnIndex(headers, CURRENCY_ALIASES)
  const roomTypeIdIndex = findColumnIndex(headers, ROOM_TYPE_ID_ALIASES)

  const grouped = new Map<string, ManualInventoryRoom>()

  for (const row of dataRows) {
    const roomTypeName = cleanText(row[roomNameIndex])
    if (!roomTypeName) continue

    const roomTypeCode = cleanText(roomCodeIndex >= 0 ? row[roomCodeIndex] : undefined)
    const roomTypeId = roomTypeIdIndex >= 0 ? parseLooseNumber(row[roomTypeIdIndex]) ?? undefined : undefined
    let availableRooms = availableIndex >= 0 ? parseLooseNumber(row[availableIndex]) ?? undefined : undefined
    const availableFlag = availableIndex >= 0 ? parseLooseBoolean(row[availableIndex]) : null
    const totalRooms = totalIndex >= 0 ? parseLooseNumber(row[totalIndex]) ?? undefined : undefined
    const rate = rateIndex >= 0 ? parseLooseNumber(row[rateIndex]) ?? undefined : undefined
    const currency = cleanText(currencyIndex >= 0 ? row[currencyIndex] : undefined) || 'BRL'

    if (availableRooms === undefined && availableFlag !== null) {
      availableRooms = availableFlag ? totalRooms ?? 1 : 0
    }

    const key = normalizeHeader(roomTypeCode || roomTypeName)
    const existing = grouped.get(key)

    if (!existing) {
      grouped.set(key, {
        roomTypeId,
        roomTypeCode,
        roomTypeName,
        availableRooms,
        totalRooms,
        rate,
        currency,
      })
      continue
    }

    grouped.set(key, {
      roomTypeId: existing.roomTypeId ?? roomTypeId,
      roomTypeCode: existing.roomTypeCode ?? roomTypeCode,
      roomTypeName: existing.roomTypeName || roomTypeName,
      availableRooms:
        typeof existing.availableRooms === 'number' || typeof availableRooms === 'number'
          ? (existing.availableRooms ?? 0) + (availableRooms ?? 0)
          : undefined,
      totalRooms:
        typeof existing.totalRooms === 'number' || typeof totalRooms === 'number'
          ? (existing.totalRooms ?? 0) + (totalRooms ?? 0)
          : undefined,
      rate: existing.rate ?? rate,
      currency: existing.currency ?? currency,
    })
  }

  const importedRows = [...grouped.values()]
  if (importedRows.length === 0) {
    throw new Error('O CSV foi lido, mas nenhum tipo de quarto válido foi encontrado.')
  }

  const snapshot: ManualInventorySnapshot = {
    source: 'manual_csv',
    importedAt: new Date().toISOString(),
    sourceFileName: options?.fileName || null,
    checkIn: options?.checkIn || null,
    checkOut: options?.checkOut || null,
    rows: importedRows,
  }

  return {
    snapshot,
    summary: {
      totalRows: dataRows.length,
      importedRoomTypes: importedRows.length,
      availableRoomTypes: importedRows.filter(room => (room.availableRooms ?? 0) > 0).length,
    },
  }
}

export function getManualInventoryRooms(snapshot: ManualInventorySnapshot | null | undefined): ManualInventoryRoom[] {
  if (!snapshot || !Array.isArray(snapshot.rows)) return []
  return snapshot.rows.filter(room => room.roomTypeName)
}

export function mapManualInventoryToHitsRooms(snapshot: ManualInventorySnapshot | null | undefined): HitsRoom[] {
  return getManualInventoryRooms(snapshot).map(room => ({
    id: String(room.roomTypeId ?? room.roomTypeCode ?? room.roomTypeName),
    code: room.roomTypeCode || room.roomTypeName,
    name: room.roomTypeName,
    type: room.roomTypeCode || room.roomTypeName,
    maxGuests: 0,
    available: (room.availableRooms ?? 0) > 0,
    rate: room.rate ?? 0,
    currency: room.currency || 'BRL',
  }))
}

export function buildManualInventoryWarning(
  snapshot: ManualInventorySnapshot | null | undefined,
  requestedCheckIn: string,
  requestedCheckOut: string
): string | null {
  if (!snapshot) return null
  if (!snapshot.checkIn || !snapshot.checkOut) {
    return 'Dados vindos de importação manual. Confira se o CSV corresponde ao período consultado.'
  }
  if (snapshot.checkIn !== requestedCheckIn || snapshot.checkOut !== requestedCheckOut) {
    return `Snapshot manual importado para ${snapshot.checkIn} até ${snapshot.checkOut}.`
  }
  return null
}

export function filterRoomsBySearch(rooms: HitsRoom[], query?: string): HitsRoom[] {
  const normalizedQuery = normalizeHeader(String(query || ''))
  if (!normalizedQuery) return rooms

  return rooms.filter(room => {
    const haystack = normalizeHeader(`${room.name} ${room.code} ${room.type}`)
    return haystack.includes(normalizedQuery)
  })
}
