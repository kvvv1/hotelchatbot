'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { Menu } from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(v => !v)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div
        className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${
          collapsed ? 'md:ml-16' : 'md:ml-64'
        }`}
      >
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 h-16 bg-slate-900 text-white shrink-0 z-10">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-md text-slate-400 hover:text-white"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <BrandLogo className="h-10 w-10" priority variant="mark" />
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
