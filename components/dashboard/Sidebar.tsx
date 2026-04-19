'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageSquare, Columns, BarChart2, Settings, LogOut, Hotel, Menu, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/dashboard/atendimento', label: 'Atendimento', icon: MessageSquare },
  { href: '/dashboard/leads', label: 'Leads (Kanban)', icon: Columns },
  { href: '/dashboard', label: 'Métricas', icon: BarChart2, exact: true },
  { href: '/dashboard/configuracoes', label: 'Configurações', icon: Settings },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

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
      {/* Header: logo + toggle buttons */}
      <div className="flex items-center justify-between px-3 py-5 border-b border-slate-700 min-h-[4rem]">
        <div className="flex items-center gap-3 overflow-hidden">
          <Hotel className="w-6 h-6 text-violet-400 flex-shrink-0" />
          <span className={`font-semibold text-lg whitespace-nowrap transition-all ${collapsed ? 'md:hidden' : ''}`}>
            HotelTalk
          </span>
        </div>

        {/* Mobile: close (X) button */}
        <button
          onClick={onMobileClose}
          className="md:hidden p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Fechar menu"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Desktop: hamburger toggle */}
        <button
          onClick={onToggle}
          className="hidden md:flex p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <Menu className="w-4 h-4" />
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

      {/* Logout */}
      <div className="px-2 pb-4 border-t border-slate-700 pt-4">
        <button
          onClick={handleLogout}
          title={collapsed ? 'Sair' : undefined}
          className={[
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
            'text-slate-300 hover:bg-slate-800 hover:text-white w-full transition-colors',
            collapsed ? 'md:justify-center md:px-2' : '',
          ].join(' ')}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span className={`whitespace-nowrap ${collapsed ? 'md:hidden' : ''}`}>Sair</span>
        </button>
      </div>
    </aside>
  )
}
  { href: '/dashboard/leads', label: 'Leads (Kanban)', icon: Columns },
  { href: '/dashboard', label: 'Métricas', icon: BarChart2, exact: true },
  { href: '/dashboard/configuracoes', label: 'Configurações', icon: Settings },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside
      className="bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0 z-10 transition-all duration-300 overflow-hidden"
      style={{ width: collapsed ? '4rem' : '16rem' }}
    >
      {/* Logo + Hamburger */}
      <div className="flex items-center justify-between px-3 py-5 border-b border-slate-700">
        <div className="flex items-center gap-3 overflow-hidden">
          <Hotel className="w-6 h-6 text-violet-400 flex-shrink-0" />
          {!collapsed && (
            <span className="font-semibold text-lg whitespace-nowrap">HotelTalk</span>
          )}
        </div>
        <button
          onClick={onToggle}
          className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex-shrink-0"
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <Menu className="w-4 h-4" />
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
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span className="whitespace-nowrap">{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-2 pb-4 border-t border-slate-700 pt-4">
        <button
          onClick={handleLogout}
          title={collapsed ? 'Sair' : undefined}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white w-full transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="whitespace-nowrap">Sair</span>}
        </button>
      </div>
    </aside>
  )
}
