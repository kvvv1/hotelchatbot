'use client'

import { useState } from 'react'
import {
  Calendar,
  Users,
  BedDouble,
  Mail,
  MessageSquare,
  ArrowLeft,
  PenLine,
  XCircle,
  Loader2,
  Save,
  Tag,
  Plus,
  X,
} from 'lucide-react'
import type { Lead } from '@/lib/types/database'

const STAGE_LABELS: Record<string, string> = {
  new_contact: 'Novo contato',
  in_attendance: 'Em atendimento',
  checking_availability: 'Consultando disponibilidade',
  proposal_sent: 'Proposta enviada',
  negotiating: 'Em negociação',
  booking_in_progress: 'Reserva em andamento',
  booked: 'Reserva confirmada',
  not_converted: 'Não convertido',
}

const STAGE_COLORS: Record<string, string> = {
  new_contact: 'bg-gray-100 text-gray-700',
  in_attendance: 'bg-violet-100 text-violet-700',
  checking_availability: 'bg-yellow-100 text-yellow-700',
  proposal_sent: 'bg-purple-100 text-purple-700',
  negotiating: 'bg-orange-100 text-orange-700',
  booking_in_progress: 'bg-purple-100 text-purple-700',
  booked: 'bg-green-100 text-green-700',
  not_converted: 'bg-red-100 text-red-700',
}

interface LeadContextPanelProps {
  lead: Lead
  onBack?: () => void
  onClose?: () => void
  onLeadUpdated?: (updated: Lead) => void
}

export function LeadContextPanel({ lead, onBack, onClose, onLeadUpdated }: LeadContextPanelProps) {
  const ctx = lead.context || {}
  const [notes, setNotes] = useState(lead.notes || '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [closing, setClosing] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [tags, setTags] = useState<string[]>(lead.tags || [])
  const [newTag, setNewTag] = useState('')

  function formatDate(dateStr?: string) {
    if (!dateStr) return '—'
    const [year, month, day] = dateStr.split('-')
    return `${day}/${month}/${year}`
  }

  async function saveNotes() {
    setSavingNotes(true)
    await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
    setSavingNotes(false)
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2500)
    onLeadUpdated?.({ ...lead, notes })
  }

  async function addTag() {
    const tag = newTag.trim()
    if (!tag || tags.includes(tag)) return
    const updatedTags = [...tags, tag]
    setTags(updatedTags)
    setNewTag('')
    await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: updatedTags }),
    })
    onLeadUpdated?.({ ...lead, tags: updatedTags })
  }

  async function removeTag(tag: string) {
    const updatedTags = tags.filter(item => item !== tag)
    setTags(updatedTags)
    await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: updatedTags }),
    })
    onLeadUpdated?.({ ...lead, tags: updatedTags })
  }

  async function handleClose() {
    setClosing(true)
    await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed' }),
    })
    setClosing(false)
    setConfirmClose(false)
    onClose?.()
  }

  return (
    <div className="w-full bg-white border-l border-gray-200 flex flex-col h-full">
      <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-1.5 -ml-1 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
              aria-label="Voltar ao chat"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <h3 className="font-semibold text-gray-900 text-sm">Dados do Lead</h3>
        </div>

        {lead.status !== 'closed' && (
          <button
            type="button"
            onClick={() => setConfirmClose(true)}
            title="Encerrar conversa"
            className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <XCircle className="w-4 h-4" />
          </button>
        )}
      </div>

      {confirmClose && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800 font-medium mb-2">Encerrar esta conversa?</p>
          <p className="text-xs text-red-600 mb-3">O lead ficará como encerrado e sairá da inbox.</p>
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              disabled={closing}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-60"
            >
              {closing ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
              Encerrar
            </button>
            <button
              onClick={() => setConfirmClose(false)}
              className="flex-1 py-1.5 border border-gray-300 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-5">
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">Estágio</p>
          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${STAGE_COLORS[lead.stage] || 'bg-gray-100 text-gray-700'}`}>
            {STAGE_LABELS[lead.stage] || lead.stage}
          </span>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Tag className="w-3.5 h-3.5 text-gray-400" />
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Etiquetas</p>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-xs font-medium">
                {tag}
                <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-500 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-1.5">
            <input
              type="text"
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTag()
                }
              }}
              placeholder="VIP, grupo, corporativo..."
              className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button type="button" onClick={addTag} className="p-1.5 bg-gray-100 hover:bg-violet-100 hover:text-violet-600 rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">Informações coletadas pela IA</p>
          <div className="space-y-3">
            {ctx.checkIn && (
              <div className="flex items-start gap-2.5">
                <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Check-in / Check-out</p>
                  <p className="text-sm text-gray-900 font-medium">{formatDate(ctx.checkIn)} até {formatDate(ctx.checkOut)}</p>
                </div>
              </div>
            )}

            {ctx.guests && (
              <div className="flex items-start gap-2.5">
                <Users className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Hóspedes</p>
                  <p className="text-sm text-gray-900 font-medium">{ctx.guests} pessoa(s)</p>
                </div>
              </div>
            )}

            {ctx.roomType && (
              <div className="flex items-start gap-2.5">
                <BedDouble className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Tipo de quarto</p>
                  <p className="text-sm text-gray-900 font-medium">{ctx.roomType}</p>
                </div>
              </div>
            )}

            {ctx.guestEmail && (
              <div className="flex items-start gap-2.5">
                <Mail className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">E-mail</p>
                  <p className="text-sm text-gray-900 font-medium">{ctx.guestEmail}</p>
                </div>
              </div>
            )}

            {ctx.specialRequests && (
              <div className="flex items-start gap-2.5">
                <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Pedidos especiais</p>
                  <p className="text-sm text-gray-900">{ctx.specialRequests}</p>
                </div>
              </div>
            )}

            {!ctx.checkIn && !ctx.guests && !ctx.roomType && !ctx.guestEmail && !ctx.specialRequests && (
              <p className="text-sm text-gray-400 italic">Nenhuma informação coletada ainda</p>
            )}
          </div>
        </div>

        {ctx.hitsRoomOptions && ctx.hitsRoomOptions.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">Quartos disponíveis</p>
            <div className="space-y-2">
              {ctx.hitsRoomOptions.map((room, i) => (
                <div key={i} className="p-2.5 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-900">{room.roomName}</p>
                  <p className="text-xs text-gray-500">R$ {room.rate?.toFixed(2)}/noite</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <PenLine className="w-3.5 h-3.5 text-gray-400" />
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Notas internas</p>
          </div>

          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Anotações internas (não enviadas ao hóspede)..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none bg-yellow-50/60 placeholder:text-gray-400"
          />

          <div className="flex items-center justify-between mt-1.5">
            {notesSaved ? (
              <span className="text-xs text-green-600 font-medium">✓ Notas salvas</span>
            ) : (
              <span className="text-xs text-gray-400">{notes !== (lead.notes || '') ? 'Não salvo' : ''}</span>
            )}
            <button
              type="button"
              onClick={saveNotes}
              disabled={savingNotes || notes === (lead.notes || '')}
              className="flex items-center gap-1 text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-md font-medium text-gray-700 disabled:opacity-40 transition-colors"
            >
              {savingNotes ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
