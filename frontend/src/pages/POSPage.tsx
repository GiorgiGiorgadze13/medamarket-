import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { api, getErrorMessage } from '../services/api'
import { Product, Category, Sale, PaymentMethod, CardBank } from '../types'
import { useCart } from '../hooks/useCart'
import { useBarcodeScanner } from '../hooks/useBarcodeScanner'
import {
  Search,
  Barcode,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  Coins,
  Printer,
  CheckCircle,
  X,
  RefreshCw,
  Tag,
  ArrowRight,
  ChevronDown,
  Scale,
  Percent,
} from 'lucide-react'
import toast from 'react-hot-toast'

// Web Audio API beep for barcode scan feedback
function playBeep(type: 'success' | 'error' = 'success') {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    if (type === 'success') {
      osc.frequency.setValueAtTime(1200, ctx.currentTime)
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.08)
    } else {
      osc.frequency.setValueAtTime(300, ctx.currentTime)
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.2)
    }
  } catch {
    // AudioContext blocked or unsupported
  }
}

export const CARD_BANKS = [
  {
    id: 'BOG' as const,
    label: 'საქართველოს ბანკი',
    shortLabel: 'საქართველო',
    activeClass: 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs font-bold ring-2 ring-amber-400/40',
    inactiveClass: 'border-slate-200 bg-white text-slate-700 hover:border-amber-300 hover:bg-amber-50/30',
    indicator: 'bg-amber-500',
    iconColor: 'text-amber-600',
  },
  {
    id: 'TBC' as const,
    label: 'თიბისი',
    shortLabel: 'თიბისი',
    activeClass: 'border-sky-500 bg-sky-50 text-sky-900 shadow-xs font-bold ring-2 ring-sky-400/40',
    inactiveClass: 'border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50/30',
    indicator: 'bg-sky-500',
    iconColor: 'text-sky-600',
  },
  {
    id: 'LIBERTY' as const,
    label: 'ლიბერთი',
    shortLabel: 'ლიბერთი',
    activeClass: 'border-rose-500 bg-rose-50 text-rose-900 shadow-xs font-bold ring-2 ring-rose-400/40',
    inactiveClass: 'border-slate-200 bg-white text-slate-700 hover:border-rose-300 hover:bg-rose-50/30',
    indicator: 'bg-rose-500',
    iconColor: 'text-rose-600',
  },
  {
    id: 'OTHER' as const,
    label: 'სხვა',
    shortLabel: 'სხვა',
    activeClass: 'border-slate-700 bg-slate-100 text-slate-900 shadow-xs font-bold ring-2 ring-slate-400/40',
    inactiveClass: 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
    indicator: 'bg-slate-700',
    iconColor: 'text-slate-600',
  },
] as const

export function getCardBankLabel(bankId?: string | null) {
  if (!bankId) return 'საქართველოს ბანკი'
  const match = CARD_BANKS.find((b) => b.id === bankId)
  return match?.label || bankId
}

export default function POSPage() {
  const { user } = useAuth()
  const {
    cart,
    addToCart,
    updateQuantity,
    syncCartWithProducts,
    setItemDiscount,
    removeFromCart,
    clearCart,
    discount,
    setDiscount,
    originalSubtotal,
    subtotal,
    itemDiscountsTotal,
    totalDiscount,
    total,
    totalItems,
  } = useCart()

  // State
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Mobile Drawer State
  const [isMobileCartOpen, setIsMobileCartOpen] = useState<boolean>(false)

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [selectedCardBank, setSelectedCardBank] = useState<CardBank>('BOG')
  const [customBankName, setCustomBankName] = useState<string>('')
  const [cashTendered, setCashTendered] = useState<string>('')
  const [mixedCash, setMixedCash] = useState<string>('')
  const [mixedCard, setMixedCard] = useState<string>('')
  const [isSubmittingSale, setIsSubmittingSale] = useState<boolean>(false)
  const [checkoutIdempotencyKey, setCheckoutIdempotencyKey] = useState<string>('')

  // Receipt Modal State
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false)

  // Discount modal / input state
  const [showDiscountInput, setShowDiscountInput] = useState<boolean>(false)
  const [discountInputValue, setDiscountInputValue] = useState<string>('0')

  // Weight / Gram Calculator Modal State
  const [weightModalItem, setWeightModalItem] = useState<{
    productId: string
    productName: string
    unitPrice: number
    currentQty: number
    stock: number
  } | null>(null)
  const [gramInput, setGramInput] = useState<string>('')

  const openWeightModal = (item: {
    productId: string
    productName: string
    unitPrice: number
    currentQty: number
    stock: number
  }) => {
    setWeightModalItem(item)
    const initialGrams = item.currentQty > 0 ? Math.round(item.currentQty * 1000) : 500
    setGramInput(String(initialGrams))
  }

  const handleApplyWeight = () => {
    if (!weightModalItem) return
    const targetProduct = products.find((p) => p.id === weightModalItem.productId)
    if (targetProduct && !targetProduct.isWeighted) {
      toast.error(`"${weightModalItem.productName}" არ არის წონითი პროდუქტი!`)
      setWeightModalItem(null)
      return
    }

    const grams = parseFloat(gramInput)
    if (isNaN(grams) || grams <= 0) {
      toast.error('გთხოვთ მიუთითოთ სწორი წონა გრამებში')
      return
    }

    const kg = Math.round((grams / 1000) * 1000) / 1000
    if (kg > weightModalItem.stock) {
      toast.error(`მარაგში დარჩენილია მხოლოდ ${weightModalItem.stock} კგ!`)
      return
    }

    updateQuantity(weightModalItem.productId, kg, weightModalItem.stock)
    toast.success(`${weightModalItem.productName}: ${grams}გ (${kg} კგ)`)
    setWeightModalItem(null)
    setGramInput('')
  }

  // Per-Product Discount Modal State
  const [discountModalItem, setDiscountModalItem] = useState<{
    productId: string
    productName: string
    unitPrice: number
    currentDiscountPercent?: number
  } | null>(null)
  const [itemDiscountInput, setItemDiscountInput] = useState<string>('10')

  const openDiscountModal = (item: {
    productId: string
    productName: string
    unitPrice: number
    currentDiscountPercent?: number
  }) => {
    setDiscountModalItem(item)
    setItemDiscountInput(String(item.currentDiscountPercent || 10))
  }

  const handleApplyItemDiscount = () => {
    if (!discountModalItem) return
    const pct = Math.min(100, Math.max(0, parseFloat(itemDiscountInput) || 0))
    setItemDiscount(discountModalItem.productId, pct)
    if (pct > 0) {
      toast.success(`${discountModalItem.productName}: -${pct}% ფასდაკლება დაყენდა!`)
    } else {
      toast.success(`${discountModalItem.productName}: ფასდაკლება გაუქმდა`)
    }
    setDiscountModalItem(null)
    setItemDiscountInput('10')
  }

  // Search input ref for manual barcode typing or text search
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Load products and categories
  const fetchData = async (isSilent = false) => {
    if (!isSilent) {
      setIsLoading(true)
    }
    try {
      const [prodsData, catsData] = await Promise.all([
        api.products.getAll(),
        api.products.getCategories(),
      ])
      const loadedProducts = Array.isArray(prodsData) ? prodsData : []
      setProducts(loadedProducts)
      setCategories(Array.isArray(catsData) ? catsData : [])
      syncCartWithProducts(loadedProducts)
    } catch (err) {
      console.error(err)
      if (!isSilent) {
        toast.error('პროდუქტების ჩატვირთვა ვერ მოხერხდა')
      }
    } finally {
      if (!isSilent) {
        setIsLoading(false)
      }
    }
  }

  useEffect(() => {
    fetchData(false)

    const handleFocus = () => {
      fetchData(true)
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchData(true)
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Handle Barcode Scanned via USB HID Scanner Listener
  const handleBarcodeScanned = async (barcode: string) => {
    const cleanBarcode = barcode.trim()
    if (!cleanBarcode) return

    // 1. Look in loaded products
    const existing = products.find((p) => p.barcode === cleanBarcode)
    if (existing) {
      if (existing.stock <= 0) {
        playBeep('error')
        toast.error(`"${existing.name}" მარაგში აღარ არის!`)
        return
      }
      const added = addToCart(existing, 1)
      if (added) {
        playBeep('success')
        toast.success(`+ ${existing.name}`)
      } else {
        playBeep('error')
      }
      return
    }

    // 2. Query backend fallback
    try {
      const fetched = await api.products.getByBarcode(cleanBarcode)
      if (fetched) {
        if (fetched.stock <= 0) {
          playBeep('error')
          toast.error(`"${fetched.name}" მარაგში აღარ არის!`)
          return
        }
        const added = addToCart(fetched, 1)
        if (added) {
          playBeep('success')
          toast.success(`+ ${fetched.name}`)
        } else {
          playBeep('error')
        }
      }
    } catch {
      playBeep('error')
      toast.error(`შტრიხ-კოდი "${cleanBarcode}" ვერ მოიძებნა`)
    }
  }

  // USB HID barcode scanner listener
  useBarcodeScanner({
    onScan: handleBarcodeScanned,
    enabled: !isPaymentModalOpen && !isReceiptModalOpen && !weightModalItem && !discountModalItem,
  })

  // Keyboard shortcut F4 to open payment
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F4' || (e.key === 'Enter' && e.ctrlKey)) {
        if (cart.length > 0 && !isPaymentModalOpen && !isReceiptModalOpen) {
          e.preventDefault()
          handleOpenPayment()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cart, isPaymentModalOpen, isReceiptModalOpen])

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return (products || []).filter((p) => {
      const matchesCategory = selectedCategory === 'ALL' || p.categoryId === selectedCategory
      const query = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !query ||
        p.name.toLowerCase().includes(query) ||
        p.barcode.toLowerCase().includes(query)
      return matchesCategory && matchesSearch
    })
  }, [products, selectedCategory, searchQuery])

  // Open Payment modal
  const handleOpenPayment = () => {
    if (cart.length === 0) {
      toast.error('კალათა ცარიელია')
      return
    }
    // Generate fresh idempotency key for this checkout attempt
    const newKey = `pos_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    setCheckoutIdempotencyKey(newKey)

    setIsMobileCartOpen(false)
    setPaymentMethod('CASH')
    setSelectedCardBank('BOG')
    setCustomBankName('')
    setCashTendered(total.toString())
    setMixedCash((total / 2).toFixed(2))
    setMixedCard((total / 2).toFixed(2))
    setIsPaymentModalOpen(true)
  }

  // Change calculation
  const cashNum = parseFloat(cashTendered) || 0
  const changeDue = Math.max(0, Math.round((cashNum - total) * 100) / 100)
  const isCashSufficient = cashNum >= total

  const mixedCashNum = parseFloat(mixedCash) || 0
  const mixedCardNum = parseFloat(mixedCard) || 0
  const mixedTotalPaid = mixedCashNum + mixedCardNum
  const isMixedSufficient = mixedTotalPaid >= total
  const mixedChangeDue = Math.max(0, Math.round((mixedTotalPaid - total) * 100) / 100)

  // Submit Sale
  const handleCompleteSale = async () => {
    if (cart.length === 0) return

    if (paymentMethod === 'CASH' && !isCashSufficient) {
      toast.error('მიღებული თანხა ნაკლებია გადასახდელზე!')
      return
    }

    if (paymentMethod === 'MIXED' && !isMixedSufficient) {
      toast.error('ჯამური გადახდილი თანხა ნაკლებია გადასახდელზე!')
      return
    }

    setIsSubmittingSale(true)
    try {
      const keyToUse =
        checkoutIdempotencyKey || `pos_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      if (!checkoutIdempotencyKey) {
        setCheckoutIdempotencyKey(keyToUse)
      }

      const payload: any = {
        idempotencyKey: keyToUse,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          discountPercent: item.discountPercent || 0,
        })),
        paymentMethod,
        discountAmount: totalDiscount,
      }

      const resolvedCardBank =
        selectedCardBank === 'OTHER'
          ? customBankName.trim() || 'სხვა'
          : selectedCardBank

      if (paymentMethod === 'CASH') {
        payload.cashAmount = cashNum
      } else if (paymentMethod === 'CARD') {
        payload.cardAmount = total
        payload.cardBank = resolvedCardBank
      } else if (paymentMethod === 'MIXED') {
        payload.cashAmount = mixedCashNum
        payload.cardAmount = mixedCardNum
        payload.cardBank = resolvedCardBank
      }

      const createdSale = await api.sales.create(payload)

      // Refresh product stock locally
      setProducts((prev) =>
        prev.map((p) => {
          const itemInCart = cart.find((c) => c.product.id === p.id)
          if (itemInCart) {
            return { ...p, stock: Math.max(0, p.stock - itemInCart.quantity) }
          }
          return p
        })
      )

      clearCart()
      setIsPaymentModalOpen(false)
      setCompletedSale(createdSale)
      setIsReceiptModalOpen(true)
      toast.success('გაყიდვა წარმატებით დასრულდა!')
    } catch (err: any) {
      console.error(err)
      toast.error(getErrorMessage(err, 'გაყიდვის გატარება ვერ მოხერხდა'))
    } finally {
      setIsSubmittingSale(false)
    }
  }

  // Thermal Print Trigger
  const handlePrintReceipt = () => {
    window.print()
  }

  // Fast cash tender buttons
  const cashPresets = useMemo(() => {
    const list = [total]
    const round5 = Math.ceil(total / 5) * 5
    if (round5 > total && !list.includes(round5)) list.push(round5)
    const round10 = Math.ceil(total / 10) * 10
    if (round10 > total && !list.includes(round10)) list.push(round10)
    const round20 = Math.ceil(total / 20) * 20
    if (round20 > total && !list.includes(round20)) list.push(round20)
    const round50 = Math.ceil(total / 50) * 50
    if (round50 > total && !list.includes(round50)) list.push(round50)
    const round100 = Math.ceil(total / 100) * 100
    if (round100 > total && !list.includes(round100)) list.push(round100)
    return list.slice(0, 5)
  }, [total])

  // Reusable Cart UI (used in both desktop sidebar & mobile drawer)
  const renderCartUI = (isMobileDrawer = false) => (
    <div className="flex flex-col h-full bg-white">
      {/* Cart Header */}
      <div className="p-3.5 sm:p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
            <ShoppingCart className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">მიმდინარე კალათა</h2>
            <p className="text-[11px] text-slate-500">{totalItems} პროდუქტი</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>გასუფთავება</span>
            </button>
          )}
          {isMobileDrawer && (
            <button
              onClick={() => setIsMobileCartOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <ShoppingCart className="w-7 h-7 sm:w-8 sm:h-8 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-700">კალათა ცარიელია</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
              დაასკანერეთ შტრიხ-კოდი ან აირჩიეთ პროდუქტი კატალოგიდან
            </p>
          </div>
        ) : (
          cart.map((item) => {
            const basePrice = Number(item.product.sellingPrice) || 0
            const discountPct = Number(item.discountPercent) || 0
            const effectivePrice =
              discountPct > 0
                ? Math.max(0, Math.round(basePrice * (1 - discountPct / 100) * 100) / 100)
                : basePrice
            const itemTotal = (effectivePrice * item.quantity).toFixed(2)
            const catalogProduct = products.find((p) => p.id === item.product.id)
            const maxStock = catalogProduct ? catalogProduct.stock : item.product.stock
            const isWeighted = Boolean(item.product.isWeighted ?? catalogProduct?.isWeighted)

            return (
              <div
                key={item.product.id}
                className="p-2.5 flex items-center gap-2 sm:gap-3 hover:bg-slate-50 rounded-xl transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-xs font-semibold text-slate-800 truncate leading-snug">
                      {item.product.name}
                    </p>
                    {isWeighted && (
                      <span className="px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded text-[10px] font-bold inline-flex items-center gap-0.5">
                        <Scale className="w-2.5 h-2.5" /> კგ
                      </span>
                    )}
                    {discountPct > 0 && (
                      <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded text-[10px] font-black inline-flex items-center gap-0.5 shadow-xs">
                        <Percent className="w-2.5 h-2.5" /> -{discountPct}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {discountPct > 0 ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-[11px] line-through text-slate-400">
                          {basePrice.toFixed(2)} ₾
                        </span>
                        <span className="text-xs font-black text-rose-600">
                          {effectivePrice.toFixed(2)} ₾
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-slate-500">
                        {basePrice.toFixed(2)} ₾
                      </span>
                    )}
                    {isWeighted && (item.quantity < 1 || !Number.isInteger(item.quantity)) ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-200">
                        {item.quantity} კგ ({Math.round(item.quantity * 1000)}გ)
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                        ({item.product.barcode})
                      </span>
                    )}
                    {isWeighted && (
                      <button
                        type="button"
                        onClick={() =>
                          openWeightModal({
                            productId: item.product.id,
                            productName: item.product.name,
                            unitPrice: effectivePrice,
                            currentQty: item.quantity,
                            stock: maxStock,
                          })
                        }
                        title="წონის შეყვანა (გრამი / კგ)"
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded transition-colors"
                      >
                        <Scale className="w-3 h-3 text-blue-600" />
                        <span>წონა</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        openDiscountModal({
                          productId: item.product.id,
                          productName: item.product.name,
                          unitPrice: basePrice,
                          currentDiscountPercent: item.discountPercent,
                        })
                      }
                      title="ფასდაკლების მითითება (%)"
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${
                        discountPct > 0
                          ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                          : 'text-slate-600 bg-slate-100 hover:bg-rose-50 hover:text-rose-700'
                      }`}
                    >
                      <Percent className="w-3 h-3 text-rose-500" />
                      <span>{discountPct > 0 ? `-${discountPct}%` : 'ფასდაკლება'}</span>
                    </button>
                  </div>
                </div>

                {/* Quantity controls */}
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                  <button
                    onClick={() => {
                      if (isWeighted) {
                        const step = item.quantity <= 1 ? 0.1 : 1
                        updateQuantity(item.product.id, Math.round((item.quantity - step) * 100) / 100, maxStock)
                      } else {
                        updateQuantity(item.product.id, Math.max(1, Math.round(item.quantity - 1)), maxStock)
                      }
                    }}
                    className="w-6 h-6 rounded flex items-center justify-center bg-white text-slate-700 hover:bg-slate-200 transition-colors shadow-xs"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="number"
                    step={isWeighted ? 'any' : '1'}
                    min={isWeighted ? '0.001' : '1'}
                    max={maxStock}
                    value={item.quantity}
                    onChange={(e) => {
                      const rawVal = parseFloat(e.target.value)
                      if (!isNaN(rawVal) && rawVal > 0) {
                        const val = isWeighted ? rawVal : Math.max(1, Math.round(rawVal))
                        updateQuantity(item.product.id, val, maxStock)
                      }
                    }}
                    className="w-12 text-center text-xs font-bold bg-white border border-slate-200 rounded py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    onClick={() => {
                      if (isWeighted) {
                        const step = item.quantity < 1 ? 0.1 : 1
                        updateQuantity(item.product.id, Math.round((item.quantity + step) * 100) / 100, maxStock)
                      } else {
                        updateQuantity(item.product.id, Math.round(item.quantity + 1), maxStock)
                      }
                    }}
                    disabled={item.quantity >= maxStock}
                    className="w-6 h-6 rounded flex items-center justify-center bg-white text-slate-700 hover:bg-slate-200 transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Item Total */}
                <div className="text-right w-14 sm:w-16">
                  <span className="text-xs font-bold text-slate-900 block">{itemTotal} ₾</span>
                </div>

                {/* Delete button */}
                <button
                  onClick={() => removeFromCart(item.product.id)}
                  className="text-slate-300 hover:text-rose-600 p-1 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Cart Summary & Checkout Footer */}
      <div className="border-t border-slate-200 bg-slate-50 p-3.5 sm:p-4 space-y-3 shrink-0">
        {/* Subtotal */}
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>ქვეჯამი:</span>
          {itemDiscountsTotal > 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="line-through text-slate-400 font-normal">
                {originalSubtotal.toFixed(2)} ₾
              </span>
              <span className="font-bold text-slate-900">{subtotal.toFixed(2)} ₾</span>
            </div>
          ) : (
            <span className="font-semibold text-slate-800">{subtotal.toFixed(2)} ₾</span>
          )}
        </div>

        {/* Product discounts breakdown if any */}
        {itemDiscountsTotal > 0 && (
          <div className="flex items-center justify-between text-xs text-rose-600 font-medium">
            <span className="flex items-center gap-1">
              <Percent className="w-3 h-3" />
              <span>პროდუქტის ფასდაკლება:</span>
            </span>
            <span className="font-bold">-{itemDiscountsTotal.toFixed(2)} ₾</span>
          </div>
        )}

        {/* Discount Line */}
        <div className="flex items-center justify-between text-xs">
          <button
            onClick={() => {
              setShowDiscountInput(!showDiscountInput)
              setDiscountInputValue(discount.toString())
            }}
            className="text-emerald-700 hover:text-emerald-800 font-medium flex items-center gap-1 underline underline-offset-2"
          >
            <Tag className="w-3 h-3" />
            <span>ჩეკის ფასდაკლება {discount > 0 ? `(-${discount} ₾)` : '+'}</span>
          </button>
          {discount > 0 && (
            <span className="font-semibold text-rose-600">-{discount.toFixed(2)} ₾</span>
          )}
        </div>

        {/* Discount Input toggle */}
        {showDiscountInput && (
          <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max={subtotal}
                step="0.5"
                value={discountInputValue}
                onChange={(e) => setDiscountInputValue(e.target.value)}
                placeholder="0.00"
                className="flex-1 px-2.5 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
              <button
                onClick={() => {
                  const num = parseFloat(discountInputValue) || 0
                  setDiscount(Math.min(subtotal, Math.max(0, num)))
                  setShowDiscountInput(false)
                }}
                className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700"
              >
                შენახვა
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              {[5, 10, 15, 20].map((pct) => (
                <button
                  key={pct}
                  onClick={() => {
                    const val = Math.round(((subtotal * pct) / 100) * 100) / 100
                    setDiscount(val)
                    setShowDiscountInput(false)
                  }}
                  className="flex-1 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 rounded text-slate-700"
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Grand Total */}
        <div className="pt-2 border-t border-slate-200 flex items-baseline justify-between">
          <div>
            <span className="text-xs uppercase font-extrabold tracking-wider text-slate-500 block">
              სულ გადასახდელი
            </span>
            <span className="text-[11px] text-slate-400">დღგ ჩათვლით</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight">
            {total.toFixed(2)} <span className="text-base sm:text-lg font-bold">₾</span>
          </div>
        </div>

        {/* Checkout Button */}
        <button
          onClick={handleOpenPayment}
          disabled={cart.length === 0}
          className="w-full py-3 sm:py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 text-sm sm:text-base transition-all duration-150"
        >
          <span>გადახდა (F4)</span>
          <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col lg:flex-row h-full bg-slate-100 overflow-hidden select-none font-sans relative">
      {/* PRODUCTS & CATALOG AREA */}
      <div className="flex-1 flex flex-col h-full overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-200 pb-16 lg:pb-0">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-slate-200 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4 shadow-xs shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-200 text-[11px] sm:text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <Barcode className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
              <span className="hidden sm:inline">USB HID სკანერი აქტიურია</span>
              <span className="sm:hidden">სკანერი ON</span>
            </div>
            <span className="text-xs text-slate-400 hidden sm:inline">|</span>
            <span className="text-xs font-medium text-slate-600 truncate max-w-[140px] sm:max-w-none">
              მოლარე: <strong className="text-slate-800">{user?.name}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchData(false)}
              title="მონაცემების განახლება"
              className="p-1.5 sm:p-2 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <div className="text-right hidden sm:block">
              <span className="text-xs font-bold text-slate-700 block">მე და მარკეტი #1</span>
              <span className="text-[11px] text-slate-400">Batumi, საქართველო</span>
            </div>
          </div>
        </header>

        {/* Search & Category Filter */}
        <div className="bg-white border-b border-slate-200 p-3 sm:p-4 space-y-2.5 sm:space-y-3 shrink-0">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const trimmed = searchQuery.trim()
                  if (!trimmed) return

                  // 1. Check exact barcode match first
                  const barcodeMatch = products.find(
                    (p) => p.barcode.toLowerCase() === trimmed.toLowerCase()
                  )
                  if (barcodeMatch) {
                    if (barcodeMatch.stock <= 0) {
                      playBeep('error')
                      toast.error(`"${barcodeMatch.name}" მარაგში აღარ არის!`)
                      return
                    }
                    const added = addToCart(barcodeMatch, 1)
                    if (added) {
                      playBeep('success')
                      toast.success(`+ ${barcodeMatch.name}`)
                      setSearchQuery('')
                    }
                    return
                  }

                  // 2. If filteredProducts has matches, add the top match
                  if (filteredProducts.length > 0) {
                    const topMatch = filteredProducts[0]
                    if (topMatch.stock <= 0) {
                      playBeep('error')
                      toast.error(`"${topMatch.name}" მარაგში აღარ არის!`)
                      return
                    }
                    const added = addToCart(topMatch, 1)
                    if (added) {
                      playBeep('success')
                      toast.success(`+ ${topMatch.name}`)
                      setSearchQuery('')
                    }
                    return
                  }

                  // 3. Fallback to API barcode search
                  handleBarcodeScanned(trimmed)
                  setSearchQuery('')
                }
              }}
              placeholder="მოძებნეთ დასახელებით ან შტრიხ-კოდით (Enter)..."
              className="w-full pl-10 pr-9 py-2 sm:py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Categories Horizontal Scroll */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ყველა ({(products || []).length})
            </button>
            {(categories || []).map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Catalog Grid */}
        <div className="flex-1 overflow-y-auto p-2.5 sm:p-4">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-xs text-slate-500 font-medium">იტვირთება პროდუქტები...</p>
              </div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <Barcode className="w-12 h-12 mb-2 stroke-1" />
              <p className="text-sm font-medium">პროდუქტი ვერ მოიძებნა</p>
              <p className="text-xs text-slate-400 mt-1">შეცვალეთ ძებნის პარამეტრები ან დაასკანერეთ კოდი</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-3">
              {filteredProducts.map((product) => {
                const isOutOfStock = product.stock <= 0
                const isLowStock = !isOutOfStock && product.stock <= product.minStockLevel
                const cartItem = cart.find((i) => i.product.id === product.id)
                const cartQty = cartItem?.quantity || 0
                const cartItemDiscount = cartItem?.discountPercent
                const basePrice = Number(product.sellingPrice) || 0
                const effectivePrice = cartItemDiscount
                  ? Math.max(0, Math.round(basePrice * (1 - cartItemDiscount / 100) * 100) / 100)
                  : basePrice

                return (
                  <button
                    key={product.id}
                    type="button"
                    disabled={isOutOfStock}
                    onClick={() => {
                      const added = addToCart(product, 1)
                      if (added) {
                        playBeep('success')
                        toast.success(`+ ${product.name}`, { duration: 1500, id: `pos_add_${product.id}` })
                      }
                    }}
                    className={`relative text-left bg-white rounded-xl p-2.5 sm:p-3 border transition-all duration-150 flex flex-col justify-between group ${
                      isOutOfStock
                        ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-50'
                        : 'border-slate-200 hover:border-emerald-500 hover:shadow-md active:scale-[0.98]'
                    }`}
                  >
                    {/* Top: Category & Cart Badge / Actions */}
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-[10px] font-medium text-slate-400 truncate uppercase tracking-wider">
                        {product.category?.name || 'სხვა'}
                      </span>
                      <div className="flex items-center gap-1">
                        {/* Weight action - ONLY for weighted products */}
                        {product.isWeighted && (
                          <span
                            role="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (cartQty === 0) {
                                addToCart(product, 0.5)
                              }
                              openWeightModal({
                                productId: product.id,
                                productName: product.name,
                                unitPrice: effectivePrice,
                                currentQty: cartQty > 0 ? cartQty : 0.5,
                                stock: product.stock,
                              })
                            }}
                            title="წონის არჩევა (გრამი / კგ)"
                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                          >
                            <Scale className="w-3.5 h-3.5" />
                          </span>
                        )}

                        {/* Discount action */}
                        <span
                          role="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (cartQty === 0) {
                              addToCart(product, 1)
                            }
                            openDiscountModal({
                              productId: product.id,
                              productName: product.name,
                              unitPrice: basePrice,
                              currentDiscountPercent: cartItemDiscount,
                            })
                          }}
                          title="ფასდაკლების მითითება (%)"
                          className={`p-1 rounded transition-colors cursor-pointer ${
                            cartItemDiscount
                              ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                              : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                          }`}
                        >
                          <Percent className="w-3.5 h-3.5" />
                        </span>

                        {/* Discount badge if active */}
                        {cartItemDiscount && (
                          <span className="px-1.5 py-0.5 bg-rose-500 text-white rounded text-[10px] font-black shadow-xs">
                            -{cartItemDiscount}%
                          </span>
                        )}

                        {cartQty > 0 && (
                          <span className="px-1.5 py-0.5 bg-emerald-600 text-white rounded text-[11px] font-bold">
                            ×{cartQty < 1 ? `${cartQty}კგ` : cartQty}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle: Title */}
                    <h3 className="text-xs font-semibold text-slate-800 line-clamp-2 mb-1.5 leading-snug group-hover:text-emerald-700 transition-colors">
                      {product.name}
                    </h3>

                    {/* Barcode */}
                    <p className="text-[10px] font-mono text-slate-400 mb-2 truncate">
                      {product.barcode}
                    </p>

                    {/* Bottom: Price & Stock */}
                    <div className="mt-auto pt-2 border-t border-slate-100 flex items-baseline justify-between">
                      <div className="text-sm sm:text-base font-extrabold text-slate-900">
                        {cartItemDiscount ? (
                          <div className="flex items-baseline gap-1">
                            <span className="text-[11px] line-through text-slate-400 font-normal">
                              {basePrice.toFixed(2)}
                            </span>
                            <span className="text-rose-600 font-black">
                              {effectivePrice.toFixed(2)}
                            </span>
                            <span className="text-xs font-bold text-rose-600">
                              ₾{product.isWeighted ? '/კგ' : ''}
                            </span>
                          </div>
                        ) : (
                          <>
                            {basePrice.toFixed(2)}{' '}
                            <span className="text-xs font-bold text-emerald-600">
                              ₾{product.isWeighted ? '/კგ' : ''}
                            </span>
                          </>
                        )}
                      </div>
                      <div>
                        {isOutOfStock ? (
                          <span className="text-[9px] sm:text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                            ამოწურულია
                          </span>
                        ) : isLowStock ? (
                          <span className="text-[9px] sm:text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                            {Number.isInteger(product.stock) ? product.stock : product.stock.toFixed(2)}{' '}
                            {product.isWeighted ? 'კგ' : 'ც'}
                          </span>
                        ) : (
                          <span className="text-[9px] sm:text-[10px] text-slate-400">
                            {Number.isInteger(product.stock) ? product.stock : product.stock.toFixed(2)}{' '}
                            {product.isWeighted ? 'კგ' : 'ც'}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* DESKTOP CART (visible only on lg+) */}
      <div className="hidden lg:flex lg:w-[380px] xl:w-[420px] h-full shadow-2xl shrink-0">
        {renderCartUI(false)}
      </div>

      {/* MOBILE STICKY BOTTOM CART BAR (< lg) */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2.5 shadow-xl flex items-center justify-between">
        <button
          onClick={() => setIsMobileCartOpen(true)}
          className="flex items-center gap-2.5 text-left"
        >
          <div className="relative w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30">
            <ShoppingCart className="w-5 h-5" />
            {totalItems > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                {totalItems}
              </span>
            )}
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              კალათა ({totalItems})
            </span>
            <span className="text-base font-black text-slate-900 leading-tight">
              {total.toFixed(2)} ₾
            </span>
          </div>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMobileCartOpen(true)}
            className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
          >
            ნახვა
          </button>
          <button
            onClick={handleOpenPayment}
            disabled={cart.length === 0}
            className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition-all"
          >
            <span>გადახდა</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MOBILE CART SLIDE-UP DRAWER */}
      {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs"
            onClick={() => setIsMobileCartOpen(false)}
          />
          <div className="relative w-full max-h-[85vh] h-[85vh] bg-white rounded-t-3xl shadow-2xl flex flex-col overflow-hidden z-10 animate-in slide-in-from-bottom duration-250">
            {renderCartUI(true)}
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150 my-auto">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-bold">გადახდის გაფორმება</h3>
                <p className="text-xs text-slate-400">აირჩიეთ მეთოდი და შეიყვანეთ თანხა</p>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Total Display */}
            <div className="bg-emerald-50 border-b border-emerald-100 p-3 sm:p-4 text-center shrink-0">
              <span className="text-[11px] sm:text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                სულ გადასახდელი თანხა
              </span>
              <div className="text-3xl sm:text-4xl font-black text-emerald-700 mt-0.5">
                {total.toFixed(2)} <span className="text-lg sm:text-xl">₾</span>
              </div>
            </div>

            {/* Payment Method Tabs & Content (Scrollable) */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`py-2.5 sm:py-3 px-2 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${
                    paymentMethod === 'CASH'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Banknote className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-xs">ნაღდი</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CARD')}
                  className={`py-2.5 sm:py-3 px-2 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${
                    paymentMethod === 'CARD'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-xs">ბარათი</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('MIXED')}
                  className={`py-2.5 sm:py-3 px-2 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${
                    paymentMethod === 'MIXED'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Coins className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-xs">შერეული</span>
                </button>
              </div>

              {/* CASH PAYMENT */}
              {paymentMethod === 'CASH' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      მიღებული თანხა (₾)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      autoFocus
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      placeholder="0.00"
                      className="w-full text-xl sm:text-2xl font-bold text-center px-4 py-2 border-2 border-slate-300 rounded-xl focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  {/* Fast Tender Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 justify-center">
                    {cashPresets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCashTendered(preset.toFixed(2))}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 transition-colors"
                      >
                        {preset.toFixed(2)} ₾
                      </button>
                    ))}
                  </div>

                  {/* Change Display */}
                  <div
                    className={`p-3 rounded-xl border text-center transition-all ${
                      isCashSufficient
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-rose-50 border-rose-200'
                    }`}
                  >
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider block">
                      {isCashSufficient ? 'ხურდა დასაბრუნებელი' : 'არასაკმარისი თანხა'}
                    </span>
                    <div
                      className={`text-xl sm:text-2xl font-extrabold mt-0.5 ${
                        isCashSufficient ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {isCashSufficient ? `${changeDue.toFixed(2)} ₾` : `-${(total - cashNum).toFixed(2)} ₾`}
                    </div>
                  </div>
                </div>
              )}

              {/* CARD PAYMENT */}
              {paymentMethod === 'CARD' && (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-1">
                    <p className="text-xs text-slate-500">
                      გადასახდელი თანხა: <strong className="text-slate-900 text-sm font-black">{total.toFixed(2)} ₾</strong>
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      აირჩიეთ საბანკო ტერმინალი:
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {CARD_BANKS.map((b) => {
                      const isSelected = selectedCardBank === b.id
                      const displayLabel =
                        b.id === 'OTHER' && isSelected && customBankName.trim()
                          ? customBankName.trim()
                          : b.label

                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelectedCardBank(b.id)}
                          className={`p-3 rounded-xl border-2 flex items-center justify-between transition-all ${
                            isSelected ? b.activeClass : b.inactiveClass
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <CreditCard className={`w-4 h-4 shrink-0 ${isSelected ? 'text-current' : b.iconColor}`} />
                            <span className="text-xs font-bold truncate">{displayLabel}</span>
                          </div>
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-current shrink-0 ml-1" />
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {selectedCardBank === 'OTHER' && (
                    <div className="p-3 bg-emerald-50/60 border-2 border-emerald-500 rounded-2xl space-y-2 animate-in fade-in duration-200 shadow-xs">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-black text-emerald-950">
                          ✍️ ჩაწერეთ რითი მოხდა გადახდა:
                        </label>
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100/80 px-2 py-0.5 rounded-full">
                          სხვა ბანკი / ბარათი
                        </span>
                      </div>
                      <input
                        type="text"
                        autoFocus
                        value={customBankName}
                        onChange={(e) => setCustomBankName(e.target.value)}
                        placeholder="მაგ. კრედო ბანკი, ტერაბანკი, პროკრედიტი, Revolut..."
                        className="w-full px-3.5 py-2.5 bg-white border border-emerald-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 rounded-xl text-xs sm:text-sm font-bold text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-normal shadow-xs"
                      />
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <span className="text-[10px] font-bold text-slate-400">სწრაფი არჩევა:</span>
                        {['კრედო ბანკი', 'ტერაბანკი', 'პროკრედიტი', 'Revolut', 'Payze'].map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => setCustomBankName(chip)}
                            className="px-2 py-0.5 bg-white hover:bg-emerald-100/70 border border-slate-200 hover:border-emerald-300 rounded-lg text-[10px] font-bold text-slate-700 transition-colors"
                          >
                            +{chip}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* MIXED PAYMENT */}
              {paymentMethod === 'MIXED' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        ნაღდი (₾)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={mixedCash}
                        onChange={(e) => setMixedCash(e.target.value)}
                        className="w-full text-center font-bold px-3 py-2 border rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        ბარათი (₾)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={mixedCard}
                        onChange={(e) => setMixedCard(e.target.value)}
                        className="w-full text-center font-bold px-3 py-2 border rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                      აირჩიეთ ბარათის ბანკი:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {CARD_BANKS.map((b) => {
                        const isSelected = selectedCardBank === b.id
                        const displayLabel =
                          b.id === 'OTHER' && isSelected && customBankName.trim()
                            ? customBankName.trim()
                            : b.label

                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setSelectedCardBank(b.id)}
                            className={`py-2 px-1.5 rounded-xl border-2 text-[11px] font-bold text-center transition-all truncate ${
                              isSelected ? b.activeClass : b.inactiveClass
                            }`}
                          >
                            {displayLabel}
                          </button>
                        )
                      })}
                    </div>

                    {selectedCardBank === 'OTHER' && (
                      <div className="mt-2.5 p-2.5 bg-emerald-50/60 border border-emerald-400 rounded-xl space-y-1.5 animate-in fade-in duration-200">
                        <label className="block text-[11px] font-black text-emerald-950">
                          ✍️ ჩაწერეთ რითი მოხდა გადახდა:
                        </label>
                        <input
                          type="text"
                          autoFocus
                          value={customBankName}
                          onChange={(e) => setCustomBankName(e.target.value)}
                          placeholder="მაგ. კრედო ბანკი, ტერაბანკი, Revolut..."
                          className="w-full px-3 py-2 bg-white border border-emerald-300 focus:border-emerald-600 rounded-lg text-xs font-bold text-slate-900 outline-none placeholder:text-slate-400"
                        />
                        <div className="flex items-center gap-1 flex-wrap pt-0.5">
                          {['კრედო', 'ტერაბანკი', 'პროკრედიტი', 'Revolut'].map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => setCustomBankName(chip)}
                              className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-semibold text-slate-700 hover:bg-emerald-50"
                            >
                              +{chip}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div
                    className={`p-2.5 rounded-lg border text-center text-xs font-bold ${
                      isMixedSufficient
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}
                  >
                    {isMixedSufficient ? (
                      <span>ჯამი: {mixedTotalPaid.toFixed(2)} ₾ (ხურდა: {mixedChangeDue.toFixed(2)} ₾)</span>
                    ) : (
                      <span>დარჩენილია: {(total - mixedTotalPaid).toFixed(2)} ₾</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons - Fixed at bottom */}
            <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center gap-2 sm:gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="w-1/3 py-2.5 sm:py-3 border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors"
              >
                გაუქმება
              </button>
              <button
                type="button"
                disabled={
                  isSubmittingSale ||
                  (paymentMethod === 'CASH' && !isCashSufficient) ||
                  (paymentMethod === 'MIXED' && !isMixedSufficient)
                }
                onClick={handleCompleteSale}
                className="flex-1 py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs sm:text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all"
              >
                {isSubmittingSale ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>დადასტურება</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT / PRINT MODAL */}
      {isReceiptModalOpen && completedSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="bg-emerald-600 text-white p-3.5 sm:p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                <span className="font-bold text-sm">გაყიდვა დასრულებულია</span>
              </div>
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="text-emerald-100 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thermal Receipt Body */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-slate-50">
              <div
                id="receipt-print"
                className="bg-white p-4 sm:p-5 rounded-lg border border-slate-200 shadow-xs font-mono text-xs text-slate-800 leading-relaxed mx-auto w-full"
              >
                {/* Header */}
                <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-3">
                  <h4 className="font-extrabold text-base tracking-wider text-slate-900">მე და მარკეტი</h4>
                  <p className="text-[11px] text-slate-500">შპს მედა მარკეტ</p>
                  <p className="text-[10px] text-slate-400">Batumi, საქართველო</p>
                  <p className="text-[10px] text-slate-400">საიდენტ. კოდი: 405123456</p>
                </div>

                {/* Meta */}
                <div className="space-y-0.5 border-b border-dashed border-slate-300 pb-2 mb-2 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">ქვითარი #:</span>
                    <span className="font-bold">{completedSale.receiptNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">თარიღი:</span>
                    <span>{new Date(completedSale.createdAt).toLocaleString('ka-GE')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">მოლარე:</span>
                    <span>{completedSale.cashier?.name || user?.name}</span>
                  </div>
                </div>

                {/* Items */}
                <div className="border-b border-dashed border-slate-300 pb-2 mb-2">
                  <div className="flex justify-between font-bold text-[10px] text-slate-400 uppercase mb-1">
                    <span>პროდუქტი</span>
                    <span>ჯამი</span>
                  </div>
                  <div className="space-y-1">
                    {completedSale.items.map((item, idx) => (
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
                    <span>{Number(completedSale.totalAmount).toFixed(2)} ₾</span>
                  </div>
                  {Number(completedSale.discountAmount) > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>ფასდაკლება:</span>
                      <span>-{Number(completedSale.discountAmount).toFixed(2)} ₾</span>
                    </div>
                  )}
                  <div className="flex justify-between font-extrabold text-sm border-t border-slate-900 pt-1 mt-1 text-slate-900">
                    <span>სულ:</span>
                    <span>{Number(completedSale.finalAmount).toFixed(2)} ₾</span>
                  </div>
                  <div className="flex justify-between text-slate-600 text-[10px] pt-1">
                    <span>გადახდა:</span>
                    <span>
                      {completedSale.paymentMethod === 'CASH'
                        ? 'ნაღდი'
                        : completedSale.paymentMethod === 'CARD'
                        ? `ბარათი (${getCardBankLabel(completedSale.cardBank)})`
                        : completedSale.cardBank
                        ? `შერეული (${getCardBankLabel(completedSale.cardBank)})`
                        : 'შერეული'}
                    </span>
                  </div>
                  {completedSale.paymentMethod === 'CASH' && (
                    <>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-500">მიღებული:</span>
                        <span>{Number(completedSale.cashAmount || 0).toFixed(2)} ₾</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-bold text-emerald-700">
                        <span>ხურდა:</span>
                        <span>{Number(completedSale.changeAmount || 0).toFixed(2)} ₾</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Footer Greeting */}
                <div className="text-center border-t border-dashed border-slate-300 pt-3 mt-3 text-[10px] text-slate-500">
                  <p className="font-semibold">გმადლობთ შენაძენისთვის!</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">გთხოვთ შეინახოთ ქვითარი</p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-3 sm:p-4 bg-white border-t border-slate-200 flex gap-2">
              <button
                type="button"
                onClick={handlePrintReceipt}
                className="flex-1 py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>ქვითარი</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsReceiptModalOpen(false)
                  setCompletedSale(null)
                }}
                className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>ახალი გაყიდვა</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WEIGHT / GRAMS CALCULATOR MODAL */}
      {weightModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150 my-auto">
            {/* Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm">წონის კალკულატორი</h3>
                  <p className="text-[11px] text-slate-300 truncate max-w-[220px]">
                    {weightModalItem.productName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setWeightModalItem(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 scrollbar-thin">
              {/* Price per KG info */}
              <div className="flex justify-between items-center text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-500">ფასი 1 კილოგრამზე:</span>
                <span className="font-extrabold text-slate-900 text-sm">
                  {weightModalItem.unitPrice.toFixed(2)} ₾ / კგ
                </span>
              </div>

              {/* Gram Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  შეიყვანეთ წონა (გრამებში):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    autoFocus
                    value={gramInput}
                    onChange={(e) => setGramInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleApplyWeight()
                      }
                    }}
                    placeholder="მაგ: 200, 400, 500"
                    className="w-full text-center text-2xl font-black py-2 px-3 bg-emerald-50/50 border-2 border-emerald-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                  />
                  <span className="absolute right-4 top-3 text-xs font-extrabold text-slate-400">
                    გრამი (გ)
                  </span>
                </div>
              </div>

              {/* Quick Preset Buttons (100g, 200g, 300g, 400g, 500g, 1kg) */}
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                  სწრაფი არჩევა:
                </span>
                <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
                  {[
                    { label: '100გ', g: 100 },
                    { label: '200გ', g: 200 },
                    { label: '300გ', g: 300 },
                    { label: '400გ', g: 400 },
                    { label: '500გ', g: 500 },
                    { label: '700გ', g: 700 },
                    { label: '1 კგ', g: 1000 },
                    { label: '1.5 კგ', g: 1500 },
                  ].map((preset) => (
                    <button
                      key={preset.g}
                      type="button"
                      onClick={() => setGramInput(String(preset.g))}
                      className={`py-1.5 rounded-lg border text-center transition-all ${
                        Number(gramInput) === preset.g
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Preview Summary */}
              {(() => {
                const g = parseFloat(gramInput) || 0
                const kg = Math.round((g / 1000) * 1000) / 1000
                const cost = kg * weightModalItem.unitPrice
                return (
                  <div className="bg-emerald-50 rounded-xl p-2.5 border border-emerald-200 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-emerald-800">წონა კილოგრამებში:</span>
                      <strong className="text-emerald-950 font-black">{kg.toFixed(3)} კგ</strong>
                    </div>
                    <div className="flex justify-between items-baseline pt-1 border-t border-emerald-200/60">
                      <span className="text-emerald-800 font-bold">გადასახდელი თანხა:</span>
                      <span className="text-lg font-black text-emerald-700">
                        {cost.toFixed(2)} ₾
                      </span>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Action Buttons - Fixed at bottom */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 grid grid-cols-2 gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setWeightModalItem(null)}
                className="py-2.5 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
              >
                გაუქმება
              </button>
              <button
                type="button"
                onClick={handleApplyWeight}
                className="py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>დადასტურება</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCT DISCOUNT MODAL */}
      {discountModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150 my-auto">
            {/* Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-rose-400" />
                <div>
                  <h3 className="font-bold text-sm">ფასდაკლება პროდუქტზე</h3>
                  <p className="text-[11px] text-slate-300 truncate max-w-[220px]">
                    {discountModalItem.productName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDiscountModalItem(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 scrollbar-thin">
              {/* Original Price */}
              <div className="flex justify-between items-center text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-500">საწყისი ფასი:</span>
                <span className="font-extrabold text-slate-900 text-sm">
                  {discountModalItem.unitPrice.toFixed(2)} ₾
                </span>
              </div>

              {/* Discount Percentage Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ფასდაკლების პროცენტი (%):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    autoFocus
                    value={itemDiscountInput}
                    onChange={(e) => setItemDiscountInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleApplyItemDiscount()
                      }
                    }}
                    placeholder="10"
                    className="w-full text-center text-2xl font-black py-2 px-3 bg-rose-50/50 border-2 border-rose-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900"
                  />
                  <span className="absolute right-4 top-3 text-base font-extrabold text-rose-600">
                    %
                  </span>
                </div>
              </div>

              {/* Quick Preset Buttons (5%, 10%, 15%, 20%, 25%, 30%, 50%, 0%) */}
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                  სწრაფი არჩევა:
                </span>
                <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
                  {[5, 10, 15, 20, 25, 30, 50, 0].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setItemDiscountInput(String(pct))}
                      className={`py-1.5 rounded-lg border text-center transition-all ${
                        Number(itemDiscountInput) === pct
                          ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {pct === 0 ? 'გაუქმება' : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Preview Summary */}
              {(() => {
                const pct = Math.min(100, Math.max(0, parseFloat(itemDiscountInput) || 0))
                const saved = (discountModalItem.unitPrice * pct) / 100
                const newPrice = Math.max(0, discountModalItem.unitPrice - saved)
                return (
                  <div className="bg-rose-50 rounded-xl p-2.5 border border-rose-200 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-rose-800">ფასდაკლების თანხა:</span>
                      <strong className="text-rose-950 font-black">-{saved.toFixed(2)} ₾</strong>
                    </div>
                    <div className="flex justify-between items-baseline pt-1 border-t border-rose-200/60">
                      <span className="text-rose-800 font-bold">ახალი ფასი:</span>
                      <span className="text-lg font-black text-rose-700">
                        {newPrice.toFixed(2)} ₾
                      </span>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Action Buttons - Fixed at bottom */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 grid grid-cols-2 gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setDiscountModalItem(null)}
                className="py-2.5 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
              >
                დახურვა
              </button>
              <button
                type="button"
                onClick={handleApplyItemDiscount}
                className="py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 transition-all flex items-center justify-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>დადასტურება</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
