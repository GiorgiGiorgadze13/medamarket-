import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../services/api'
import { ShoppingBag, Lock, Mail, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      toast.error('გთხოვთ შეავსოთ ელ-ფოსტა და პაროლი')
      return
    }

    setIsLoading(true)
    try {
      await login(email.trim(), password)
      toast.success('ავტორიზაცია წარმატებულია!')
      navigate('/pos')
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'ავტორიზაცია ვერ მოხერხდა'))
    } finally {
      setIsLoading(false)
    }
  }

  const fillCredentials = (userEmail: string, userPass: string) => {
    setEmail(userEmail)
    setPassword(userPass)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-600/30 mb-4 text-white">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Meda Market</h1>
          <p className="text-gray-500 font-medium text-sm mt-1">სასურსათო მაღაზიის POS და საწყობის სისტემა</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                ელ-ფოსტა
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@medamarket.ge"
                  className="input-field pl-10"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                პაროლი
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-2.5 text-base font-semibold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>მიმდინარეობს შესვლა...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>სისტემაში შესვლა</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Login helper buttons */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center font-medium mb-3">სადემონსტრაციო მომხმარებლები:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => fillCredentials('admin@medamarket.ge', 'admin123')}
                className="py-1.5 px-2 bg-gray-50 hover:bg-emerald-50 hover:text-emerald-700 text-gray-600 rounded-lg border border-gray-200 transition-colors font-medium text-center"
              >
                ადმინი: admin123
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('cashier@medamarket.ge', 'cashier123')}
                className="py-1.5 px-2 bg-gray-50 hover:bg-emerald-50 hover:text-emerald-700 text-gray-600 rounded-lg border border-gray-200 transition-colors font-medium text-center"
              >
                მოლარე: cashier123
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
