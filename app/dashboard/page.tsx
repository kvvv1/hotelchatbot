'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, CheckCircle, Clock, TrendingUp, Bot, User, AlertTriangle, Columns, ArrowRight } from 'lucide-react'
import type { Lead } from '@/lib/types/database'

interface Metrics {
  total: number
  booked: number
  inProgress: number
  notConverted: number
  conversionRate: number
  botHandled: number
  humanHandled: number
}

function MetricCard({ label, value, icon: Icon, color }: {
  label: string
  value: string | number
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs sm:text-sm text-gray-500 font-medium">{label}</p>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 bg-gray-200 rounded w-24" />
        <div className="w-8 h-8 bg-gray-200 rounded-lg" />
      </div>
      <div className="h-8 bg-gray-200 rounded w-16" />
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [noHotel, setNoHotel] = useState(false)
  const [hotelName, setHotelName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  async function createHotel(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotelName: hotelName.trim() || 'Meu Hotel' }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        setNoHotel(false)
        setLoading(true)
        load()
      } else {
        setCreateError(json.error || `Erro ${res.status} ao criar hotel`)
      }
    } catch (err) {
      setCreateError('Erro de conexão. Tente novamente.')
    } finally {
      setCreating(false)
    }
  }

  async function load() {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Usuário não autenticado')
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('hotel_id')
        .eq('id', user.id)
        .single()

      if (!profile?.hotel_id) {
        // Pre-fill from user metadata (full_name set during signup)
        const fullName = user.user_metadata?.full_name || ''
        if (fullName) setHotelName(fullName)
        setNoHotel(true)
        setLoading(false)
        return
      }

      const { data, error: fetchError } = await supabase
        .from('leads')
        .select('*')
        .eq('hotel_id', profile.hotel_id)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setLeads((data as Lead[]) || [])
    } catch (e) {
      setError('Erro ao carregar métricas')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const metrics: Metrics = {
    total: leads.length,
    booked: leads.filter(l => l.stage === 'booked').length,
    inProgress: leads.filter(l => !['booked', 'not_converted', 'closed'].includes(l.status) && l.stage !== 'not_converted').length,
    notConverted: leads.filter(l => l.stage === 'not_converted').length,
    conversionRate: leads.length > 0
      ? Math.round((leads.filter(l => l.stage === 'booked').length / leads.length) * 100)
      : 0,
    botHandled: leads.filter(l => l.bot_enabled).length,
    humanHandled: leads.filter(l => !l.bot_enabled).length,
  }

  const recentLeads = leads.slice(0, 8)

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <div>
          <div className="h-6 bg-gray-200 rounded w-32 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-52 mt-2 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-gray-500 text-sm">{error}</p>
        <button
          onClick={() => { setLoading(true); setError(null); load() }}
          className="text-sm text-violet-600 hover:underline"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  if (noHotel) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Configure seu hotel</h2>
          <p className="text-sm text-gray-500">Sua conta ainda não tem um hotel associado. Informe o nome para começar.</p>
        </div>
        <form onSubmit={createHotel} className="flex flex-col gap-3 w-full max-w-sm">
          <input
            type="text"
            value={hotelName}
            onChange={e => setHotelName(e.target.value)}
            placeholder="Nome do hotel"
            className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            required
          />
          {createError && (
            <p className="text-xs text-red-600 text-center font-medium">{createError}</p>
          )}
          <button
            type="submit"
            disabled={creating}
            className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-medium rounded-xl text-sm transition-colors"
          >
            {creating ? 'Criando...' : 'Criar hotel e continuar'}
          </button>
        </form>
      </div>
    )
  }

  const staleLeads = leads.filter(l =>
    l.last_message_at &&
    Date.now() - new Date(l.last_message_at).getTime() > 24 * 60 * 60 * 1000 &&
    l.status !== 'closed'
  )

  return (
    <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Visão Geral</h1>
          <p className="text-sm text-gray-500 mt-0.5">Métricas de atendimento e conversão</p>
        </div>
      </div>

      {/* Atalhos rápidos */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => router.push('/dashboard/atendimento')}
          className="flex items-center justify-between gap-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl p-4 transition-colors text-left"
        >
          <div>
            <p className="font-semibold text-sm">Atendimento</p>
            <p className="text-xs text-violet-200 mt-0.5">Ver conversas ativas</p>
          </div>
          <ArrowRight className="w-4 h-4 flex-shrink-0" />
        </button>
        <button
          onClick={() => router.push('/dashboard/leads')}
          className="flex items-center justify-between gap-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-900 rounded-xl p-4 shadow-sm transition-colors text-left"
        >
          <div>
            <p className="font-semibold text-sm">Kanban</p>
            <p className="text-xs text-gray-500 mt-0.5">Pipeline de leads</p>
          </div>
          <Columns className="w-4 h-4 flex-shrink-0 text-gray-400" />
        </button>
      </div>

      {/* Alerta leads parados */}
      {staleLeads.length > 0 && (
        <div
          onClick={() => router.push('/dashboard/atendimento')}
          className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 cursor-pointer hover:bg-amber-100 transition-colors"
        >
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800 font-medium">
            {staleLeads.length} lead{staleLeads.length > 1 ? 's' : ''} sem resposta há mais de 24h
          </p>
          <ArrowRight className="w-4 h-4 text-amber-500 ml-auto flex-shrink-0" />
        </div>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard label="Total de leads" value={metrics.total} icon={MessageSquare} color="bg-violet-500" />
        <MetricCard label="Reservas" value={metrics.booked} icon={CheckCircle} color="bg-green-500" />
        <MetricCard label="Em andamento" value={metrics.inProgress} icon={Clock} color="bg-yellow-500" />
        <MetricCard
          label="Conversão"
          value={`${metrics.conversionRate}%`}
          icon={TrendingUp}
          color="bg-purple-500"
        />
      </div>

      {/* IA vs Humano */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3 mb-3">
            <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-violet-500 flex-shrink-0" />
            <h3 className="font-medium text-gray-900 text-sm sm:text-base leading-tight">Atendidos pelo Agente</h3>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900">{metrics.botHandled}</p>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">leads com agente ativo</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3 mb-3">
            <User className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 flex-shrink-0" />
            <h3 className="font-medium text-gray-900 text-sm sm:text-base leading-tight">Atendimento humano</h3>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900">{metrics.humanHandled}</p>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">leads com humano ativo</p>
        </div>
      </div>

      {/* Leads recentes */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-gray-100">
          <h3 className="font-medium text-gray-900">Leads recentes</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {recentLeads.length === 0 && (
            <div className="flex flex-col items-center py-12 text-gray-400 gap-2">
              <MessageSquare className="w-8 h-8 opacity-30" />
              <p className="text-sm">Nenhum lead ainda</p>
              <p className="text-xs">Os leads aparecerão aqui quando chegarem mensagens via WhatsApp</p>
            </div>
          )}
          {recentLeads.map(lead => (
            <button
              key={lead.id}
              onClick={() => router.push(`/dashboard/atendimento?lead=${lead.id}`)}
              className="w-full px-4 sm:px-5 py-3 flex items-center justify-between gap-2 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{lead.guest_name || lead.guest_phone}</p>
                <p className="text-xs text-gray-400 truncate">{lead.guest_phone}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {lead.bot_enabled
                  ? <Bot className="w-3.5 h-3.5 text-violet-500" />
                  : <User className="w-3.5 h-3.5 text-orange-500" />
                }
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium hidden sm:inline ${
                  lead.stage === 'booked' ? 'bg-green-100 text-green-700' :
                  lead.stage === 'not_converted' ? 'bg-red-100 text-red-700' :
                  'bg-violet-100 text-violet-700'
                }`}>
                  {lead.stage.replace(/_/g, ' ')}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-300" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

