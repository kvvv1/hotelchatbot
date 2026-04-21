'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageSquare, Columns, BarChart2, Settings, LogOut, Menu, X, Bell, CheckCheck, Info, Sparkles, BedDouble } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { BrandLogo } from '@/components/BrandLogo'

const NAV_ITEMS = [
  { href: '/dashboard/atendimento', label: 'Atendimento', icon: MessageSquare },
  { href: '/dashboard/leads', label: 'Leads (Kanban)', icon: Columns },
  { href: '/dashboard', label: 'Métricas', icon: BarChart2, exact: true },
  { href: '/dashboard/quartos', label: 'Quartos', icon: BedDouble },
  { href: '/dashboard/copilot', label: 'Copilot IA', icon: Sparkles },
  { href: '/dashboard/configuracoes', label: 'Configurações', icon: Settings },
]

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  lead_id: string | null
  read: boolean
  created_at: string
}

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [markingRead, setMarkingRead] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  async function fetchNotifications() {
    try {
      const res = await fetch('/api/notifications')
      const json = await res.json()
      if (json.data) {
        setNotifications(json.data)
        setUnreadCount(json.data.filter((n: Notification) => !n.read).length)
      }
    } catch {}
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  // Close modal when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setShowNotifs(false)
      }
    }
    if (showNotifs) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showNotifs])

  async function markAllRead() {
    const ids = notifications.filter(n => !n.read).map(n => n.id)
    if (!ids.length) return
    setMarkingRead(true)
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    setMarkingRead(false)
    setUnreadCount(0)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  // On mobile: always w-64, slides in/out via translate
  // On desktop: w-16 (collapsed) or w-64 (expanded), always visible
  return (
    <aside
      className={[
        'fixed left-0 top-0 h-screen z-30 bg-slate-900 text-white flex flex-col',
        'transition-all duration-300 w-64',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        'md:translate-x-0',
        collapsed ? 'md:w-16' : 'md:w-64',
      ].join(' ')}
    >
      {/* Logo header */}
      <div
        className={[
          'relative flex items-center justify-center border-b border-slate-700/80',
          collapsed ? 'min-h-[88px] px-2 py-4' : 'min-h-[120px] px-4 py-6',
        ].join(' ')}
      >
        <Link
          href="/dashboard"
          onClick={onMobileClose}
          className={[
            'mx-auto flex items-center justify-center',
            collapsed ? 'h-12 w-12' : 'h-24 w-full max-w-[160px]',
          ].join(' ')}
          aria-label="HotelTalk"
        >
          <BrandLogo
            className={collapsed ? 'h-12 w-12' : 'h-20 w-20'}
            priority
            variant="mark"
          />
        </Link>
        {/* Mobile: close (X) button */}
        <button
          onClick={onMobileClose}
          className="md:hidden absolute right-4 top-4 p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Fechar menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onMobileClose}
              title={collapsed ? label : undefined}
              className={[
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                collapsed ? 'md:justify-center md:px-2' : '',
              ].join(' ')}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className={`whitespace-nowrap ${collapsed ? 'md:hidden' : ''}`}>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom: Bell + Logout + Desktop hamburger */}
      <div className="px-2 pb-4 border-t border-slate-700 pt-3 space-y-1">

        {/* Bell notifications button + popover */}
        <div ref={bellRef} className="relative">
          <button
            onClick={() => setShowNotifs(v => !v)}
            title="Notificações"
            className={[
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-colors',
              showNotifs ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
              collapsed ? 'md:justify-center md:px-2' : '',
            ].join(' ')}
          >
            <div className="relative flex-shrink-0">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full text-[9px] font-bold bg-red-500 text-white px-0.5">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <span className={`whitespace-nowrap ${collapsed ? 'md:hidden' : ''}`}>Notificações</span>
          </button>

          {/* Popover */}
          {showNotifs && (
            <div className="absolute bottom-full left-0 mb-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">Notificações</p>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      disabled={markingRead}
                      className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-medium disabled:opacity-50"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Marcar lidas
                    </button>
                  )}
                  <button onClick={() => setShowNotifs(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400 gap-2">
                    <Bell className="w-6 h-6 opacity-30" />
                    <p className="text-xs">Sem notificações</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <button
                      key={n.id}
                      onClick={() => {
                        setShowNotifs(false)
                        if (n.lead_id) router.push(`/dashboard/atendimento?lead=${n.lead_id}`)
                      }}
                      className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${!n.read ? 'bg-violet-50' : ''}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <Info className={`w-4 h-4 mt-0.5 flex-shrink-0 ${!n.read ? 'text-violet-500' : 'text-gray-400'}`} />
                        <div className="min-w-0">
                          <p className={`text-xs font-medium truncate ${!n.read ? 'text-gray-900' : 'text-gray-600'}`}>{n.title}</p>
                          {n.body && <p className="text-[11px] text-gray-500 truncate mt-0.5">{n.body}</p>}
                        </div>
                        {!n.read && <span className="ml-auto flex-shrink-0 w-1.5 h-1.5 rounded-full bg-violet-500 mt-1.5" />}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          title={collapsed ? 'Sair' : undefined}
          className={[
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-colors',
            'text-slate-300 hover:bg-slate-800 hover:text-white',
            collapsed ? 'md:justify-center md:px-2' : '',
          ].join(' ')}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span className={`whitespace-nowrap ${collapsed ? 'md:hidden' : ''}`}>Sair</span>
        </button>

        {/* Desktop hamburger — at the bottom */}
        <button
          onClick={onToggle}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className={[
            'hidden md:flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-colors',
            'text-slate-400 hover:bg-slate-800 hover:text-white',
            collapsed ? 'justify-center px-2' : '',
          ].join(' ')}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <Menu className="w-4 h-4 flex-shrink-0" />
          <span className={`whitespace-nowrap ${collapsed ? 'md:hidden' : ''}`}>Recolher menu</span>
        </button>
      </div>
    </aside>
  )
}
