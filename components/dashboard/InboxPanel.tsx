'use client'

import { useState, useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Bot, User, Search } from 'lucide-react'
import type { Lead } from '@/lib/types/database'

interface InboxPanelProps {
  leads: Lead[]
  selectedId: string | null
  onSelect: (lead: Lead) => void
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativa',
  waiting_guest: 'Aguardando',
  waiting_human: 'Aguard. humano',
  human_active: 'Humano ativo',
  closed: 'Encerrada',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  waiting_guest: 'bg-yellow-100 text-yellow-700',
  waiting_human: 'bg-red-100 text-red-700',
  human_active: 'bg-violet-100 text-violet-700',
  closed: 'bg-gray-100 text-gray-600',
}

export function InboxPanel({ leads, selectedId, onSelect }: InboxPanelProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return leads
    const q = search.toLowerCase()
    return leads.filter(l =>
      (l.guest_name || '').toLowerCase().includes(q) ||
      l.guest_phone.includes(q)
    )
  }, [leads, search])

  return (
    <div className="w-full bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="px-4 py-4 border-b border-gray-200 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Atendimento</h2>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {leads.length}
          </span>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
            <Search className="w-6 h-6 opacity-30" />
            <p className="text-sm">{search ? 'Sem resultados' : 'Nenhuma conversa ativa'}</p>
          </div>
        )}

        {filtered.map(lead => (
          <button
            key={lead.id}
            onClick={() => onSelect(lead)}
            className={`w-full px-4 py-3 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors ${
              selectedId === lead.id ? 'bg-violet-50 border-l-2 border-l-violet-500' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-900 truncate">
                    {lead.guest_name || lead.guest_phone}
                  </span>
                  {lead.bot_enabled ? (
                    <Bot className="w-3 h-3 text-violet-500 flex-shrink-0" aria-label="Agente ativo" />
                  ) : (
                    <User className="w-3 h-3 text-orange-500 flex-shrink-0" aria-label="Humano ativo" />
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5">{lead.guest_phone}</p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[lead.status] || 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABELS[lead.status] || lead.status}
                </span>
                {lead.last_message_at && (
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(lead.last_message_at), { locale: ptBR, addSuffix: true })}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativa',
  waiting_guest: 'Aguardando',
  waiting_human: 'Aguard. humano',
  human_active: 'Humano ativo',
  closed: 'Encerrada',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  waiting_guest: 'bg-yellow-100 text-yellow-700',
  waiting_human: 'bg-red-100 text-red-700',
  human_active: 'bg-violet-100 text-violet-700',
  closed: 'bg-gray-100 text-gray-600',
}

export function InboxPanel({ leads, selectedId, onSelect }: InboxPanelProps) {
  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="px-4 py-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">Atendimento</h2>
        <p className="text-xs text-gray-500 mt-0.5">{leads.length} conversa(s) ativa(s)</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {leads.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <p className="text-sm">Nenhuma conversa ativa</p>
          </div>
        )}

        {leads.map(lead => (
          <button
            key={lead.id}
            onClick={() => onSelect(lead)}
            className={`w-full px-4 py-3 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors ${
              selectedId === lead.id ? 'bg-violet-50 border-l-2 border-l-violet-500' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-900 truncate">
                    {lead.guest_name || lead.guest_phone}
                  </span>
                  {lead.bot_enabled ? (
                    <Bot className="w-3 h-3 text-violet-500 flex-shrink-0" aria-label="Agente ativo"/>
                  ) : (
                    <User className="w-3 h-3 text-orange-500 flex-shrink-0" aria-label="Humano ativo"/>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5">{lead.guest_phone}</p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[lead.status] || 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABELS[lead.status] || lead.status}
                </span>
                {lead.last_message_at && (
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(lead.last_message_at), { locale: ptBR, addSuffix: true })}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
