'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Bot, User, Loader2, Sparkles, TrendingUp, Users, AlertTriangle, BarChart2 } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const QUICK_PROMPTS = [
  { icon: AlertTriangle, label: 'Leads sem resposta', prompt: 'Quais leads estão sem resposta há mais de 24h e o que devo fazer?' },
  { icon: TrendingUp, label: 'Análise de conversão', prompt: 'Analise minha taxa de conversão e sugira melhorias.' },
  { icon: Users, label: 'Leads para reativar', prompt: 'Quais leads devo reativar com uma campanha de WhatsApp agora?' },
  { icon: BarChart2, label: 'Resumo do dia', prompt: 'Me dê um resumo rápido de como está o hotel hoje.' },
]

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Olá! Sou o Copilot do HotelTalk 👋\n\nTenho acesso aos dados em tempo real do seu hotel — leads, métricas, status do agente e muito mais.\n\nComo posso ajudar você hoje?',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const newMessages: Message[] = [...messages, { role: 'user', content: trimmed }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || 'Erro ao processar.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro de conexão. Tente novamente.' }])
    } finally {
      setLoading(false)
    }
  }, [messages, loading])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function formatMessage(content: string) {
    const lines = content.split('\n')
    const elements: React.ReactNode[] = []
    let i = 0

    function renderInline(text: string): React.ReactNode[] {
      const parts = text.split(/(\*\*[^*]+\*\*)/g)
      return parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={idx} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>
        }
        return part
      })
    }

    while (i < lines.length) {
      const line = lines[i]
      // Bullet list
      if (/^[-•]\s/.test(line)) {
        const items: string[] = []
        while (i < lines.length && /^[-•]\s/.test(lines[i])) {
          items.push(lines[i].replace(/^[-•]\s/, ''))
          i++
        }
        elements.push(
          <ul key={`ul-${i}`} className="space-y-1 my-1">
            {items.map((item, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="text-violet-400 mt-0.5 flex-shrink-0">•</span>
                <span>{renderInline(item)}</span>
              </li>
            ))}
          </ul>
        )
        continue
      }
      // Numbered list
      if (/^\d+\.\s/.test(line)) {
        const items: string[] = []
        while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
          items.push(lines[i].replace(/^\d+\.\s/, ''))
          i++
        }
        elements.push(
          <ol key={`ol-${i}`} className="space-y-1 my-1 list-none">
            {items.map((item, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="text-violet-500 font-semibold flex-shrink-0 w-4">{idx + 1}.</span>
                <span>{renderInline(item)}</span>
              </li>
            ))}
          </ol>
        )
        continue
      }
      // Empty line → spacer
      if (line.trim() === '') {
        elements.push(<div key={`sp-${i}`} className="h-2" />)
        i++
        continue
      }
      // Regular paragraph
      elements.push(
        <p key={`p-${i}`} className="leading-relaxed">{renderInline(line)}</p>
      )
      i++
    }

    return elements
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-md shadow-violet-200/50">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-gray-900">Copilot IA</h1>
            <p className="text-xs text-gray-500">Assistente de gestão hoteleira com dados em tempo real</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 bg-green-50 border border-green-200 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-700 font-medium">Online</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
              msg.role === 'assistant'
                ? 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm'
                : 'bg-gray-200'
            }`}>
              {msg.role === 'assistant'
                ? <Bot className="w-3.5 h-3.5 text-white" />
                : <User className="w-3.5 h-3.5 text-gray-600" />
              }
            </div>
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
              msg.role === 'assistant'
                ? 'bg-white border border-gray-200 text-gray-800 shadow-sm rounded-tl-sm'
                : 'bg-violet-600 text-white rounded-tr-sm'
            }`}>
              {formatMessage(msg.content)}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick prompts — show only at start */}
      {messages.length <= 1 && (
        <div className="px-4 sm:px-6 pb-3">
          <p className="text-xs text-gray-400 mb-2 font-medium">Sugestões rápidas</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_PROMPTS.map(({ icon: Icon, label, prompt }) => (
              <button
                key={label}
                onClick={() => sendMessage(prompt)}
                className="flex items-center gap-2 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-700 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 transition-colors text-left"
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0 text-violet-500" />
                <span className="font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-4 sm:px-6 py-3">
        <div className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100 transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte sobre seus leads, métricas, estratégias…"
            className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none max-h-32 leading-relaxed"
            style={{ minHeight: '24px' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-8 h-8 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-gray-200 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            {loading
              ? <Loader2 className="w-4 h-4 text-white animate-spin" />
              : <Send className="w-3.5 h-3.5 text-white" />
            }
          </button>
        </div>
        <p className="text-[10px] text-gray-400 text-center mt-1.5">Enter para enviar · Shift+Enter para nova linha</p>
      </div>
    </div>
  )
}
