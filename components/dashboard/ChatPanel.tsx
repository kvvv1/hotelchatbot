'use client'

import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Bot, User, Mic, ArrowLeft, Info, Send } from 'lucide-react'
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
  bot: 'IA',
  human: 'Atendente',
}

const SENDER_STYLES: Record<string, string> = {
  guest: 'bg-gray-100 text-gray-900 self-start',
  bot: 'bg-violet-50 text-violet-900 self-start border border-violet-100',
  human: 'bg-violet-600 text-white self-end',
}

export function ChatPanel({ lead, messages, onTakeover, onMessageSent, onBack, onInfo }: ChatPanelProps) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
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

  return (
    <div className="flex-1 flex flex-col h-full bg-white min-w-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
        {/* Back button — mobile only */}
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

        {/* Info button — mobile only */}
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p className="text-sm">Nenhuma mensagem ainda</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col max-w-[80%] sm:max-w-[70%] ${msg.sender === 'human' ? 'self-end ml-auto' : ''}`}>
            <div className="flex items-center gap-1.5 mb-1">
              {msg.sender === 'bot' && <Bot className="w-3 h-3 text-violet-500" />}
              {msg.sender === 'human' && <User className="w-3 h-3 text-violet-600" />}
              <span className="text-xs text-gray-400 font-medium">{SENDER_LABELS[msg.sender]}</span>
              <span className="text-xs text-gray-400">
                {format(new Date(msg.created_at), 'HH:mm', { locale: ptBR })}
              </span>
            </div>
            <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${SENDER_STYLES[msg.sender]}`}>
              {msg.media_type === 'audio' && (
                <div className="flex items-center gap-2 text-xs opacity-70 mb-1">
                  <Mic className="w-3 h-3" />
                  <span>Áudio transcrito</span>
                </div>
              )}
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!lead.bot_enabled ? (
        <form onSubmit={handleSend} className="px-4 py-3 border-t border-gray-200 flex gap-2">
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Digite uma mensagem..."
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="p-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white rounded-xl transition-colors"
            aria-label="Enviar"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      ) : (
        <div className="px-4 py-3 border-t border-gray-200 bg-violet-50">
          <p className="text-xs text-violet-600 text-center">
            IA está atendendo — assuma o atendimento para enviar mensagens
          </p>
        </div>
      )}
    </div>
  )
}

const SENDER_LABELS: Record<string, string> = {
  guest: 'Hóspede',
  bot: 'IA',
  human: 'Atendente',
}

const SENDER_STYLES: Record<string, string> = {
  guest: 'bg-gray-100 text-gray-900 self-start',
  bot: 'bg-blue-50 text-blue-900 self-start border border-blue-100',
  human: 'bg-green-600 text-white self-end',
}

export function ChatPanel({ lead, messages, onTakeover, onMessageSent }: ChatPanelProps) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
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

  return (
    <div className="flex-1 flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{lead.guest_name || lead.guest_phone}</h3>
          <p className="text-sm text-gray-500">{lead.guest_phone}</p>
        </div>
        <TakeoverButton lead={lead} onAction={onTakeover} />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col max-w-[70%] ${msg.sender === 'human' ? 'self-end ml-auto' : ''}`}>
            <div className="flex items-center gap-1.5 mb-1">
              {msg.sender === 'bot' && <Bot className="w-3 h-3 text-blue-500" />}
              {msg.sender === 'human' && <User className="w-3 h-3 text-green-600" />}
              <span className="text-xs text-gray-400 font-medium">{SENDER_LABELS[msg.sender]}</span>
              <span className="text-xs text-gray-400">
                {format(new Date(msg.created_at), 'HH:mm', { locale: ptBR })}
              </span>
            </div>
            <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${SENDER_STYLES[msg.sender]}`}>
              {msg.media_type === 'audio' && (
                <div className="flex items-center gap-2 text-xs opacity-70 mb-1">
                  <Mic className="w-3 h-3" />
                  <span>Áudio transcrito</span>
                </div>
              )}
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input — apenas disponível quando humano está atendendo */}
      {!lead.bot_enabled && (
        <form onSubmit={handleSend} className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Digite uma mensagem..."
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium rounded-xl text-sm transition-colors"
          >
            {sending ? '...' : 'Enviar'}
          </button>
        </form>
      )}

      {lead.bot_enabled && (
        <div className="px-6 py-3 border-t border-gray-200 bg-blue-50">
          <p className="text-xs text-blue-600 text-center">
            IA está atendendo — assuma o atendimento para enviar mensagens manualmente
          </p>
        </div>
      )}
    </div>
  )
}
