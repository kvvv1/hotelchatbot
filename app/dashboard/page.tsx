'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, CheckCircle, Clock, TrendingUp, Bot, User } from 'lucide-react'
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
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [hotelId, setHotelId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('hotel_id')
        .eq('id', user.id)
        .single()

      if (!profile?.hotel_id) return
      setHotelId(profile.hotel_id)

      const { data } = await supabase
        .from('leads')
        .select('*')
        .eq('hotel_id', profile.hotel_id)
        .order('created_at', { ascending: false })

      setLeads((data as Lead[]) || [])
      setLoading(false)
    }

    load()
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
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400">Carregando métricas...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Visão Geral</h1>
        <p className="text-sm text-gray-500 mt-0.5">Métricas de atendimento e conversão</p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total de leads" value={metrics.total} icon={MessageSquare} color="bg-violet-500" />
        <MetricCard label="Reservas confirmadas" value={metrics.booked} icon={CheckCircle} color="bg-green-500" />
        <MetricCard label="Em andamento" value={metrics.inProgress} icon={Clock} color="bg-yellow-500" />
        <MetricCard
          label="Taxa de conversão"
          value={`${metrics.conversionRate}%`}
          icon={TrendingUp}
          color="bg-purple-500"
        />
      </div>

      {/* IA vs Humano */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <Bot className="w-5 h-5 text-violet-500" />
            <h3 className="font-medium text-gray-900">Atendidos pelo Agente</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{metrics.botHandled}</p>
          <p className="text-sm text-gray-500 mt-1">leads com agente ativo</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <User className="w-5 h-5 text-orange-500" />
            <h3 className="font-medium text-gray-900">Atendimento humano</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{metrics.humanHandled}</p>
          <p className="text-sm text-gray-500 mt-1">leads com humano ativo</p>
        </div>
      </div>

      {/* Leads recentes */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-medium text-gray-900">Leads recentes</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {recentLeads.length === 0 && (
            <p className="text-sm text-gray-400 px-5 py-8 text-center">Nenhum lead ainda</p>
          )}
          {recentLeads.map(lead => (
            <div key={lead.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{lead.guest_name || lead.guest_phone}</p>
                <p className="text-xs text-gray-400">{lead.guest_phone}</p>
              </div>
              <div className="flex items-center gap-2">
                {lead.bot_enabled
                  ? <Bot className="w-3.5 h-3.5 text-violet-500" />
                  : <User className="w-3.5 h-3.5 text-orange-500" />
                }
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  lead.stage === 'booked' ? 'bg-green-100 text-green-700' :
                  lead.stage === 'not_converted' ? 'bg-red-100 text-red-700' :
                  'bg-violet-100 text-violet-700'
                }`}>
                  {lead.stage.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
