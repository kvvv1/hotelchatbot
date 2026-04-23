'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BedDouble,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Database,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react'

interface RoomAvailability {
  roomTypeId?: number
  roomTypeCode?: string
  roomTypeName?: string
  name?: string
  available?: number | boolean
  availableRooms?: number
  totalRooms?: number
  rate?: number
  price?: number
  currency?: string
  [key: string]: unknown
}

interface RoomsResponse {
  availability: RoomAvailability[]
  checkIn: string
  checkOut: string
  availabilityError: string | null
  occupationError?: string | null
  notConfigured?: boolean
  source?: 'hits' | 'manual'
  manualSnapshotAvailable?: boolean
  importedAt?: string | null
  importedFileName?: string | null
  manualWarning?: string | null
}

type CalendarDay = {
  date: string
  label: string
  dayNumber: string
}

type PMSUnit = {
  id: string
  label: string
  typeCode: string
  typeName: string
  capacity: number
  rate: number
}

type ReservationStatus = 'pre_booking' | 'occupied'
type InventoryBlockType = 'blocked' | 'maintenance'
type Channel = 'WhatsApp' | 'Booking.com' | 'Site' | 'Recepcao'
type InventoryStatus = 'free' | 'blocked' | 'maintenance' | 'pre_booking' | 'occupied' | 'checkout'
type ComposerMode = 'reservation' | 'blocked' | 'maintenance'

type ReservationItem = {
  id: string
  unitId: string
  guestName: string
  start: string
  end: string
  status: ReservationStatus
  channel: Channel
  occupancy: number
}

type BlockItem = {
  id: string
  unitId: string
  start: string
  end: string
  type: InventoryBlockType
  reason: string
}

type ComposerState = {
  mode: ComposerMode
  unitId: string
  start: string
  end: string
  guestName: string
  channel: Channel
  occupancy: number
  reason: string
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function formatDateBR(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

function monthStart(monthKey: string): string {
  return `${monthKey}-01`
}

function nextMonth(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
}

function buildMonthDays(monthKey: string): CalendarDay[] {
  const start = new Date(`${monthStart(monthKey)}T12:00:00`)
  const end = new Date(`${nextMonth(monthKey)}-01T12:00:00`)
  const days: CalendarDay[] = []
  const cursor = new Date(start)

  while (cursor < end) {
    const date = cursor.toISOString().slice(0, 10)
    days.push({
      date,
      label: cursor.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
      dayNumber: String(cursor.getDate()).padStart(2, '0'),
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return days
}

function overlaps(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && startB < endA
}

function getRoomName(room: RoomAvailability): string {
  return String(room.roomTypeName || room.name || room.roomTypeCode || `Tipo ${room.roomTypeId ?? '?'}`)
}

function getRate(room: RoomAvailability): number {
  return Number(room.rate ?? room.price ?? 0)
}

function buildUnits(rooms: RoomAvailability[]): PMSUnit[] {
  const units: PMSUnit[] = []

  rooms.forEach((room, roomIndex) => {
    const typeCode = String(room.roomTypeCode || `CAT${roomIndex + 1}`)
    const typeName = getRoomName(room)
    const totalRooms = typeof room.totalRooms === 'number' && room.totalRooms > 0 ? room.totalRooms : 3
    const unitCount = Math.min(Math.max(totalRooms, 2), 5)
    const capacity = /familia|family/i.test(typeName) ? 4 : /chale|suite/i.test(typeName) ? 3 : 2
    const baseNumber = 100 + roomIndex * 10

    for (let index = 0; index < unitCount; index += 1) {
      units.push({
        id: `${typeCode}-${index + 1}`,
        label: `${baseNumber + index + 1}`,
        typeCode,
        typeName,
        capacity,
        rate: getRate(room),
      })
    }
  })

  return units
}

function buildDemoInventory(units: PMSUnit[], monthKey: string) {
  const reservations: ReservationItem[] = []
  const blocks: BlockItem[] = []
  const channels: Channel[] = ['WhatsApp', 'Booking.com', 'Site', 'Recepcao']
  const start = monthStart(monthKey)

  units.forEach((unit, index) => {
    const channel = channels[index % channels.length]
    const offset = (index % 5) * 3

    reservations.push({
      id: `res-${unit.id}-1`,
      unitId: unit.id,
      guestName: ['Juliana Castro', 'Rafael Mendes', 'Patricia Nunes', 'Marcelo Pires', 'Camila Rocha'][index % 5],
      start: addDays(start, offset + 1),
      end: addDays(start, offset + 4),
      status: index % 3 === 0 ? 'pre_booking' : 'occupied',
      channel,
      occupancy: Math.min(unit.capacity, index % unit.capacity + 1),
    })

    if (index % 2 === 0) {
      reservations.push({
        id: `res-${unit.id}-2`,
        unitId: unit.id,
        guestName: ['Grupo Serra', 'Daniel Alves', 'Carla Souza', 'Familia Lima'][index % 4],
        start: addDays(start, offset + 11),
        end: addDays(start, offset + 15),
        status: 'occupied',
        channel: channels[(index + 1) % channels.length],
        occupancy: Math.min(unit.capacity, Math.max(2, unit.capacity - 1)),
      })
    }

    if (index % 4 === 0) {
      blocks.push({
        id: `block-${unit.id}-1`,
        unitId: unit.id,
        start: addDays(start, offset + 18),
        end: addDays(start, offset + 20),
        type: 'maintenance',
        reason: 'Revisao preventiva',
      })
    }

    if (index % 5 === 1) {
      blocks.push({
        id: `block-${unit.id}-2`,
        unitId: unit.id,
        start: addDays(start, offset + 22),
        end: addDays(start, offset + 24),
        type: 'blocked',
        reason: 'Bloqueio operacional',
      })
    }
  })

  return { reservations, blocks }
}

function defaultComposer(unitId: string, start: string, end: string): ComposerState {
  return {
    mode: 'reservation',
    unitId,
    start,
    end,
    guestName: '',
    channel: 'WhatsApp',
    occupancy: 2,
    reason: '',
  }
}

export default function QuartosPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [visibleMonth, setVisibleMonth] = useState(today.slice(0, 7))
  const [data, setData] = useState<RoomsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [units, setUnits] = useState<PMSUnit[]>([])
  const [reservations, setReservations] = useState<ReservationItem[]>([])
  const [blocks, setBlocks] = useState<BlockItem[]>([])
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [occupancyFilter, setOccupancyFilter] = useState('all')
  const [channelFilter, setChannelFilter] = useState('all')
  const [draggingReservationId, setDraggingReservationId] = useState<string | null>(null)
  const [composer, setComposer] = useState<ComposerState>(defaultComposer('', today, addDays(today, 1)))
  const [composerMessage, setComposerMessage] = useState<string | null>(null)

  const fetchRooms = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const start = monthStart(visibleMonth)
      const end = monthStart(nextMonth(visibleMonth))
      const res = await fetch(`/api/rooms?checkIn=${start}&checkOut=${end}`)
      const json = (await res.json()) as RoomsResponse & { error?: string }
      if (!res.ok) throw new Error(json.error || 'Erro ao buscar quartos')
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [visibleMonth])

  useEffect(() => {
    fetchRooms()
  }, [fetchRooms])

  useEffect(() => {
    if (!data?.availability?.length) return

    const nextUnits = buildUnits(data.availability)
    const nextInventory = buildDemoInventory(nextUnits, visibleMonth)
    setUnits(nextUnits)
    setReservations(nextInventory.reservations)
    setBlocks(nextInventory.blocks)
    setSelectedUnitId(nextUnits[0]?.id || '')
    setComposer(defaultComposer(nextUnits[0]?.id || '', monthStart(visibleMonth), addDays(monthStart(visibleMonth), 1)))
    setComposerMessage(null)
  }, [data, visibleMonth])

  const days = useMemo(() => buildMonthDays(visibleMonth), [visibleMonth])
  const sourceBadge =
    data?.source === 'manual'
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : 'bg-emerald-100 text-emerald-800 border-emerald-200'

  const roomTypeOptions = useMemo(
    () => Array.from(new Set(units.map(unit => unit.typeCode))).sort(),
    [units]
  )

  const filteredUnits = useMemo(() => {
    return units.filter(unit => {
      const byType = typeFilter === 'all' || unit.typeCode === typeFilter
      const byOccupancy = occupancyFilter === 'all' || unit.capacity >= Number(occupancyFilter)
      const byChannel =
        channelFilter === 'all' ||
        reservations.some(reservation => reservation.unitId === unit.id && reservation.channel === channelFilter)

      return byType && byOccupancy && byChannel
    })
  }, [channelFilter, occupancyFilter, reservations, typeFilter, units])

  const selectedUnit = filteredUnits.find(unit => unit.id === selectedUnitId) || filteredUnits[0] || units[0] || null

  useEffect(() => {
    if (!selectedUnit) return
    setSelectedUnitId(selectedUnit.id)
    setComposer(current => ({ ...current, unitId: current.unitId || selectedUnit.id }))
  }, [selectedUnit])

  const currentGuests = useMemo(
    () =>
      reservations.filter(
        reservation => reservation.status === 'occupied' && reservation.start <= today && reservation.end > today
      ),
    [reservations, today]
  )

  const upcomingArrivals = useMemo(
    () =>
      reservations
        .filter(reservation => reservation.start >= today)
        .sort((a, b) => a.start.localeCompare(b.start))
        .slice(0, 6),
    [reservations, today]
  )

  const getUnitStatus = useCallback(
    (unitId: string, date: string): InventoryStatus => {
      const block = blocks.find(item => item.unitId === unitId && item.start <= date && item.end > date)
      if (block) return block.type

      const checkoutReservation = reservations.find(
        item => item.unitId === unitId && item.end === date && item.status === 'occupied'
      )
      if (checkoutReservation) return 'checkout'

      const reservation = reservations.find(
        item => item.unitId === unitId && item.start <= date && item.end > date
      )
      if (!reservation) return 'free'
      return reservation.status
    },
    [blocks, reservations]
  )

  const alerts = useMemo(() => {
    const nextAlerts: string[] = []

    filteredUnits.forEach(unit => {
      const unitReservations = reservations.filter(reservation => reservation.unitId === unit.id)
      const unitBlocks = blocks.filter(block => block.unitId === unit.id)

      unitReservations.forEach((reservation, reservationIndex) => {
        unitReservations.slice(reservationIndex + 1).forEach(otherReservation => {
          if (overlaps(reservation.start, reservation.end, otherReservation.start, otherReservation.end)) {
            nextAlerts.push(`Conflito de reserva no quarto ${unit.label}.`)
          }
        })

        unitBlocks.forEach(block => {
          if (overlaps(reservation.start, reservation.end, block.start, block.end)) {
            nextAlerts.push(`Reserva sobreposta a ${block.type === 'maintenance' ? 'manutencao' : 'bloqueio'} no quarto ${unit.label}.`)
          }
        })
      })
    })

    roomTypeOptions.forEach(typeCode => {
      const typeUnits = filteredUnits.filter(unit => unit.typeCode === typeCode)
      const totalUnits = typeUnits.length
      if (!totalUnits) return

      days.forEach(day => {
        const busyUnits = typeUnits.filter(unit => {
          const status = getUnitStatus(unit.id, day.date)
          return status !== 'free' && status !== 'checkout'
        }).length

        if (busyUnits > totalUnits) {
          nextAlerts.push(`Overbooking detectado em ${typeCode} no dia ${formatDateBR(day.date)}.`)
        } else if (busyUnits === totalUnits) {
          nextAlerts.push(`Categoria ${typeCode} lotada em ${formatDateBR(day.date)}.`)
        }
      })
    })

    return Array.from(new Set(nextAlerts)).slice(0, 8)
  }, [blocks, days, filteredUnits, getUnitStatus, reservations, roomTypeOptions])

  function getStatusStyles(status: InventoryStatus): string {
    if (status === 'blocked') return 'bg-slate-200'
    if (status === 'maintenance') return 'bg-amber-200'
    if (status === 'pre_booking') return 'bg-violet-100'
    if (status === 'occupied') return 'bg-emerald-100'
    if (status === 'checkout') return 'bg-sky-100'
    return 'bg-white'
  }

  function getReservationSpan(reservation: ReservationItem) {
    const startIndex = days.findIndex(day => day.date === reservation.start)
    const endIndex = days.findIndex(day => day.date === reservation.end)
    const fallbackEnd = endIndex === -1 ? days.length : endIndex
    if (startIndex === -1) return null
    return {
      columnStart: startIndex + 2,
      span: Math.max(1, fallbackEnd - startIndex),
    }
  }

  function handleCellClick(unitId: string, date: string) {
    setSelectedUnitId(unitId)
    setComposer(current => ({
      ...current,
      unitId,
      start: date,
      end: addDays(date, 1),
    }))
    setComposerMessage(null)
  }

  function handleQuickMode(mode: ComposerMode) {
    setComposer(current => ({ ...current, mode }))
    setComposerMessage(null)
  }

  function handleCreateInventoryItem() {
    if (!composer.unitId || !composer.start || !composer.end || composer.start >= composer.end) {
      setComposerMessage('Confira unidade e datas antes de salvar.')
      return
    }

    if (composer.mode === 'reservation' && !composer.guestName.trim()) {
      setComposerMessage('Informe o nome do hospede para criar a reserva.')
      return
    }

    if (composer.mode === 'reservation') {
      setReservations(current => [
        {
          id: `res-custom-${Date.now()}`,
          unitId: composer.unitId,
          guestName: composer.guestName.trim(),
          start: composer.start,
          end: composer.end,
          status: 'pre_booking',
          channel: composer.channel,
          occupancy: composer.occupancy,
        },
        ...current,
      ])
      setComposerMessage('Reserva criada no calendario.')
    } else {
      setBlocks(current => [
        {
          id: `block-custom-${Date.now()}`,
          unitId: composer.unitId,
          start: composer.start,
          end: composer.end,
          type: composer.mode === 'maintenance' ? 'maintenance' : 'blocked',
          reason: composer.reason.trim() || (composer.mode === 'maintenance' ? 'Manutencao preventiva' : 'Bloqueio manual'),
        },
        ...current,
      ])
      setComposerMessage(composer.mode === 'maintenance' ? 'Manutencao registrada.' : 'Bloqueio manual aplicado.')
    }
  }

  function handleReservationDrop(targetUnitId: string, targetDate: string) {
    if (!draggingReservationId) return

    setReservations(current =>
      current.map(item => {
        if (item.id !== draggingReservationId) return item
        const duration =
          Math.max(
            1,
            Math.ceil(
              (new Date(`${item.end}T12:00:00`).getTime() - new Date(`${item.start}T12:00:00`).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          )

        return {
          ...item,
          unitId: targetUnitId,
          start: targetDate,
          end: addDays(targetDate, duration),
        }
      })
    )
    setDraggingReservationId(null)
    setComposerMessage('Reserva reposicionada no calendario.')
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-[1600px] h-[calc(100vh-96px)] min-h-[760px] flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <BedDouble className="w-5 h-5 text-violet-500" />
              Mapa de Quartos
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Visao operacional por unidade, com reservas, bloqueios e agenda mensal em estilo PMS.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {data?.source && (
              <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${sourceBadge}`}>
                <Database className="w-3.5 h-3.5" />
                {data.source === 'manual' ? 'Disponibilidade atualizada' : 'Disponibilidade online'}
              </span>
            )}

            <button
              type="button"
              onClick={() => fetchRooms()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 rounded-[32px] border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVisibleMonth(current => shiftMonth(current, -1))}
                  className="w-10 h-10 rounded-2xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 min-w-[220px] text-center">
                  <p className="text-xs uppercase tracking-[0.22em] text-gray-400">Calendario mensal</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1 capitalize">{formatMonthLabel(visibleMonth)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setVisibleMonth(current => shiftMonth(current, 1))}
                  className="w-10 h-10 rounded-2xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={typeFilter}
                  onChange={event => setTypeFilter(event.target.value)}
                  className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <option value="all">Todos os tipos</option>
                  {roomTypeOptions.map(typeCode => (
                    <option key={typeCode} value={typeCode}>
                      {typeCode}
                    </option>
                  ))}
                </select>

                <select
                  value={occupancyFilter}
                  onChange={event => setOccupancyFilter(event.target.value)}
                  className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <option value="all">Qualquer ocupacao</option>
                  <option value="2">2+ hospedes</option>
                  <option value="3">3+ hospedes</option>
                  <option value="4">4+ hospedes</option>
                </select>

                <select
                  value={channelFilter}
                  onChange={event => setChannelFilter(event.target.value)}
                  className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <option value="all">Todos os canais</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Booking.com">Booking.com</option>
                  <option value="Site">Site</option>
                  <option value="Recepcao">Recepcao</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                <CheckCircle className="w-3.5 h-3.5" />
                Livre / checkout liberado
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-3 py-1 text-violet-700">
                <Calendar className="w-3.5 h-3.5" />
                Pre-reserva
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                <Lock className="w-3.5 h-3.5" />
                Bloqueado
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-amber-700">
                <Wrench className="w-3.5 h-3.5" />
                Manutencao
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] h-[calc(100%-132px)]">
            <div className="min-h-0 overflow-auto bg-gray-50/60">
              {loading && !units.length ? (
                <div className="h-full flex items-center justify-center text-gray-400 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Carregando grade de quartos...</span>
                </div>
              ) : filteredUnits.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
                  <BedDouble className="w-10 h-10 opacity-30" />
                  <p>Nenhuma unidade encontrada para os filtros atuais.</p>
                </div>
              ) : (
                <div className="min-w-[1650px]">
                  <div
                    className="sticky top-0 z-20 grid border-b border-gray-200 bg-white"
                    style={{ gridTemplateColumns: `220px repeat(${days.length}, minmax(44px, 1fr))` }}
                  >
                    <div className="sticky left-0 z-20 border-r border-gray-200 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.22em] text-gray-400">Unidade</p>
                    </div>
                    {days.map(day => (
                      <div key={day.date} className="border-r border-gray-100 px-1 py-3 text-center">
                        <p className="text-[10px] uppercase tracking-wide text-gray-400">{day.label}</p>
                        <p className="text-sm font-semibold text-gray-900 mt-1">{day.dayNumber}</p>
                      </div>
                    ))}
                  </div>

                  <div className="divide-y divide-gray-200">
                    {filteredUnits.map(unit => {
                      const unitReservations = reservations.filter(reservation => reservation.unitId === unit.id)
                      const unitBlocks = blocks.filter(block => block.unitId === unit.id)

                      return (
                        <div
                          key={unit.id}
                          className="grid items-stretch relative bg-white"
                          style={{ gridTemplateColumns: `220px repeat(${days.length}, minmax(44px, 1fr))` }}
                        >
                          <div
                            className={`sticky left-0 z-10 border-r border-gray-200 px-4 py-3 bg-white ${
                              selectedUnitId === unit.id ? 'bg-violet-50' : ''
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedUnitId(unit.id)
                                setComposer(current => ({ ...current, unitId: unit.id }))
                              }}
                              className="text-left w-full"
                            >
                              <p className="font-semibold text-gray-900">Quarto {unit.label}</p>
                              <p className="text-xs text-gray-500 mt-1">{unit.typeName}</p>
                              <p className="text-xs text-gray-400 mt-1">{unit.capacity} hospedes • R$ {unit.rate.toFixed(0)}</p>
                            </button>
                          </div>

                          {days.map(day => (
                            <button
                              key={`${unit.id}-${day.date}`}
                              type="button"
                              onClick={() => handleCellClick(unit.id, day.date)}
                              onDragOver={event => event.preventDefault()}
                              onDrop={() => handleReservationDrop(unit.id, day.date)}
                              className={`h-[58px] border-r border-gray-100 border-b border-b-transparent transition-colors ${getStatusStyles(
                                getUnitStatus(unit.id, day.date)
                              )} hover:ring-1 hover:ring-violet-200`}
                            />
                          ))}

                          {unitBlocks.map(block => {
                            const span = getReservationSpan({
                              id: block.id,
                              unitId: block.unitId,
                              guestName: block.reason,
                              start: block.start,
                              end: block.end,
                              status: 'pre_booking',
                              channel: 'Recepcao',
                              occupancy: 0,
                            })

                            if (!span) return null

                            return (
                              <div
                                key={block.id}
                                className={`z-10 mt-2 mb-2 mx-1 rounded-2xl px-3 py-2 text-xs font-medium text-center ${
                                  block.type === 'maintenance'
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-slate-700 text-white'
                                }`}
                                style={{ gridColumn: `${span.columnStart} / span ${span.span}`, gridRow: 1 }}
                              >
                                {block.type === 'maintenance' ? 'Manutencao' : 'Bloqueado'}
                              </div>
                            )
                          })}

                          {unitReservations.map(reservation => {
                            const span = getReservationSpan(reservation)
                            if (!span) return null

                            return (
                              <button
                                key={reservation.id}
                                type="button"
                                draggable
                                onDragStart={() => setDraggingReservationId(reservation.id)}
                                onDragEnd={() => setDraggingReservationId(null)}
                                onClick={() => {
                                  setSelectedUnitId(unit.id)
                                  setComposer(current => ({
                                    ...current,
                                    mode: 'reservation',
                                    unitId: unit.id,
                                    start: reservation.start,
                                    end: reservation.end,
                                    guestName: reservation.guestName,
                                    channel: reservation.channel,
                                    occupancy: reservation.occupancy,
                                  }))
                                  setComposerMessage(`Reserva de ${reservation.guestName} carregada para edicao visual.`)
                                }}
                                className={`z-20 mt-2 mb-2 mx-1 rounded-2xl px-3 py-2 text-left text-xs shadow-sm ${
                                  reservation.status === 'occupied'
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-violet-500 text-white'
                                }`}
                                style={{ gridColumn: `${span.columnStart} / span ${span.span}`, gridRow: 1 }}
                              >
                                <span className="block font-semibold truncate">{reservation.guestName}</span>
                                <span className="block opacity-90 mt-0.5">
                                  {reservation.channel} • {reservation.occupancy} hosp.
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <aside className="border-t xl:border-t-0 xl:border-l border-gray-200 bg-white min-h-0 overflow-auto">
              <div className="p-4 sm:p-5 space-y-4">
                <div className="rounded-[28px] border border-gray-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Criar direto na tela</p>
                      <p className="text-sm text-gray-500 mt-1">Reserva, bloqueio manual ou manutencao.</p>
                    </div>
                    <Plus className="w-4 h-4 text-violet-500" />
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => handleQuickMode('reservation')}
                      className={`rounded-2xl px-3 py-2 text-xs font-medium transition-colors ${
                        composer.mode === 'reservation' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      Reserva
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickMode('blocked')}
                      className={`rounded-2xl px-3 py-2 text-xs font-medium transition-colors ${
                        composer.mode === 'blocked' ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      Bloqueio
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickMode('maintenance')}
                      className={`rounded-2xl px-3 py-2 text-xs font-medium transition-colors ${
                        composer.mode === 'maintenance' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      Manutencao
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 mt-4">
                    <select
                      value={composer.unitId}
                      onChange={event => setComposer(current => ({ ...current, unitId: event.target.value }))}
                      className="rounded-2xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                    >
                      {units.map(unit => (
                        <option key={unit.id} value={unit.id}>
                          Quarto {unit.label} • {unit.typeName}
                        </option>
                      ))}
                    </select>

                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="date"
                        value={composer.start}
                        onChange={event => setComposer(current => ({ ...current, start: event.target.value }))}
                        className="rounded-2xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                      />
                      <input
                        type="date"
                        value={composer.end}
                        min={addDays(composer.start, 1)}
                        onChange={event => setComposer(current => ({ ...current, end: event.target.value }))}
                        className="rounded-2xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                      />
                    </div>

                    {composer.mode === 'reservation' ? (
                      <>
                        <input
                          type="text"
                          value={composer.guestName}
                          onChange={event => setComposer(current => ({ ...current, guestName: event.target.value }))}
                          placeholder="Nome do hospede"
                          className="rounded-2xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <select
                            value={composer.channel}
                            onChange={event => setComposer(current => ({ ...current, channel: event.target.value as Channel }))}
                            className="rounded-2xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                          >
                            <option value="WhatsApp">WhatsApp</option>
                            <option value="Booking.com">Booking.com</option>
                            <option value="Site">Site</option>
                            <option value="Recepcao">Recepcao</option>
                          </select>
                          <select
                            value={composer.occupancy}
                            onChange={event => setComposer(current => ({ ...current, occupancy: Number(event.target.value) }))}
                            className="rounded-2xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                          >
                            <option value={1}>1 hospede</option>
                            <option value={2}>2 hospedes</option>
                            <option value={3}>3 hospedes</option>
                            <option value={4}>4 hospedes</option>
                          </select>
                        </div>
                      </>
                    ) : (
                      <input
                        type="text"
                        value={composer.reason}
                        onChange={event => setComposer(current => ({ ...current, reason: event.target.value }))}
                        placeholder={composer.mode === 'maintenance' ? 'Motivo da manutencao' : 'Motivo do bloqueio'}
                        className="rounded-2xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                      />
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleCreateInventoryItem}
                    className="mt-4 w-full rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
                  >
                    {composer.mode === 'reservation' ? 'Criar reserva' : composer.mode === 'maintenance' ? 'Registrar manutencao' : 'Aplicar bloqueio'}
                  </button>

                  {composerMessage && <p className="mt-3 text-xs text-violet-600 font-medium">{composerMessage}</p>}
                </div>

                <div className="rounded-[28px] border border-gray-200 p-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <p className="text-sm font-semibold text-gray-900">Alertas operacionais</p>
                  </div>
                  <div className="mt-4 space-y-2">
                    {alerts.length === 0 ? (
                      <p className="text-sm text-gray-500">Sem conflitos criticos nesta janela.</p>
                    ) : (
                      alerts.map(alert => (
                        <div key={alert} className="rounded-2xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                          {alert}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-[28px] border border-gray-200 p-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-500" />
                    <p className="text-sm font-semibold text-gray-900">Hospedes atuais</p>
                  </div>
                  <div className="mt-4 space-y-2">
                    {currentGuests.length === 0 ? (
                      <p className="text-sm text-gray-500">Nenhuma hospedagem ativa hoje.</p>
                    ) : (
                      currentGuests.slice(0, 5).map(guest => {
                        const unit = units.find(item => item.id === guest.unitId)
                        return (
                          <div key={guest.id} className="rounded-2xl bg-gray-50 px-3 py-3">
                            <p className="text-sm font-semibold text-gray-900">{guest.guestName}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Quarto {unit?.label || guest.unitId} • ate {formatDateBR(guest.end)}
                            </p>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                <div className="rounded-[28px] border border-gray-200 p-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-500" />
                    <p className="text-sm font-semibold text-gray-900">Chegadas e reservas</p>
                  </div>
                  <div className="mt-4 space-y-2">
                    {upcomingArrivals.map(arrival => {
                      const unit = units.find(item => item.id === arrival.unitId)
                      return (
                        <div key={arrival.id} className="rounded-2xl bg-gray-50 px-3 py-3">
                          <p className="text-sm font-semibold text-gray-900">{arrival.guestName}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDateBR(arrival.start)} • Quarto {unit?.label || arrival.unitId} • {arrival.channel}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {data?.availabilityError && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Tivemos uma oscilacao na consulta automatica e exibimos a ultima atualizacao disponivel para manter a operacao em andamento.
          </div>
        )}
      </div>
    </div>
  )
}


