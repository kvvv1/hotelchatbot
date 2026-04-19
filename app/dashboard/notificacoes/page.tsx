'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Bell, CheckCheck, MessageSquare, UserCheck, AlertCircle, Loader2 } from 'lucide-react'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  lead_id: string | null
  read: boolean
  created_at: string
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  new_lead: MessageSquare,
  lead_waiting_human: UserCheck,
  human_requested: UserCheck,
  lead_updated: AlertCircle,
  message_received: MessageSquare,
}

const TYPE_COLORS: Record<string, string> = {
  new_lead: 'text-violet-500 bg-violet-50',
  lead_waiting_human: 'text-orange-500 bg-orange-50',
  human_requested: 'text-orange-500 bg-orange-50',
  lead_updated: 'text-blue-500 bg-blue-50',
  message_received: 'text-green-500 bg-green-50',
}

export default function NotificacoesPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  const fetchNotifications = useCallback(async () => {
    const res = await fetch('/api/notifications')
    const json = await res.json()
    if (json.data) setNotifications(json.data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  async function markAsRead(ids: string[]) {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, read: true } : n))
  }

  async function markAllRead() {
    const unread = notifications.filter(n => !n.read).map(n => n.id)
    if (unread.length === 0) return
    setMarkingAll(true)
    await markAsRead(unread)
    setMarkingAll(false)
  }

  function handleClick(n: Notification) {
    if (!n.read) markAsRead([n.id])
    if (n.lead_id) {
      router.push(`/dashboard/atendimento?lead=${n.lead_id}`)
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Notificações</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}` : 'Tudo em dia'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={markingAll}
            className="flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700 font-medium disabled:opacity-50"
          >
            {markingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
            Marcar todas como lidas
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
          <Bell className="w-10 h-10 opacity-20" />
          <p className="text-sm font-medium">Nenhuma notificação</p>
          <p className="text-xs text-center">Novos leads e pedidos de atendimento aparecerão aqui</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
          {notifications.map(n => {
            const Icon = TYPE_ICONS[n.type] || Bell
            const colorClass = TYPE_COLORS[n.type] || 'text-gray-500 bg-gray-50'
            return (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full flex items-start gap-4 px-4 sm:px-5 py-4 text-left hover:bg-gray-50 transition-colors ${!n.read ? 'bg-violet-50/40' : ''}`}
              >
                <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${colorClass}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-medium ${n.read ? 'text-gray-700' : 'text-gray-900'}`}>{n.title}</p>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0 mt-1.5" />}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { locale: ptBR, addSuffix: true })}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
