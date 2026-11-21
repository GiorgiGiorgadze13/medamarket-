import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  ShoppingBag,
  Store,
  LayoutDashboard,
  Package,
  Receipt,
  Users,
  LogOut,
  Shield,
  User as UserIcon,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    toast.success('სისტემიდან გამოსვლა წარმატებულია')
    navigate('/login')
  }

  const isAdmin = user?.role === 'ADMIN'

  const navItems = [
    {
      to: '/pos',
      label: 'POS გაყიდვები',
      icon: Store,
      badge: 'LIVE',
      adminOnly: false,
    },
    {
      to: '/dashboard',
      label: 'ანალიტიკა',
      icon: LayoutDashboard,
      adminOnly: true,
    },
    {
      to: '/products',
      label: 'პროდუქტები & მარაგი',
      icon: Package,
      adminOnly: true,
    },
    {
      to: '/sales',
      label: 'გაყიდვების ისტორია',
      icon: Receipt,
      adminOnly: true,
    },
    {
      to: '/employees',
      label: 'თანამშრომლები',
      icon: Users,
      adminOnly: true,
    },
  ]

  const filteredItems = navItems.filter((item) => !item.adminOnly || isAdmin)

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 md:w-52 lg:w-56 xl:w-60 2xl:w-64 bg-slate-900 text-slate-100 flex flex-col h-full border-r border-slate-800 shadow-2xl md:shadow-xl shrink-0 select-none transform transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-xs sm:text-sm tracking-tight text-white leading-tight truncate">მე და მარკეტი</h1>
              <span className="text-[10px] sm:text-[11px] font-medium text-emerald-400 block truncate">POS & Inventory</span>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={onClose}
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 min-h-0 px-2 sm:px-2.5 py-2 sm:py-3 space-y-1 overflow-y-auto">
          <div className="px-2.5 pb-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">
            მენიუ
          </div>
          {filteredItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center justify-between px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all duration-150 ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80 active:bg-slate-800'
                  }`
                }
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-400/20 text-emerald-300 shrink-0 animate-pulse">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* User Info & Logout Footer */}
        <div className="p-2.5 sm:p-3 border-t border-slate-800 bg-slate-950/40 shrink-0">
          <div className="flex items-center gap-2.5 mb-2 px-0.5">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 border border-slate-700 shrink-0">
              {isAdmin ? (
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <UserIcon className="w-3.5 h-3.5 text-teal-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-white truncate">{user?.name || 'მომხმარებელი'}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0"></span>
                <span className="text-[10px] sm:text-xs text-slate-400 truncate">
                  {isAdmin ? 'ადმინისტრატორი' : 'მოლარე'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold text-rose-300 hover:text-white hover:bg-rose-600/80 border border-rose-500/20 transition-all duration-150"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>სისტემიდან გასვლა</span>
          </button>
        </div>
      </aside>
    </>
  )
}
