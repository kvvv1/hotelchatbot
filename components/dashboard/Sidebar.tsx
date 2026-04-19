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
      {/* Logo header */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700">
        <Hotel className="w-6 h-6 text-violet-400 flex-shrink-0" />
        <span className={`font-semibold text-lg whitespace-nowrap ${collapsed ? 'md:hidden' : ''}`}>
          HotelTalk
        </span>
        {/* Mobile: close (X) button */}
        <button
          onClick={onMobileClose}
          className="md:hidden ml-auto p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
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

      {/* Bottom: Logout + Desktop hamburger */}
      <div className="px-2 pb-4 border-t border-slate-700 pt-3 space-y-1">
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