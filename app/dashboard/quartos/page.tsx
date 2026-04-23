'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  BedDouble,
  Calendar,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Loader2,
  Upload,
  Database,
  Trash2,
  Sparkles,
  Wallet,
  WavesLadder,
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

type TimelineDay = {
  label: string
  fullDate: string
}

type CalendarCell = {
  date: string
  currentMonth: boolean
}

type ViewTab = 'resumo' | 'agenda' | 'atualizacao'

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatDateBR(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function formatDateTimeBR(dateStr?: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

function isAvailableRoom(room: RoomAvailability): boolean {
  if (typeof room.available === 'boolean') return room.available
  if (typeof room.available === 'number') return room.available > 0
  if (typeof room.availableRooms === 'number') return room.availableRooms > 0
  return true
}

function getAvailableCount(room: RoomAvailability): number | null {
  if (typeof room.availableRooms === 'number') return room.availableRooms
  if (typeof room.available === 'number') return room.available
  return null
}

function getRate(room: RoomAvailability): number | null {
  return room.rate ?? room.price ?? null
}

function getRoomName(room: RoomAvailability): string {
  return String(room.roomTypeName || room.name || room.roomTypeCode || `Tipo ${room.roomTypeId ?? '?'}`)
}

function startOfMonth(monthKey: string): string {
  return `${monthKey}-01`
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

function buildCalendarCells(monthKey: string): CalendarCell[] {
  const monthStart = new Date(`${startOfMonth(monthKey)}T12:00:00`)
  const firstDay = new Date(monthStart)
  firstDay.setDate(1)

  const gridStart = new Date(firstDay)
  gridStart.setDate(firstDay.getDate() - firstDay.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(gridStart)
    current.setDate(gridStart.getDate() + index)
    const date = current.toISOString().slice(0, 10)
    return {
      date,
      currentMonth: current.getMonth() === monthStart.getMonth(),
    }
  })
}

export default function QuartosPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [checkIn, setCheckIn] = useState(today)
  const [checkOut, setCheckOut] = useState(addDays(today, 7))
  const [visibleMonth, setVisibleMonth] = useState(today.slice(0, 7))
  const [activeCalendarField, setActiveCalendarField] = useState<'checkIn' | 'checkOut'>('checkIn')
  const [activeTab, setActiveTab] = useState<ViewTab>('resumo')
  const [data, setData] = useState<RoomsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [clearingSnapshot, setClearingSnapshot] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [selectedRoomIndex, setSelectedRoomIndex] = useState(0)
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchRooms = useCallback(async (ci: string, co: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/rooms?checkIn=${ci}&checkOut=${co}`)
      const json = (await res.json()) as RoomsResponse & { error?: string }
      if (!res.ok) throw new Error(json.error || 'Erro ao buscar quartos')
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRooms(checkIn, checkOut)
  }, [fetchRooms]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setVisibleMonth(checkIn.slice(0, 7))
  }, [checkIn])

  const rooms = data?.availability ?? []
  const selectedRoom = rooms[selectedRoomIndex] ?? rooms[0] ?? null
  const availableRooms = rooms.filter(isAvailableRoom)
  const averageRate =
    availableRooms.length > 0
      ? availableRooms.reduce((total, room) => total + (getRate(room) ?? 0), 0) / availableRooms.length
      : 0
  const nights = Math.max(
    1,
    Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))
  )

  const timelineDays: TimelineDay[] = Array.from({ length: Math.min(nights, 7) }, (_, index) => {
    const date = addDays(checkIn, index)
    return {
      label: new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }),
      fullDate: formatDateBR(date),
    }
  })

  useEffect(() => {
    if (!rooms.length) {
      setSelectedRoomIndex(0)
      return
    }

    if (selectedRoomIndex > rooms.length - 1) setSelectedRoomIndex(0)
  }, [rooms.length, selectedRoomIndex])

  function shiftDates(days: number) {
    const newCI = addDays(checkIn, days)
    const newCO = addDays(checkOut, days)
    setCheckIn(newCI)
    setCheckOut(newCO)
    fetchRooms(newCI, newCO)
  }

  function handleSearch() {
    if (checkIn >= checkOut) return
    fetchRooms(checkIn, checkOut)
  }

  function applyStayPreset(nextNights: number) {
    const nextCheckOut = addDays(checkIn, nextNights)
    setCheckOut(nextCheckOut)
    fetchRooms(checkIn, nextCheckOut)
  }

  function handleCalendarDateClick(date: string) {
    if (date < today) return

    if (activeCalendarField === 'checkIn') {
      const nextCheckOut = date >= checkOut ? addDays(date, 1) : checkOut
      setCheckIn(date)
      setCheckOut(nextCheckOut)
      setActiveCalendarField('checkOut')
      return
    }

    if (date <= checkIn) {
      setCheckIn(date)
      setCheckOut(addDays(date, 1))
      setActiveCalendarField('checkOut')
      return
    }

    setCheckOut(date)
    setActiveCalendarField('checkIn')
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setImporting(true)
    setImportMessage(null)
    setImportError(null)

    try {
      const csvText = await file.text()
      const res = await fetch('/api/hotel/manual-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText,
          fileName: file.name,
          checkIn,
          checkOut,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Nao foi possivel importar o arquivo.')

      const summary = json.summary
      setImportMessage(
        `Atualizacao concluida: ${summary?.importedRoomTypes ?? 0} categoria(s) e ${summary?.availableRoomTypes ?? 0} com disponibilidade.`
      )
      await fetchRooms(checkIn, checkOut)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Erro ao atualizar disponibilidade.')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleClearSnapshot() {
    setClearingSnapshot(true)
    setImportMessage(null)
    setImportError(null)
    try {
      const res = await fetch('/api/hotel/manual-inventory', { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Nao foi possivel remover o arquivo.')
      setImportMessage('Atualizacao removida.')
      await fetchRooms(checkIn, checkOut)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Erro ao remover atualizacao.')
    } finally {
      setClearingSnapshot(false)
    }
  }

  function getOccupancyLevel(room: RoomAvailability): number {
    const availableCount = getAvailableCount(room)
    const total = room.totalRooms
    if (typeof availableCount !== 'number' || typeof total !== 'number' || total <= 0) return 0.65
    return Math.max(0.1, Math.min(0.95, 1 - availableCount / total))
  }

  function getTimelineOpacity(level: number, offset: number): number {
    return Math.min(0.95, Math.max(0.18, level - offset * 0.08 + 0.12))
  }

  const calendarCells = buildCalendarCells(visibleMonth)
  const selectedRoomOccupancy = selectedRoom ? getOccupancyLevel(selectedRoom) : 0.5
  const sourceBadge =
    data?.source === 'manual'
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : 'bg-emerald-100 text-emerald-800 border-emerald-200'

  const tabs: Array<{ id: ViewTab; label: string }> = [
    { id: 'resumo', label: 'Resumo' },
    { id: 'agenda', label: 'Agenda' },
    { id: 'atualizacao', label: 'Atualizacao' },
  ]

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <BedDouble className="w-5 h-5 text-violet-500" />
              Quartos & Disponibilidade
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Painel unico para consulta, agenda e atualizacao de disponibilidade.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {data?.source && (
              <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${sourceBadge}`}>
                <Database className="w-3.5 h-3.5" />
                {data.source === 'manual' ? 'Disponibilidade atualizada' : 'Disponibilidade online'}
              </span>
            )}

            <button
              onClick={() => fetchRooms(checkIn, checkOut)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>

        <div className="rounded-[30px] border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => shiftDates(-1)}
                    className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => shiftDates(1)}
                    className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1 font-medium">Check-in</label>
                  <input
                    type="date"
                    value={checkIn}
                    min={today}
                    onChange={e => setCheckIn(e.target.value)}
                    onFocus={() => setActiveCalendarField('checkIn')}
                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1 font-medium">Check-out</label>
                  <input
                    type="date"
                    value={checkOut}
                    min={addDays(checkIn, 1)}
                    onChange={e => setCheckOut(e.target.value)}
                    onFocus={() => setActiveCalendarField('checkOut')}
                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>

                <button
                  onClick={handleSearch}
                  disabled={loading || checkIn >= checkOut}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-medium rounded-xl text-sm transition-colors"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                  Consultar
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-violet-50 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-violet-500">Disponiveis</p>
                  <p className="text-xl font-semibold text-gray-900 mt-1">{availableRooms.length}</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-emerald-500">Media</p>
                  <p className="text-xl font-semibold text-gray-900 mt-1">R$ {averageRate > 0 ? averageRate.toFixed(0) : '0'}</p>
                </div>
                <div className="rounded-2xl bg-sky-50 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-sky-500">Janela</p>
                  <p className="text-xl font-semibold text-gray-900 mt-1">{nights} noites</p>
                </div>
                <div className="rounded-2xl bg-amber-50 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-amber-500">Periodo</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {formatDateBR(checkIn)} - {formatDateBR(checkOut)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-violet-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}

              <button
                type="button"
                onClick={() => selectedRoom && setIsRoomModalOpen(true)}
                disabled={!selectedRoom}
                className="rounded-full px-4 py-2 text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                Ver detalhes da categoria
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="p-4 sm:p-6">
              <div className="min-h-[540px] rounded-[28px] border border-gray-200 bg-gray-50/60 p-4">
                {activeTab === 'resumo' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {rooms.map((room, index) => {
                        const available = isAvailableRoom(room)
                        const count = getAvailableCount(room)
                        const rate = getRate(room)
                        return (
                          <button
                            key={`${getRoomName(room)}-${index}`}
                            type="button"
                            onClick={() => {
                              setSelectedRoomIndex(index)
                              setIsRoomModalOpen(true)
                            }}
                            className={`rounded-[24px] border bg-white p-5 text-left shadow-sm transition-all ${
                              index === selectedRoomIndex
                                ? 'border-violet-300 ring-2 ring-violet-100'
                                : 'border-gray-200 hover:border-violet-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${available ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-400'}`}>
                                  <BedDouble className="w-5 h-5" />
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900">{getRoomName(room)}</p>
                                  <p className="text-xs text-gray-500 mt-1">{room.roomTypeCode || 'Categoria'}</p>
                                </div>
                              </div>
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${available ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                {available ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                {available ? 'Disponivel' : 'Lotado'}
                              </span>
                            </div>

                            <div className="mt-5 flex items-end justify-between">
                              <div>
                                <p className="text-3xl font-semibold text-gray-900">R$ {(rate ?? 0).toFixed(2)}</p>
                                <p className="text-xs text-gray-400 mt-1">por noite</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-gray-900">
                                  {count !== null ? `${count} livre${count !== 1 ? 's' : ''}` : 'Sob consulta'}
                                </p>
                                <p className="text-xs text-violet-600 mt-1">Abrir modal</p>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {activeTab === 'agenda' && (
                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_220px] gap-4 h-full">
                    <div className="rounded-[24px] border border-gray-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Agenda interativa</p>
                          <p className="text-sm text-gray-500 mt-1">Selecione entrada e saida direto no calendario.</p>
                        </div>
                        <div className="inline-flex items-center rounded-full bg-gray-100 p-1">
                          <button
                            type="button"
                            onClick={() => setActiveCalendarField('checkIn')}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium ${activeCalendarField === 'checkIn' ? 'bg-violet-600 text-white' : 'text-gray-500'}`}
                          >
                            Entrada
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveCalendarField('checkOut')}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium ${activeCalendarField === 'checkOut' ? 'bg-violet-600 text-white' : 'text-gray-500'}`}
                          >
                            Saida
                          </button>
                        </div>
                      </div>

                      <div className="mt-5">
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setVisibleMonth(current => shiftMonth(current, -1))}
                            className="w-9 h-9 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors flex items-center justify-center"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <p className="text-sm font-semibold text-gray-900 capitalize">{formatMonthLabel(visibleMonth)}</p>
                          <button
                            type="button"
                            onClick={() => setVisibleMonth(current => shiftMonth(current, 1))}
                            className="w-9 h-9 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors flex items-center justify-center"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-7 gap-2 mt-4">
                          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map(day => (
                            <div key={day} className="text-center text-[11px] font-medium uppercase tracking-wide text-gray-400">
                              {day}
                            </div>
                          ))}

                          {calendarCells.map(cell => {
                            const isPast = cell.date < today
                            const isCheckIn = cell.date === checkIn
                            const isCheckOut = cell.date === checkOut
                            const inRange = cell.date > checkIn && cell.date < checkOut

                            return (
                              <button
                                key={cell.date}
                                type="button"
                                disabled={isPast}
                                onClick={() => handleCalendarDateClick(cell.date)}
                                className={`aspect-square rounded-2xl border text-sm transition-all ${
                                  isCheckIn || isCheckOut
                                    ? 'border-violet-600 bg-violet-600 text-white shadow-md'
                                    : inRange
                                      ? 'border-violet-200 bg-violet-50 text-violet-700'
                                      : cell.currentMonth
                                        ? 'border-gray-200 bg-white text-gray-700 hover:border-violet-200 hover:bg-violet-50'
                                        : 'border-transparent bg-gray-100 text-gray-300'
                                } ${isPast ? 'cursor-not-allowed opacity-40' : ''}`}
                              >
                                {Number(cell.date.slice(-2))}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-[24px] border border-gray-200 bg-white p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Selecao</p>
                        <div className="mt-4 space-y-2">
                          <div className="rounded-2xl bg-gray-50 px-4 py-3">
                            <p className="text-xs text-gray-400">Entrada</p>
                            <p className="text-lg font-semibold text-gray-900 mt-1">{formatDateBR(checkIn)}</p>
                          </div>
                          <div className="rounded-2xl bg-gray-50 px-4 py-3">
                            <p className="text-xs text-gray-400">Saida</p>
                            <p className="text-lg font-semibold text-gray-900 mt-1">{formatDateBR(checkOut)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-gray-200 bg-white p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Atalhos</p>
                        <div className="mt-4 grid gap-2">
                          {[2, 3, 5, 7].map(preset => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => applyStayPreset(preset)}
                              className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-left hover:border-violet-200 hover:bg-violet-50 transition-colors"
                            >
                              {preset} noite{preset !== 1 ? 's' : ''}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'atualizacao' && (
                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-4 h-full">
                    <div className="rounded-[24px] border border-dashed border-violet-300 bg-white p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Atualizacao de disponibilidade</p>
                          <p className="text-sm text-gray-500 mt-1">
                            Mantenha os dados da operacao sincronizados para a consulta comercial.
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,text/csv"
                            className="hidden"
                            onChange={handleImportFile}
                          />

                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={importing}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:bg-violet-300 transition-colors"
                          >
                            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            Atualizar arquivo
                          </button>

                          {data?.manualSnapshotAvailable && (
                            <button
                              type="button"
                              onClick={handleClearSnapshot}
                              disabled={clearingSnapshot}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                            >
                              {clearingSnapshot ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              Remover
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3">
                          <p className="text-xs uppercase tracking-wide text-gray-400">Origem</p>
                          <p className="text-sm font-medium text-gray-700 mt-1">{data?.importedFileName || 'Atualizacao interna'}</p>
                        </div>
                        <div className="rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3">
                          <p className="text-xs uppercase tracking-wide text-gray-400">Atualizado em</p>
                          <p className="text-sm font-medium text-gray-700 mt-1">{formatDateTimeBR(data?.importedAt)}</p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        {importMessage && (
                          <div className="flex items-start gap-2 rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>{importMessage}</span>
                          </div>
                        )}

                        {importError && (
                          <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                            <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>{importError}</span>
                          </div>
                        )}

                        {data?.manualWarning && (
                          <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>{data.manualWarning}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-gray-200 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Resumo</p>
                      <div className="mt-4 space-y-3">
                        <div className="rounded-2xl bg-violet-50 px-4 py-3">
                          <p className="text-xs text-violet-500">Categorias no painel</p>
                          <p className="text-lg font-semibold text-gray-900 mt-1">{rooms.length}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                          <p className="text-xs text-slate-500">Consulta atual</p>
                          <p className="text-lg font-semibold text-gray-900 mt-1">{formatDateBR(checkIn)} - {formatDateBR(checkOut)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <aside className="border-t xl:border-t-0 xl:border-l border-gray-100 bg-white/70 p-4 sm:p-5">
              <div className="rounded-[28px] bg-[#0f172a] text-white p-5 shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-violet-200/80">Destaque da consulta</p>
                    <h2 className="text-2xl font-semibold mt-2">{selectedRoom ? getRoomName(selectedRoom) : 'Sem categoria'}</h2>
                    <p className="text-sm text-slate-300 mt-2">
                      Painel rapido para leitura comercial da melhor opcao selecionada.
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-violet-200">
                    <WavesLadder className="w-5 h-5" />
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Tarifa</p>
                    <p className="text-2xl font-semibold mt-2">R$ {selectedRoom ? (getRate(selectedRoom) ?? 0).toFixed(0) : '0'}</p>
                  </div>
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Livres</p>
                    <p className="text-2xl font-semibold mt-2">
                      {selectedRoom ? getAvailableCount(selectedRoom) ?? (isAvailableRoom(selectedRoom) ? 1 : 0) : 0}
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-3xl bg-white/5 border border-white/10 p-4">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span>Ocupacao estimada</span>
                    <span>{Math.round(selectedRoomOccupancy * 100)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400"
                      style={{ width: `${Math.round(selectedRoomOccupancy * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="mt-5 rounded-3xl bg-gradient-to-br from-violet-500/20 via-fuchsia-500/10 to-sky-500/10 border border-violet-300/20 p-4">
                  <p className="text-sm font-medium text-white">Indicacao</p>
                  <p className="text-sm text-slate-200 mt-2 leading-relaxed">
                    {selectedRoom && isAvailableRoom(selectedRoom)
                      ? `Boa opcao para oferta imediata, com ${getAvailableCount(selectedRoom) ?? 'algumas'} unidade(s) disponivel(is).`
                      : 'Revise datas ou sugira outra categoria para manter a conversa avancando.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => selectedRoom && setIsRoomModalOpen(true)}
                  disabled={!selectedRoom}
                  className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-white text-slate-900 px-4 py-3 text-sm font-semibold hover:bg-slate-100 disabled:opacity-40 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Abrir detalhes completos
                </button>
              </div>
            </aside>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Erro ao buscar disponibilidade</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {loading && !data && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
                <div className="h-6 bg-gray-200 rounded w-1/2 mb-3" />
                <div className="h-3 bg-gray-200 rounded w-full mb-2" />
                <div className="h-3 bg-gray-200 rounded w-2/3" />
              </div>
            ))}
          </div>
        )}

        {data?.availabilityError && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-orange-700">
              Tivemos uma oscilacao na consulta automatica e exibimos a ultima atualizacao disponivel para manter a operacao em andamento.
            </p>
          </div>
        )}

        {data?.notConfigured && !data?.manualSnapshotAvailable && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900">Atualizacao de disponibilidade recomendada</p>
              <p className="text-sm text-amber-700 mt-1">
                Para manter a consulta mais precisa, envie uma atualizacao com os dados mais recentes da operacao.
              </p>
            </div>
          </div>
        )}

        {data && !data.notConfigured && rooms.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <BedDouble className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Sem disponibilidade para o periodo</p>
            <p className="text-sm text-gray-400 mt-1">Tente outras datas ou atualize a disponibilidade para uma nova consulta.</p>
          </div>
        )}
      </div>

      {isRoomModalOpen && selectedRoom && (
        <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center">
          <div className="w-full max-w-3xl rounded-[30px] bg-white shadow-2xl border border-gray-200 overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5 sm:p-6">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-violet-500">Detalhes da categoria</p>
                <h3 className="text-2xl font-semibold text-gray-900 mt-2">{getRoomName(selectedRoom)}</h3>
                <p className="text-sm text-gray-500 mt-2">
                  Visao consolidada da categoria para demonstracao, proposta e fechamento.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRoomModalOpen(false)}
                className="w-10 h-10 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
              >
                <span className="sr-only">Fechar</span>
                <XCircle className="w-5 h-5 mx-auto" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 p-5 sm:p-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-violet-50 p-4">
                    <p className="text-xs text-violet-500">Tarifa</p>
                    <p className="text-2xl font-semibold text-gray-900 mt-2">R$ {(getRate(selectedRoom) ?? 0).toFixed(2)}</p>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-4">
                    <p className="text-xs text-emerald-500">Livres</p>
                    <p className="text-2xl font-semibold text-gray-900 mt-2">
                      {getAvailableCount(selectedRoom) ?? (isAvailableRoom(selectedRoom) ? 1 : 0)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-sky-50 p-4 sm:col-span-1 col-span-2">
                    <p className="text-xs text-sky-500">Estadia</p>
                    <p className="text-2xl font-semibold text-gray-900 mt-2">{nights} noites</p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-gray-200 p-4">
                  <p className="text-sm font-semibold text-gray-900">Agenda resumida</p>
                  <div className="mt-4 overflow-x-auto">
                    <div className="min-w-[520px] grid grid-cols-[160px_repeat(7,minmax(48px,1fr))] gap-2">
                      <div className="rounded-2xl bg-gray-50 px-4 py-3">
                        <p className="font-medium text-gray-900">{getRoomName(selectedRoom)}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {getAvailableCount(selectedRoom) ?? 0} unidade(s) livre(s)
                        </p>
                      </div>

                      {Array.from({ length: 7 }, (_, offset) => (
                        <div
                          key={offset}
                          className="h-[76px] rounded-2xl border border-white/60 flex flex-col items-center justify-center p-2"
                          style={{
                            background: isAvailableRoom(selectedRoom)
                              ? `linear-gradient(180deg, rgba(139, 92, 246, ${getTimelineOpacity(selectedRoomOccupancy, offset)}) 0%, rgba(236, 72, 153, ${Math.max(0.15, getTimelineOpacity(selectedRoomOccupancy, offset) - 0.08)}) 100%)`
                              : 'linear-gradient(180deg, rgba(229, 231, 235, 0.95) 0%, rgba(209, 213, 219, 0.95) 100%)',
                          }}
                        >
                          <span className="text-[10px] font-medium text-white/90">{timelineDays[offset]?.label || '-'}</span>
                          <span className="mt-2 rounded-full bg-white/90 px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm">
                            {isAvailableRoom(selectedRoom) ? `${Math.max(1, Math.round((1 - selectedRoomOccupancy) * 10))} disp.` : 'Fechado'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] bg-[#0f172a] text-white p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center text-violet-200">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Janela atual</p>
                    <p className="font-semibold mt-1">{formatDateBR(checkIn)} - {formatDateBR(checkOut)}</p>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span>Ocupacao estimada</span>
                    <span>{Math.round(selectedRoomOccupancy * 100)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400"
                      style={{ width: `${Math.round(selectedRoomOccupancy * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="mt-5 rounded-3xl bg-white/5 border border-white/10 p-4">
                  <p className="text-sm font-medium">Indicacao comercial</p>
                  <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                    {isAvailableRoom(selectedRoom)
                      ? `Categoria pronta para oferta imediata, com boa leitura visual para a demo e disponibilidade atual.`
                      : 'Categoria com maior pressao no periodo. Vale usar esta visao para sugerir uma alternativa ao cliente.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsRoomModalOpen(false)}
                  className="mt-5 w-full rounded-2xl bg-white text-slate-900 px-4 py-3 text-sm font-semibold hover:bg-slate-100 transition-colors"
                >
                  Fechar detalhes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
