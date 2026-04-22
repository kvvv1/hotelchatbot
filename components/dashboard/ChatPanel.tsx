'use client'

import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Mic,
  ArrowLeft,
  Info,
  Send,
  Zap,
  ChevronDown,
  Sparkles,
  UserRound,
} from 'lucide-react'
import type { Lead, Message } from '@/lib/types/database'
import { TakeoverButton } from './TakeoverButton'

interface ChatPanelProps {
  lead: Lead
  messages: Message[]
  onTakeover: (action: 'take' | 'release') => Promise<void>
  onMessageSent: () => void
  onBack?: () => void
  onInfo?: () => void
}

const SENDER_LABELS: Record<string, string> = {
  guest: 'Hóspede',
  bot: 'Agente IA',
  human: 'Atendente humano',
}

const QUICK_REPLIES = [
  'Olá! Posso te ajudar com a sua reserva.',
  'Quais datas você deseja para a hospedagem?',
  'Quantas pessoas vão se hospedar?',
  'Temos disponibilidade nesse período, sim. Posso te passar os detalhes.',
  'Vou verificar a melhor opção e já te respondo por aqui.',
  'Para seguir com a reserva, me confirma por favor o nome completo e um e-mail.',
  'Perfeito! Vou deixar essa opção anotada para você.',
  'Se quiser, também posso te mandar mais fotos da estrutura e dos quartos.',
]

function getMetaStyle(sender: Message['sender']) {
  if (sender === 'bot') return 'text-violet-600'
  if (sender === 'human') return 'text-slate-600'
  return 'text-gray-500'
}

function getBubbleStyle(sender: Message['sender']) {
  if (sender === 'guest') {
    return 'bg-gray-100 text-gray-900 border border-gray-200 rounded-2xl rounded-tl-sm'
  }
  if (sender === 'bot') {
    return 'bg-violet-50 text-violet-900 border border-violet-200 rounded-2xl rounded-tr-sm'
  }
  return 'bg-slate-900 text-white border border-slate-900 rounded-2xl rounded-tr-sm'
}

function getSenderIcon(sender: Message['sender']) {
  if (sender === 'bot') return <Sparkles className="w-3 h-3" />
  if (sender === 'human') return <UserRound className="w-3 h-3" />
  return null
}

export function ChatPanel({ lead, messages, onTakeover, onMessageSent, onBack, onInfo }: ChatPanelProps) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || sending) return

    setSending(true)
    try {
      await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, message: text.trim() }),
      })
      setText('')
      onMessageSent()
    } finally {
      setSending(false)
    }
  }

  function applyQuickReply(reply: string) {
    setText(reply)
    setShowQuickReplies(false)
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white min-w-0">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="md:hidden p-1.5 -ml-1 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{lead.guest_name || lead.guest_phone}</h3>
          <p className="text-xs text-gray-500 truncate">{lead.guest_phone}</p>
        </div>

        <TakeoverButton lead={lead} onAction={onTakeover} />

        {onInfo && (
          <button
            onClick={onInfo}
            className="md:hidden p-1.5 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="Ver dados do lead"
          >
            <Info className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gradient-to-b from-white to-violet-50/30">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p className="text-sm">Nenhuma mensagem ainda</p>
          </div>
        )}

        {messages.map(msg => {
          const outgoing = msg.sender !== 'guest'

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${outgoing ? 'items-end' : 'items-start'}`}
            >
              <div className={`flex items-center gap-1.5 mb-1 px-1 ${outgoing ? 'justify-end' : 'justify-start'}`}>
                {getSenderIcon(msg.sender)}
                <span className={`text-xs font-medium ${getMetaStyle(msg.sender)}`}>{SENDER_LABELS[msg.sender]}</span>
                <span className="text-xs text-gray-400">
                  {format(new Date(msg.created_at), 'HH:mm', { locale: ptBR })}
                </span>
              </div>

              <div
                className={`max-w-[82%] sm:max-w-[70%] px-4 py-3 text-sm leading-relaxed shadow-sm ${getBubbleStyle(msg.sender)}`}
              >
                {msg.media_type === 'audio' && (
                  <div className="flex items-center gap-2 text-xs opacity-70 mb-1">
                    <Mic className="w-3 h-3" />
                    <span>Áudio transcrito</span>
                  </div>
                )}
                {msg.content}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {!lead.bot_enabled ? (
        <div className="border-t border-gray-200">
          {showQuickReplies && (
            <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 max-h-48 overflow-y-auto">
              <p className="text-[10px] text-gray-400 font-medium mb-1.5 uppercase tracking-wide">Respostas rápidas</p>
              <div className="space-y-1">
                {QUICK_REPLIES.map((reply, i) => (
                  <button
                    key={i}
                    onClick={() => applyQuickReply(reply)}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg bg-white border border-gray-200 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 transition-colors text-gray-700"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSend} className="px-4 py-3 flex gap-2 items-end">
            <button
              type="button"
              onClick={() => setShowQuickReplies(v => !v)}
              title="Respostas rápidas"
              className={`p-2.5 rounded-xl border transition-colors flex-shrink-0 ${
                showQuickReplies
                  ? 'bg-violet-100 border-violet-300 text-violet-600'
                  : 'border-gray-300 text-gray-400 hover:text-violet-500 hover:border-violet-300'
              }`}
            >
              {showQuickReplies ? <ChevronDown className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend(e as unknown as React.FormEvent)
                }
              }}
              placeholder="Digite uma mensagem..."
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />

            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="p-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white rounded-xl transition-colors flex-shrink-0"
              aria-label="Enviar"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      ) : (
        <div className="px-4 py-3 border-t border-gray-200 bg-violet-50">
          <p className="text-xs text-violet-600 text-center">
            A IA está atendendo no momento. Assuma o atendimento para enviar mensagens manualmente.
          </p>
        </div>
      )}
    </div>
  )
}
