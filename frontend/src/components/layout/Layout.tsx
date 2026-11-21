import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { Menu, ShoppingBag } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { user } = useAuth()

  return (
    <div className="flex flex-col md:flex-row h-full w-full min-h-0 bg-slate-100 overflow-hidden">
      {/* Top Mobile App Bar (visible on < md) */}
      <header className="md:hidden bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-800 shrink-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-1.5 -ml-1 text-slate-300 hover:text-white rounded-lg active:bg-slate-800 transition-colors"
            aria-label="მენიუს გახსნა"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm tracking-tight">მე და მარკეტი</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            {user?.name?.split(' ')[0] || 'მოლარე'}
          </span>
        </div>
      </header>

      {/* Sidebar with Drawer on Mobile */}
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      {/* Main Page Area */}
      <main className="flex-1 min-w-0 min-h-0 h-full overflow-y-auto flex flex-col">
        <Outlet />
      </main>
    </div>
  )
}
