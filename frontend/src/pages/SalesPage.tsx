import React, { useState, useEffect, useMemo } from 'react'
import { api } from '../services/api'
import { Sale, PaymentMethod, CardBank } from '../types'
import {
  Receipt,
  Search,
  Calendar,
  Filter,
  Eye,
  Printer,
  X,
  CreditCard,
  Banknote,
  Coins,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'

const getBankName = (bank?: string | null) => {
  if (!bank) return 'საქართველოს ბანკი'
  if (bank === 'BOG') return 'საქართველოს ბანკი'
  if (bank === 'TBC') return 'თიბისი'
  if (bank === 'LIBERTY') return 'ლიბერთი'
  if (bank === 'OTHER') return 'სხვა'
  return bank
}

const getBankShortName = (bank?: string | null) => {
  if (!bank) return 'BOG'
  if (bank === 'BOG') return 'BOG'
  if (bank === 'TBC') return 'TBC'
  if (bank === 'LIBERTY') return 'Liberty'
  if (bank === 'OTHER') return 'სხვა'
  return bank
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [total, setTotal] = useState<number>(0)
  const [page, setPage] = useState<number>(1)
  const [limit] = useState<number>(20)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Filters
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [searchReceipt, setSearchReceipt] = useState<string>('')
  const [paymentFilter, setPaymentFilter] = useState<
    'ALL' | PaymentMethod | 'CARD_BOG' | 'CARD_TBC' | 'CARD_LIBERTY' | 'CARD_OTHER'
  >('ALL')

  // Selected Sale for Receipt Modal
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false)
  const [deletingSaleId, setDeletingSaleId] = useState<string | null>(null)

  const handleDeleteSale = async (sale: Sale) => {
    if (
      !window.confirm(
        `ნამდვილად გსურთ ჩეკის #${sale.receiptNumber} წაშლა?\n\nგაყიდული პროდუქტების რაოდენობა ავტომატურად დაბრუნდება საწყობის მარაგში!`
      )
    ) {
      return
    }

    setDeletingSaleId(sale.id)
    try {
      await api.sales.delete(sale.id)
      toast.success(`ჩეკი #${sale.receiptNumber} წაიშალა და მარაგი დაბრუნდა!`)
      loadSales()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'ჩეკის წაშლა ვერ მოხერხდა')
    } finally {
      setDeletingSaleId(null)
    }
  }

  const loadSales = async () => {
    setIsLoading(true)
    try {
      const data = await api.sales.getAll({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        limit,
      })
      setSales(Array.isArray(data?.sales) ? data.sales : [])
      setTotal(typeof data?.total === 'number' ? data.total : 0)
    } catch (err) {
      console.error(err)
      toast.error('გაყიდვების ისტორიის ჩატვირთვა ვერ მოხერხდა')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSales()
  }, [page, startDate, endDate])

  const handlePrint = () => {
    window.print()
  }

  // Filtered in memory for instant responsiveness
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const matchesSearch =
        !searchReceipt ||
        s.receiptNumber.toLowerCase().includes(searchReceipt.toLowerCase()) ||
        s.cashier?.name.toLowerCase().includes(searchReceipt.toLowerCase())

      const matchesPayment =
        paymentFilter === 'ALL'
          ? true
          : paymentFilter === 'CARD_BOG'
          ? s.paymentMethod === 'CARD' && (s.cardBank === 'BOG' || !s.cardBank)
          : paymentFilter === 'CARD_TBC'
          ? s.paymentMethod === 'CARD' && s.cardBank === 'TBC'
          : paymentFilter === 'CARD_LIBERTY'
          ? s.paymentMethod === 'CARD' && s.cardBank === 'LIBERTY'
          : paymentFilter === 'CARD_OTHER'
          ? s.paymentMethod === 'CARD' && s.cardBank !== 'BOG' && s.cardBank !== 'TBC' && s.cardBank !== 'LIBERTY'
          : s.paymentMethod === paymentFilter
      return matchesSearch && matchesPayment
    })
  }, [sales, searchReceipt, paymentFilter])

  // Summary Metrics of loaded sales
  const summary = useMemo(() => {
    const totalRevenue = filteredSales.reduce((acc, s) => acc + Number(s.finalAmount), 0)
    const totalDiscount = filteredSales.reduce((acc, s) => acc + Number(s.discountAmount), 0)
    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      count: filteredSales.length,
    }
  }, [filteredSales])

  const totalPages = Math.ceil(total / limit) || 1

  return (
    <div className="p-3.5 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600" />
            <span>გაყიდვების ისტორია</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1">
            დასრულებული ჩეკების, ოპერაციების რეესტრი და ფისკალური დეტალები
          </p>
        </div>

        <button
          onClick={loadSales}
          title="განახლება"
          className="self-start sm:self-auto p-2 sm:p-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl transition-colors shadow-xs flex items-center gap-2 text-xs font-semibold"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>განახლება</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase">ჯამური თანხა (სიაში)</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">
              {summary.totalRevenue.toFixed(2)} ₾
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase">ჩეკების რაოდენობა</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{total} ტრანზაქცია</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase">გაცემული ფასდაკლება</p>
            <p className="text-xl font-black text-rose-600 mt-0.5">
              -{summary.totalDiscount.toFixed(2)} ₾
            </p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          {/* Search Receipt */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchReceipt}
              onChange={(e) => setSearchReceipt(e.target.value)}
              placeholder="მოძებნეთ ქვითრის # ან მოლარის სახელით..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Date from */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-semibold whitespace-nowrap">დან:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setPage(1)
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Date to */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-semibold whitespace-nowrap">მდე:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setPage(1)
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Payment Method filter chips */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            გადახდის ტიპი:
          </span>
          {[
            { id: 'ALL', label: 'ყველა' },
            { id: 'CASH', label: 'ნაღდი' },
            { id: 'CARD', label: 'ბარათი (ყველა)' },
            { id: 'CARD_BOG', label: 'საქართველო' },
            { id: 'CARD_TBC', label: 'თიბისი' },
            { id: 'CARD_LIBERTY', label: 'ლიბერთი' },
            { id: 'CARD_OTHER', label: 'სხვა ბანკი' },
            { id: 'MIXED', label: 'შერეული' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setPaymentFilter(item.id as any)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                paymentFilter === item.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">ქვითარი #</th>
                <th className="py-3 px-4">თარიღი & დრო</th>
                <th className="py-3 px-4">მოლარე</th>
                <th className="py-3 px-4 text-center">ერთეულები</th>
                <th className="py-3 px-4 text-center">გადახდის მეთოდი</th>
                <th className="py-3 px-4 text-right">ფასდაკლება</th>
                <th className="py-3 px-4 text-right">სულ თანხა</th>
                <th className="py-3 px-4 text-right">მოქმედება</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    გაყიდვები ვერ მოიძებნა
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => {
                  const itemCount = sale.items?.reduce((s, i) => s + i.quantity, 0) || 0
                  const dateStr = new Date(sale.createdAt).toLocaleString('ka-GE', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })

                  return (
                    <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Receipt number */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {sale.receiptNumber}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{dateStr}</td>

                      {/* Cashier */}
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {sale.cashier?.name || 'მოლარე'}
                      </td>

                      {/* Items */}
                      <td className="py-3 px-4 text-center">
                        <span className="bg-slate-100 px-2 py-0.5 rounded-full font-bold text-slate-700">
                          {itemCount} ცალი
                        </span>
                      </td>

                      {/* Payment Method Badge */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                            sale.paymentMethod === 'CASH'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : sale.paymentMethod === 'CARD'
                              ? sale.cardBank === 'BOG'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : sale.cardBank === 'TBC'
                                ? 'bg-sky-50 text-sky-800 border border-sky-200'
                                : sale.cardBank === 'LIBERTY'
                                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                : 'bg-slate-100 text-slate-800 border border-slate-300'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}
                        >
                          {sale.paymentMethod === 'CASH' && <Banknote className="w-3 h-3" />}
                          {sale.paymentMethod === 'CARD' && <CreditCard className="w-3 h-3" />}
                          {sale.paymentMethod === 'MIXED' && <Coins className="w-3 h-3" />}
                          <span>
                            {sale.paymentMethod === 'CASH'
                              ? 'ნაღდი'
                              : sale.paymentMethod === 'CARD'
                              ? `ბარათი (${getBankShortName(sale.cardBank)})`
                              : sale.cardBank
                              ? `შერეული (${getBankShortName(sale.cardBank)})`
                              : 'შერეული'}
                          </span>
                        </span>
                      </td>

                      {/* Discount */}
                      <td className="py-3 px-4 text-right font-medium text-slate-500">
                        {Number(sale.discountAmount) > 0 ? (
                          <span className="text-rose-600 font-bold">
                            -{Number(sale.discountAmount).toFixed(2)} ₾
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Final Amount */}
                      <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">
                        {Number(sale.finalAmount).toFixed(2)} ₾
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedSale(sale)
                              setIsReceiptModalOpen(true)
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs inline-flex items-center gap-1 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>ქვითარი</span>
                          </button>
                          <button
                            onClick={() => handleDeleteSale(sale)}
                            disabled={deletingSaleId === sale.id}
                            title="ჩეკის წაშლა და მარაგის დაბრუნება"
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg font-bold text-xs inline-flex items-center justify-center transition-colors disabled:opacity-50"
                          >
                            {deletingSaleId === sale.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
          <div>
            სულ: <strong>{total}</strong> ჩეკი (გვერდი {page} / {totalPages})
          </div>
          <div className="flex items-center gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="p-1.5 rounded-lg border bg-white border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-bold text-slate-800">{page}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="p-1.5 rounded-lg border bg-white border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* RECEIPT VIEW MODAL */}
      {isReceiptModalOpen && selectedSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <span className="font-bold text-sm">ქვითრის დეტალები</span>
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thermal Printable Receipt */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
              <div
                id="receipt-print"
                className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs font-mono text-xs text-slate-800 leading-relaxed mx-auto w-full"
              >
                {/* Header */}
                <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-3">
                  <h4 className="font-extrabold text-base tracking-wider text-slate-900">MEDA MARKET</h4>
                  <p className="text-[11px] text-slate-500">შპს მედა მარკეტ</p>
                  <p className="text-[10px] text-slate-400">საიდენტ. კოდი: 405123456</p>
                </div>

                {/* Metadata */}
                <div className="space-y-0.5 border-b border-dashed border-slate-300 pb-2 mb-2 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">ქვითარი #:</span>
                    <span className="font-bold">{selectedSale.receiptNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">თარიღი:</span>
                    <span>{new Date(selectedSale.createdAt).toLocaleString('ka-GE')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">მოლარე:</span>
                    <span>{selectedSale.cashier?.name}</span>
                  </div>
                </div>

                {/* Items */}
                <div className="border-b border-dashed border-slate-300 pb-2 mb-2">
                  <div className="flex justify-between font-bold text-[10px] text-slate-400 uppercase mb-1">
                    <span>პროდუქტი</span>
                    <span>ჯამი</span>
                  </div>
                  <div className="space-y-1">
                    {selectedSale.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start text-[11px]">
                        <div className="max-w-[70%]">
                          <p className="font-medium text-slate-800 truncate">
                            {item.product?.name || 'პროდუქტი'}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {item.quantity < 1 || !Number.isInteger(item.quantity)
                              ? `${item.quantity} კგ (${Math.round(item.quantity * 1000)}გ)`
                              : `${item.quantity} ცალი`}{' '}
                            × {Number(item.unitPrice).toFixed(2)} ₾
                          </p>
                        </div>
                        <span className="font-semibold text-slate-900">
                          {Number(item.totalPrice).toFixed(2)} ₾
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">ქვეჯამი:</span>
                    <span>{Number(selectedSale.totalAmount).toFixed(2)} ₾</span>
                  </div>
                  {Number(selectedSale.discountAmount) > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>ფასდაკლება:</span>
                      <span>-{Number(selectedSale.discountAmount).toFixed(2)} ₾</span>
                    </div>
                  )}
                  <div className="flex justify-between font-extrabold text-sm border-t border-slate-900 pt-1 mt-1 text-slate-900">
                    <span>სულ გადახდილი:</span>
                    <span>{Number(selectedSale.finalAmount).toFixed(2)} ₾</span>
                  </div>
                  <div className="flex justify-between text-slate-600 text-[10px] pt-1">
                    <span>გადახდის მეთოდი:</span>
                    <span>
                      {selectedSale.paymentMethod === 'CASH'
                        ? 'ნაღდი'
                        : selectedSale.paymentMethod === 'CARD'
                        ? `ბარათი (${getBankName(selectedSale.cardBank)})`
                        : selectedSale.cardBank
                        ? `შერეული (${getBankName(selectedSale.cardBank)})`
                        : 'შერეული'}
                    </span>
                  </div>
                </div>

                <div className="text-center border-t border-dashed border-slate-300 pt-3 mt-3 text-[10px] text-slate-400">
                  <p className="font-semibold text-slate-600">გმადლობთ შენაძენისთვის!</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>ამობეჭდვა</span>
              </button>
              <button
                type="button"
                onClick={() => setIsReceiptModalOpen(false)}
                className="px-4 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                დახურვა
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

