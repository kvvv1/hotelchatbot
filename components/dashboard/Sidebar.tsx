'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageSquare, Columns, BarChart2, Settings, LogOut, Hotel } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/dashboard/atendimento', label: 'Atendimento', icon: MessageSquare },
  { href: '/dashboard/leads', label: 'Leads (Kanban)', icon: Columns },
  { href: '/dashboard', label: 'Métricas', icon: BarChart2, exact: true },
  { href: '/dashboard/configuracoes', label: 'Configurações', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0 z-10">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700">
        <Hotel className="w-6 h-6 text-violet-400" />
        <span className="font-semibold text-lg">HotelTalk</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-4 border-t border-slate-700 pt-4">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white w-full transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  )
}
