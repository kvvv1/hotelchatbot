'use client'

import { useState, useEffect, useCallback } from 'react'
import { BedDouble, Calendar, RefreshCw, AlertTriangle, ChevronLeft, ChevronRight, Settings, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'

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

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatDateBR(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
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

export default function QuartosPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [checkIn, setCheckIn] = useState(today)
  const [checkOut, setCheckOut] = useState(addDays(today, 7))
  const [data, setData] = useState<{ availability: RoomAvailability[]; checkIn: string; checkOut: string; availabilityError: string | null; notConfigured?: boolean } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRooms = useCallback(async (ci: string, co: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/rooms?checkIn=${ci}&checkOut=${co}`)
      const json = await res.json()
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  const nights = Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)))

  return (
    <div className="p-4 sm:p-6 max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <BedDouble className="w-5 h-5 text-violet-500" />
            Quartos & Disponibilidade
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Consulte disponibilidade em tempo real via HITS PMS</p>
        </div>
        <button
          onClick={() => fetchRooms(checkIn, checkOut)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Date picker */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => shiftDates(-1)}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => shiftDates(1)}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Check-in</label>
              <input
                type="date"
                value={checkIn}
                min={today}
                onChange={e => setCheckIn(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Check-out</label>
              <input
                type="date"
                value={checkOut}
                min={addDays(checkIn, 1)}
                onChange={e => setCheckOut(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading || checkIn >= checkOut}
              className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-medium rounded-lg text-sm transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
              Consultar
            </button>
          </div>
          {data && (
            <div className="ml-auto text-sm text-gray-500">
              <span className="font-medium text-gray-900">{nights}</span> noite{nights !== 1 ? 's' : ''} · {formatDateBR(checkIn)} → {formatDateBR(checkOut)}
            </div>
          )}
        </div>
      </div>

      {/* HITS não configurado */}
      {data?.notConfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-900">HITS PMS não configurado</p>
            <p className="text-sm text-amber-700 mt-1">Configure as credenciais do HITS PMS nas Configurações para visualizar quartos e disponibilidade em tempo real.</p>
            <Link href="/dashboard/configuracoes" className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-amber-800 hover:text-amber-900 underline-offset-4 hover:underline">
              <Settings className="w-3.5 h-3.5" />
              Ir para Configurações
            </Link>
          </div>
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Erro ao buscar disponibilidade</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-6 bg-gray-200 rounded w-1/2 mb-3" />
              <div className="h-3 bg-gray-200 rounded w-full mb-2" />
              <div className="h-3 bg-gray-200 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Erro da API HITS mas com aviso */}
      {data?.availabilityError && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-orange-700">HITS retornou erro: {data.availabilityError}</p>
        </div>
      )}

      {/* Grid de quartos */}
      {data && !data.notConfigured && (
        <>
          {data.availability.length === 0 && !loading ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <BedDouble className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Sem disponibilidade para o período</p>
              <p className="text-sm text-gray-400 mt-1">Tente outras datas ou verifique a integração HITS</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.availability.map((room, i) => {
                const available = isAvailableRoom(room)
                const count = getAvailableCount(room)
                const rate = getRate(room)
                const name = getRoomName(room)

                return (
                  <div
                    key={i}
                    className={`bg-white rounded-xl border shadow-sm p-5 transition-all ${
                      available ? 'border-gray-200 hover:border-violet-300 hover:shadow-md' : 'border-gray-100 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${available ? 'bg-violet-100' : 'bg-gray-100'}`}>
                          <BedDouble className={`w-4 h-4 ${available ? 'text-violet-600' : 'text-gray-400'}`} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm leading-tight">{name}</p>
                          {room.roomTypeCode && room.roomTypeCode !== name && (
                            <p className="text-[10px] text-gray-400">{room.roomTypeCode}</p>
                          )}
                        </div>
                      </div>
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {available
                          ? <CheckCircle className="w-3 h-3" />
                          : <XCircle className="w-3 h-3" />
                        }
                        {available ? 'Disponível' : 'Indisponível'}
                      </div>
                    </div>

                    {rate !== null && (
                      <div className="mb-3">
                        <p className="text-2xl font-bold text-gray-900">
                          R$ {rate.toFixed(2)}
                          <span className="text-sm font-normal text-gray-500">/noite</span>
                        </p>
                        {nights > 1 && (
                          <p className="text-xs text-gray-400 mt-0.5">Total: R$ {(rate * nights).toFixed(2)} · {nights} noites</p>
                        )}
                      </div>
                    )}

                    {count !== null && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <div className={`w-2 h-2 rounded-full ${count > 3 ? 'bg-green-400' : count > 0 ? 'bg-yellow-400' : 'bg-red-400'}`} />
                        {count > 0 ? `${count} quarto${count !== 1 ? 's' : ''} disponível` : 'Sem disponibilidade'}
                        {room.totalRooms ? ` / ${room.totalRooms} total` : ''}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <p className="text-xs text-gray-400 text-center">
            Dados obtidos do HITS PMS em tempo real · {data.availability.length} tipo{data.availability.length !== 1 ? 's' : ''} de quarto
          </p>
        </>
      )}
    </div>
  )
}
