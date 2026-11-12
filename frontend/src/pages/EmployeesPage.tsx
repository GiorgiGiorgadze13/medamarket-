import React, { useState, useEffect, useMemo } from 'react'
import { api } from '../services/api'
import { User, Role } from '../types'
import {
  Users,
  Plus,
  Shield,
  UserCheck,
  UserX,
  Mail,
  Lock,
  Edit2,
  CheckCircle,
  X,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false)
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null)

  // Add Form state
  const [addName, setAddName] = useState<string>('')
  const [addEmail, setAddEmail] = useState<string>('')
  const [addPassword, setAddPassword] = useState<string>('')
  const [addRole, setAddRole] = useState<Role>('CASHIER')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // Edit Form state
  const [editName, setEditName] = useState<string>('')
  const [editEmail, setEditEmail] = useState<string>('')
  const [editRole, setEditRole] = useState<Role>('CASHIER')
  const [editIsActive, setEditIsActive] = useState<boolean>(true)

  const loadEmployees = async () => {
    setIsLoading(true)
    try {
      const data = await api.employees.getAll()
      setEmployees(data)
    } catch (err) {
      console.error(err)
      toast.error('თანამშრომლების ჩატვირთვა ვერ მოხერხდა')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadEmployees()
  }, [])

  // Handle Add Employee
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addName.trim() || !addEmail.trim() || !addPassword) {
      toast.error('გთხოვთ შეავსოთ ყველა ველი')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await api.auth.createEmployee({
        name: addName.trim(),
        email: addEmail.trim(),
        password: addPassword,
        role: addRole,
      })
      setEmployees((prev) => [res.user, ...prev])
      toast.success('თანამშრომელი წარმატებით დაემატა')
      setIsAddModalOpen(false)
      setAddName('')
      setAddEmail('')
      setAddPassword('')
      setAddRole('CASHIER')
    } catch (err: any) {
      console.error(err)
      toast.error(err.response?.data?.error || 'თანამშრომლის დამატება ვერ მოხერხდა')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Open Edit
  const handleOpenEdit = (emp: User) => {
    setSelectedEmployee(emp)
    setEditName(emp.name)
    setEditEmail(emp.email)
    setEditRole(emp.role)
    setEditIsActive(emp.isActive ?? true)
    setIsEditModalOpen(true)
  }

  // Handle Edit Save
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEmployee) return

    setIsSubmitting(true)
    try {
      const updated = await api.employees.update(selectedEmployee.id, {
        name: editName.trim(),
        email: editEmail.trim(),
        role: editRole,
        isActive: editIsActive,
      })
      setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
      toast.success('მონაცემები განახლდა')
      setIsEditModalOpen(false)
    } catch (err: any) {
      console.error(err)
      toast.error(err.response?.data?.error || 'განახლება ვერ მოხერხდა')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Deactivate Quick Toggle
  const handleDeactivate = async (emp: User) => {
    if (!window.confirm(`დარწმუნებული ხართ რომ გსურთ ${emp.name}-ის პროფილის გათიშვა?`)) return

    try {
      await api.employees.deactivate(emp.id)
      setEmployees((prev) =>
        prev.map((e) => (e.id === emp.id ? { ...e, isActive: false } : e))
      )
      toast.success('თანამშრომლის პროფილი გაითიშა')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'ოპერაცია ვერ შესრულდა')
    }
  }

  // Summary Metrics
  const summary = useMemo(() => {
    const totalCount = employees.length
    const adminCount = employees.filter((e) => e.role === 'ADMIN' && e.isActive !== false).length
    const cashierCount = employees.filter((e) => e.role === 'CASHIER' && e.isActive !== false).length
    return { totalCount, adminCount, cashierCount }
  }, [employees])

  return (
    <div className="p-3.5 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600" />
            <span>თანამშრომლები & მოლარეები</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1">
            სისტემის მომხმარებლების, უფლებების დონისა და მოლარეების მართვა
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <button
            onClick={loadEmployees}
            title="განახლება"
            className="p-2 sm:p-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl transition-colors shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 sm:px-4 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 sm:gap-2 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>თანამშრომლის დამატება</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase">სულ თანამშრომელი</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{summary.totalCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase">ადმინისტრატორი</p>
            <p className="text-xl font-black text-purple-700 mt-0.5">{summary.adminCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase">აქტიური მოლარე</p>
            <p className="text-xl font-black text-emerald-700 mt-0.5">{summary.cashierCount}</p>
          </div>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">თანამშრომელი</th>
                <th className="py-3 px-4">ელ-ფოსტა</th>
                <th className="py-3 px-4 text-center">როლი</th>
                <th className="py-3 px-4 text-center">სტატუსი</th>
                <th className="py-3 px-4 text-center">გატარებული გაყიდვები</th>
                <th className="py-3 px-4 text-slate-400">რეგისტრაციის თარიღი</th>
                <th className="py-3 px-4 text-right">მოქმედება</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    თანამშრომლები ვერ მოიძებნა
                  </td>
                </tr>
              ) : (
                employees.map((emp) => {
                  const isActive = emp.isActive !== false
                  const dateStr = emp.createdAt
                    ? new Date(emp.createdAt).toLocaleDateString('ka-GE')
                    : '—'

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700">
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-bold text-slate-900">{emp.name}</span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3 px-4 text-slate-600 font-medium">{emp.email}</td>

                      {/* Role */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                            emp.role === 'ADMIN'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {emp.role === 'ADMIN' ? (
                            <>
                              <Shield className="w-3 h-3" />
                              <span>ადმინისტრატორი</span>
                            </>
                          ) : (
                            <>
                              <ShoppingBag className="w-3 h-3" />
                              <span>მოლარე</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isActive ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          ></span>
                          <span>{isActive ? 'აქტიური' : 'გათიშული'}</span>
                        </span>
                      </td>

                      {/* Sales Count */}
                      <td className="py-3 px-4 text-center font-bold text-slate-800">
                        {emp._count?.sales ?? 0} ჩეკი
                      </td>

                      {/* Registration Date */}
                      <td className="py-3 px-4 text-slate-400">{dateStr}</td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(emp)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                            title="რედაქტირება"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {isActive && (
                            <button
                              onClick={() => handleDeactivate(emp)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="გათიშვა"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD EMPLOYEE MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                <span>ახალი თანამშრომლის დამატება</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  სახელი & გვარი *
                </label>
                <input
                  type="text"
                  required
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="მაგ: გიორგი ბერიძე"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  ელ-ფოსტა *
                </label>
                <input
                  type="email"
                  required
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="giorgi@medamarket.ge"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  პაროლი *
                </label>
                <input
                  type="password"
                  required
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  სისტემური როლი *
                </label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => setAddRole('CASHIER')}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${
                      addRole === 'CASHIER'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <ShoppingBag className="w-5 h-5" />
                    <span>მოლარე</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAddRole('ADMIN')}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${
                      addRole === 'ADMIN'
                        ? 'border-purple-600 bg-purple-50 text-purple-800 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Shield className="w-5 h-5" />
                    <span>ადმინი</span>
                  </button>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl"
                >
                  გაუქმება
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30"
                >
                  {isSubmitting ? 'ემატება...' : 'დამატება'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT EMPLOYEE MODAL */}
      {isEditModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <h3 className="text-base font-bold">თანამშრომლის რედაქტირება</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  სახელი & გვარი
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  ელ-ფოსტა
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">როლი</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as Role)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-semibold text-slate-700"
                >
                  <option value="CASHIER">მოლარე-ოპერატორი (CASHIER)</option>
                  <option value="ADMIN">ადმინისტრატორი (ADMIN)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                />
                <label htmlFor="editIsActive" className="text-xs font-semibold text-slate-700">
                  აქტიური პროფილი (შეუძლია სისტემაში შესვლა)
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl"
                >
                  გაუქმება
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30"
                >
                  {isSubmitting ? 'ინახება...' : 'შენახვა'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

