'use client'

import { useState } from 'react'
import { Bot, User } from 'lucide-react'
import type { Lead } from '@/lib/types/database'

interface TakeoverButtonProps {
  lead: Lead
  onAction: (action: 'take' | 'release') => Promise<void>
}

export function TakeoverButton({ lead, onAction }: TakeoverButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handle() {
    const action = lead.bot_enabled ? 'take' : 'release'
    setLoading(true)
    try {
      await onAction(action)
    } finally {
      setLoading(false)
    }
  }

  if (lead.bot_enabled) {
    return (
      <button
        onClick={handle}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
      >
        <User className="w-4 h-4" />
        {loading ? 'Assumindo...' : 'Assumir atendimento'}
      </button>
    )
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
    >
      <Bot className="w-4 h-4" />
      {loading ? 'Devolvendo...' : 'Devolver para IA'}
    </button>
  )
}
