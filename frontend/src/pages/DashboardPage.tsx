import React, { useState, useEffect } from 'react'
import { api } from '../services/api'
import { DashboardStats, RevenueChartData, BestSeller, Product } from '../types'
import {
  LayoutDashboard,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  CreditCard,
  Banknote,
  Package,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Award,
  ArrowUpRight,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import toast from 'react-hot-toast'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6']

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [chartData, setChartData] = useState<RevenueChartData[]>([])
  const [bestSellers, setBestSellers] = useState<BestSeller[]>([])
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([])
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily')
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const loadDashboardData = async () => {
    setIsLoading(true)
    try {
      const [statsData, chartRes, bestSellersData, prods] = await Promise.all([
        api.dashboard.getStats(),
        api.dashboard.getRevenueChart({ period }),
        api.dashboard.getBestSellers(),
        api.products.getAll({ lowStock: true }),
      ])
      setStats(statsData)
      setChartData(Array.isArray(chartRes) ? chartRes : [])
      setBestSellers(Array.isArray(bestSellersData) ? bestSellersData : [])
      setLowStockProducts(Array.isArray(prods) ? prods : [])
    } catch (err) {
      console.error(err)
      toast.error('ანალიტიკის ჩატვირთვა ვერ მოხერხდა')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [period])

  // Payment Breakdown for Pie Chart
  const paymentBreakdownData = stats
    ? [
        { name: 'ნაღდი ფული', value: stats.cashRevenue },
        { name: 'საბანკო ბარათი', value: stats.cardRevenue },
      ].filter((d) => d.value > 0)
    : []

  const averageCheck =
    stats && stats.totalTransactions > 0
      ? (stats.totalRevenue / stats.totalTransactions).toFixed(2)
      : '0.00'

  const profitMarginPct =
    stats && stats.totalRevenue > 0
      ? Math.round((stats.grossProfit / stats.totalRevenue) * 100)
      : 0

  return (
    <div className="p-3.5 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600" />
            <span>ანალიტიკა & მოხსენებები</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1">
            ფინანსური შედეგები, შემოსავალი, მოგება და მარაგების ანალიზი
          </p>
        </div>

        {/* Period Selector & Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-xs text-xs font-semibold overflow-x-auto">
            {[
              { id: 'daily', label: '14 დღე' },
              { id: 'weekly', label: 'კვირა' },
              { id: 'monthly', label: 'თვე' },
              { id: 'yearly', label: 'წელი' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id as any)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  period === p.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={loadDashboardData}
            title="განახლება"
            className="p-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl transition-colors shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              მთლიანი შემოსავალი
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <h3 className="text-2xl font-black text-slate-900">
              {(stats?.totalRevenue || 0).toLocaleString('ka-GE', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              <span className="text-sm font-bold text-emerald-600">₾</span>
            </h3>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3" />
              <span>LIVE</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">დღგ-ს ჩათვლით</p>
        </div>

        {/* Gross Profit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              სუფთა მოგება (მარჟა)
            </span>
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <h3 className="text-2xl font-black text-slate-900">
              {(stats?.grossProfit || 0).toLocaleString('ka-GE', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              <span className="text-sm font-bold text-teal-600">₾</span>
            </h3>
            <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
              +{profitMarginPct}%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">შემოსავალი - თვითღირებულება</p>
        </div>

        {/* Total Transactions & Avg Order */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              ტრანზაქციები
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <h3 className="text-2xl font-black text-slate-900">{stats?.totalTransactions || 0}</h3>
            <span className="text-xs font-semibold text-slate-500">
              საშ. ჩეკი: <strong className="text-slate-800">{averageCheck} ₾</strong>
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            გაყიდულია {stats?.totalItemsSold || 0} ერთეული პროდუქტი
          </p>
        </div>

        {/* Low Stock Warning */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              მარაგის გაფრთხილება
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <h3 className="text-2xl font-black text-amber-600">
              {stats?.lowStockProducts || 0}
            </h3>
            <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
              {stats?.outOfStockProducts || 0} ამოწურული
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">საჭიროებს სასწრაფო შევსებას</p>
        </div>
      </div>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Revenue Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">შემოსავლების დინამიკა (₾)</h3>
              <p className="text-xs text-slate-400">დღიური შემოსავლისა და ტრანზაქციების გრაფიკი</p>
            </div>
          </div>

          <div className="flex-1 min-h-[300px]">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                მონაცემები არ არის
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `${val} ₾`}
                  />
                  <Tooltip
                    formatter={(value: any) => [`${value} ₾`, 'შემოსავალი']}
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Payment Methods Breakdown (1 col) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <h3 className="text-sm font-bold text-slate-800 mb-1">გადახდის მეთოდები</h3>
          <p className="text-xs text-slate-400 mb-4">ნაღდი ფული vs საბანკო ბარათი</p>

          <div className="flex-1 min-h-[220px] flex items-center justify-center">
            {paymentBreakdownData.length === 0 ? (
              <div className="text-slate-400 text-xs">გაყიდვები არ ფიქსირდება</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={paymentBreakdownData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {paymentBreakdownData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [`${Number(value).toFixed(2)} ₾`, 'თანხა']}
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(val) => <span className="text-xs text-slate-600">{val}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-center text-xs">
            <div className="bg-emerald-50/50 p-2 rounded-xl">
              <span className="text-slate-400 block text-[10px] font-semibold">ნაღდი</span>
              <strong className="text-emerald-700">
                {(stats?.cashRevenue || 0).toFixed(2)} ₾
              </strong>
            </div>
            <div className="bg-blue-50/50 p-2 rounded-xl">
              <span className="text-slate-400 block text-[10px] font-semibold">ბარათი</span>
              <strong className="text-blue-700">
                {(stats?.cardRevenue || 0).toFixed(2)} ₾
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* TABLES ROW: Best Sellers & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 Best Sellers */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-800">ტოპ გაყიდვადი პროდუქტები (30 დღე)</h3>
          </div>

          {bestSellers.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">გაყიდვების მონაცემი არ არის</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {bestSellers.map((item, idx) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
                        idx === 0
                          ? 'bg-amber-100 text-amber-800'
                          : idx === 1
                          ? 'bg-slate-200 text-slate-700'
                          : idx === 2
                          ? 'bg-amber-50 text-amber-900'
                          : 'bg-slate-50 text-slate-400'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-800 line-clamp-1">{item.name}</p>
                      <span className="text-[10px] font-mono text-slate-400">{item.barcode}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-slate-900">{item.totalQuantity} ცალი</p>
                    <span className="text-[11px] text-emerald-600 font-semibold">
                      {item.totalRevenue.toFixed(2)} ₾
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Replenishment Alerts */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-800">შესავსები მარაგები</h3>
            </div>
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
              {lowStockProducts.length} პოზიცია
            </span>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="text-center py-8 text-emerald-600">
              <Package className="w-8 h-8 mx-auto mb-1 opacity-70" />
              <p className="text-xs font-semibold">ყველა პროდუქტი საკმარისი რაოდენობითაა მარაგში</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {lowStockProducts.map((p) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-slate-800 line-clamp-1">{p.name}</p>
                    <span className="text-[10px] text-slate-400 font-mono">
                      შტრიხ-კოდი: {p.barcode}
                    </span>
                  </div>

                  <div className="text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full font-bold text-[11px] ${
                        p.stock <= 0
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      დარჩა: {p.stock} (მინ: {p.minStockLevel})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

