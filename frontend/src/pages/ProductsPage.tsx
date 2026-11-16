import React, { useState, useEffect, useMemo } from 'react'
import { api, getErrorMessage } from '../services/api'
import { Product, Category } from '../types'
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  AlertTriangle,
  ArrowUpDown,
  Barcode,
  Layers,
  CheckCircle2,
  X,
  TrendingUp,
  DollarSign,
  Boxes,
  RefreshCw,
  Scale,
} from 'lucide-react'
import toast from 'react-hot-toast'

const STANDARD_SUPERMARKET_CATEGORIES = [
  { name: 'ხილ-ბოსტნეული', icon: '🍏' },
  { name: 'სასმელი', icon: '🥤' },
  { name: 'ბაკალეა', icon: '🌾' },
  { name: 'ჩაი, ყავა და კაკაო', icon: '☕' },
  { name: 'პურ-ფუნთუშეული', icon: '🍞' },
  { name: 'ტკბილეული და ნაყინი', icon: '🍫' },
  { name: 'ტკბილეული', icon: '🍬' },
  { name: 'მარცვლეული', icon: '🍚' },
  { name: 'სნექი', icon: '🍿' },
  { name: 'კონსერვი', icon: '🥫' },
  { name: 'სოსისი და ძეხვეული', icon: '🌭' },
  { name: 'ხორცეული', icon: '🍖' },
  { name: 'კვერცხი და რძის ნაწარმი', icon: '🧀' },
  { name: 'რძის ნაწარმი', icon: '🥛' },
  { name: 'ხორცი და ნახევარფაბრიკატები', icon: '🥩' },
  { name: 'ზღვის პროდუქტები', icon: '🐟' },
  { name: 'სახლის მოვლა და ჰიგიენა', icon: '🧼' },
  { name: 'ცხოველთა კვება', icon: '🐱' },
  { name: 'სათამაშოები', icon: '🧸' },
  { name: 'სიგარეტი და თამბაქო', icon: '🚬' },
  { name: 'სანელებლები და სოუსები', icon: '🧂' },
  { name: 'ბავშვის მოვლა', icon: '👶' },
]

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL')
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'sellingPrice'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  const [isStockModalOpen, setIsStockModalOpen] = useState<boolean>(false)
  const [stockModalProduct, setStockModalProduct] = useState<Product | null>(null)
  const [stockAddQty, setStockAddQty] = useState<string>('')
  const [stockReason, setStockReason] = useState<string>('საქონლის მიღება / შესყიდვა')
  const [stockNotes, setStockNotes] = useState<string>('')

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false)
  const [newCategoryName, setNewCategoryName] = useState<string>('')

  // Product Form State
  const [formName, setFormName] = useState<string>('')
  const [formBarcode, setFormBarcode] = useState<string>('')
  const [formCategoryId, setFormCategoryId] = useState<string>('')
  const [formPurchasePrice, setFormPurchasePrice] = useState<string>('')
  const [formSellingPrice, setFormSellingPrice] = useState<string>('')
  const [formStock, setFormStock] = useState<string>('0')
  const [formMinStock, setFormMinStock] = useState<string>('5')
  const [formIsWeighted, setFormIsWeighted] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // Load Data
  const loadData = async () => {
    setIsLoading(true)
    try {
      const [prodsData, catsData] = await Promise.all([
        api.products.getAll(),
        api.products.getCategories(),
      ])
      setProducts(Array.isArray(prodsData) ? prodsData : [])
      setCategories(Array.isArray(catsData) ? catsData : [])
    } catch (err) {
      console.error(err)
      toast.error('მონაცემების ჩატვირთვა ვერ მოხერხდა')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Auto-generate 13-digit EAN barcode
  const handleGenerateBarcode = () => {
    const prefix = '200'
    const randomDigits = Math.floor(100000000 + Math.random() * 900000000).toString()
    const barcode = prefix + randomDigits
    setFormBarcode(barcode)
  }

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingProduct(null)
    setFormName('')
    handleGenerateBarcode()
    setFormCategoryId(categories[0]?.id || '')
    setFormPurchasePrice('')
    setFormSellingPrice('')
    setFormStock('0')
    setFormMinStock('5')
    setFormIsWeighted(false)
    setIsProductModalOpen(true)
  }

  // Open Edit Modal
  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product)
    setFormName(product.name)
    setFormBarcode(product.barcode)
    setFormCategoryId(product.categoryId)
    setFormPurchasePrice(product.purchasePrice.toString())
    setFormSellingPrice(product.sellingPrice.toString())
    setFormStock(product.stock.toString())
    setFormMinStock(product.minStockLevel.toString())
    setFormIsWeighted(Boolean(product.isWeighted))
    setIsProductModalOpen(true)
  }

  // Handle Save Product (Create or Update)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim() || !formBarcode.trim() || !formCategoryId) {
      toast.error('გთხოვთ შეავსოთ ყველა სავალდებულო ველი')
      return
    }

    const purchase = parseFloat(formPurchasePrice) || 0
    const selling = parseFloat(formSellingPrice) || 0
    const stockVal = parseInt(formStock) || 0
    const minStockVal = parseInt(formMinStock) || 5

    if (purchase < 0 || selling < 0) {
      toast.error('ფასი არ შეიძლება იყოს უარყოფითი')
      return
    }

    setIsSubmitting(true)
    try {
      if (editingProduct) {
        // Update
        const updated = await api.products.update(editingProduct.id, {
          name: formName.trim(),
          barcode: formBarcode.trim(),
          categoryId: formCategoryId,
          purchasePrice: purchase,
          sellingPrice: selling,
          stock: stockVal,
          minStockLevel: minStockVal,
          isWeighted: formIsWeighted,
        })
        setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
        window.dispatchEvent(new CustomEvent('medamarket:product-updated', { detail: updated }))
        toast.success('პროდუქტი წარმატებით განახლდა')
      } else {
        // Create
        const created = await api.products.create({
          name: formName.trim(),
          barcode: formBarcode.trim(),
          categoryId: formCategoryId,
          purchasePrice: purchase,
          sellingPrice: selling,
          stock: stockVal,
          minStockLevel: minStockVal,
          isWeighted: formIsWeighted,
        })
        setProducts((prev) => [created, ...prev])
        toast.success('ახალი პროდუქტი წარმატებით დაემატა')
      }
      setIsProductModalOpen(false)
    } catch (err: any) {
      console.error(err)
      toast.error(getErrorMessage(err, 'პროდუქტის შენახვა ვერ მოხერხდა'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Delete Product
  const handleDeleteProduct = async (id: string, name: string) => {
    if (!window.confirm(`დარწმუნებული ხართ რომ გსურთ "${name}"-ის წაშლა?`)) return

    try {
      await api.products.delete(id)
      setProducts((prev) => prev.filter((p) => p.id !== id))
      toast.success('პროდუქტი წაიშალა')
    } catch (err: any) {
      console.error(err)
      toast.error(getErrorMessage(err, 'წაშლა ვერ მოხერხდა'))
    }
  }

  // Handle Stock Add
  const handleOpenStockModal = (product: Product) => {
    setStockModalProduct(product)
    setStockAddQty('')
    setStockReason('საქონლის მიღება / შესყიდვა')
    setStockNotes('')
    setIsStockModalOpen(true)
  }

  const handleSaveStock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stockModalProduct) return

    const qty = parseInt(stockAddQty)
    if (!qty || qty <= 0) {
      toast.error('მიუთითეთ ვალიდური რაოდენობა')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await api.inventory.addStock(stockModalProduct.id, {
        quantity: qty,
        reason: stockReason,
        notes: stockNotes,
      })
      setProducts((prev) =>
        prev.map((p) => (p.id === stockModalProduct.id ? res.product : p))
      )
      window.dispatchEvent(new CustomEvent('medamarket:product-updated', { detail: res.product }))
      toast.success(`მარაგი გაიზარდა +${qty} ერთეულით`)
      setIsStockModalOpen(false)
    } catch (err: any) {
      console.error(err)
      toast.error(getErrorMessage(err, 'მარაგის დამატება ვერ მოხერხდა'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Create Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCategoryName.trim()) return

    try {
      const cat = await api.products.createCategory(newCategoryName.trim())
      setCategories((prev) => [...prev, cat])
      setFormCategoryId(cat.id)
      setNewCategoryName('')
      setIsCategoryModalOpen(false)
      toast.success(`კატეგორია "${cat.name}" დაემატა`)
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'კატეგორიის დამატება ვერ მოხერხდა'))
    }
  }

  // Quick 1-click preset category selection or addition
  const handleQuickAddPreset = async (presetName: string) => {
    const existing = categories.find((c) => c.name.toLowerCase() === presetName.toLowerCase())
    if (existing) {
      setFormCategoryId(existing.id)
      toast.success(`არჩეულია: ${existing.name}`)
      setIsCategoryModalOpen(false)
      return
    }

    try {
      const cat = await api.products.createCategory(presetName)
      setCategories((prev) => [...prev, cat])
      setFormCategoryId(cat.id)
      setNewCategoryName('')
      setIsCategoryModalOpen(false)
      toast.success(`კატეგორია "${presetName}" დაემატა და არჩეულია`)
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'კატეგორიის დამატება ვერ მოხერხდა'))
    }
  }

  // Filtered and Sorted Products
  const filteredProducts = useMemo(() => {
    return (products || [])
      .filter((p) => {
        const matchesCategory = selectedCategory === 'ALL' || p.categoryId === selectedCategory
        const q = searchQuery.toLowerCase().trim()
        const matchesSearch =
          !q || p.name.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q)

        let matchesStock = true
        if (stockFilter === 'IN_STOCK') matchesStock = p.stock > p.minStockLevel
        if (stockFilter === 'LOW_STOCK') matchesStock = p.stock > 0 && p.stock <= p.minStockLevel
        if (stockFilter === 'OUT_OF_STOCK') matchesStock = p.stock <= 0

        return matchesCategory && matchesSearch && matchesStock
      })
      .sort((a, b) => {
        let valA: any = a[sortBy]
        let valB: any = b[sortBy]
        if (sortBy === 'sellingPrice') {
          valA = Number(valA)
          valB = Number(valB)
        }
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1
        return 0
      })
  }, [products, selectedCategory, searchQuery, stockFilter, sortBy, sortOrder])

  // Summary Metrics
  const metrics = useMemo(() => {
    const list = products || []
    const totalCount = list.length
    const lowStockCount = list.filter((p) => p.stock > 0 && p.stock <= p.minStockLevel).length
    const outOfStockCount = list.filter((p) => p.stock <= 0).length
    const totalInventoryValue = list.reduce(
      (sum, p) => sum + Number(p.purchasePrice) * p.stock,
      0
    )
    return { totalCount, lowStockCount, outOfStockCount, totalInventoryValue }
  }, [products])

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600" />
            <span>პროდუქტები & მარაგი</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1">
            ნომენკლატურის, ფასების, შტრიხ-კოდებისა და საწყობის ნაშთების მართვა
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            onClick={loadData}
            title="განახლება"
            className="p-2 sm:p-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl transition-colors shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="px-3 sm:px-3.5 py-2 sm:py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
          >
            <Layers className="w-4 h-4" />
            <span>კატეგორია</span>
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="px-3.5 sm:px-4 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 sm:gap-2 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>ახალი პროდუქტი</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase">სულ პროდუქტი</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{metrics.totalCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase">მცირე მარაგი</p>
            <p className="text-xl font-black text-amber-600 mt-0.5">{metrics.lowStockCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase">ამოწურული</p>
            <p className="text-xl font-black text-rose-600 mt-0.5">{metrics.outOfStockCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase">საწყობის ღირებულება</p>
            <p className="text-xl font-black text-emerald-700 mt-0.5">
              {metrics.totalInventoryValue.toLocaleString('ka-GE', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              ₾
            </p>
          </div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="მოძებნეთ პროდუქტი ან შტრიხ-კოდი..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Category Dropdown */}
          <div className="w-full md:w-56">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="ALL">ყველა კატეგორია ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-1.5 w-full md:w-auto">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="name">სახელი</option>
              <option value="stock">ნაშთი</option>
              <option value="sellingPrice">გასაყიდი ფასი</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-2 bg-slate-50 border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors text-slate-700"
              title="დალაგების მიმართულება"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stock Filter Chips */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 overflow-x-auto">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-2 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            მარაგი:
          </span>
          {[
            { id: 'ALL', label: 'ყველა' },
            { id: 'IN_STOCK', label: 'მარაგშია' },
            { id: 'LOW_STOCK', label: 'მცირე მარაგი ⚠️' },
            { id: 'OUT_OF_STOCK', label: 'ამოწურული ❌' },
          ].map((chip) => (
            <button
              key={chip.id}
              onClick={() => setStockFilter(chip.id as any)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                stockFilter === chip.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">შტრიხ-კოდი</th>
                <th className="py-3 px-4">დასახელება & კატეგორია</th>
                <th className="py-3 px-4 text-right">შესასყიდი</th>
                <th className="py-3 px-4 text-right">გასაყიდი</th>
                <th className="py-3 px-4 text-center">მარჟა (%)</th>
                <th className="py-3 px-4 text-center">ნაშთი</th>
                <th className="py-3 px-4 text-center">მინ. ზღვარი</th>
                <th className="py-3 px-4 text-right">მოქმედება</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    პროდუქტები ვერ მოიძებნა
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const purchase = Number(p.purchasePrice)
                  const selling = Number(p.sellingPrice)
                  const marginPct =
                    purchase > 0 ? Math.round(((selling - purchase) / purchase) * 100) : 100
                  const isOutOfStock = p.stock <= 0
                  const isLowStock = !isOutOfStock && p.stock <= p.minStockLevel

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Barcode */}
                      <td className="py-3 px-4 font-mono font-medium text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Barcode className="w-3.5 h-3.5 text-slate-400" />
                          <span>{p.barcode}</span>
                        </div>
                      </td>

                      {/* Name & Category */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-slate-900 line-clamp-1">{p.name}</p>
                          {p.isWeighted ? (
                            <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-0.5">
                              <Scale className="w-2.5 h-2.5" /> წონითი
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                              ცალობით
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold inline-block mt-0.5">
                          {p.category?.name || 'სხვა'}
                        </span>
                      </td>

                      {/* Purchase Price */}
                      <td className="py-3 px-4 text-right font-medium text-slate-600">
                        {purchase.toFixed(2)} ₾
                      </td>

                      {/* Selling Price */}
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {selling.toFixed(2)} ₾
                      </td>

                      {/* Margin % */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            marginPct >= 30
                              ? 'bg-emerald-100 text-emerald-800'
                              : marginPct >= 15
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          +{marginPct}%
                        </span>
                      </td>

                      {/* Stock */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${
                            isOutOfStock
                              ? 'bg-rose-100 text-rose-700'
                              : isLowStock
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {p.stock}
                        </span>
                      </td>

                      {/* Min Stock */}
                      <td className="py-3 px-4 text-center text-slate-500 font-medium">
                        {p.minStockLevel}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenStockModal(p)}
                            title="მარაგის მიღება (+)"
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors font-bold flex items-center gap-0.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span className="text-[11px]">მიღება</span>
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(p)}
                            title="რედაქტირება"
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            title="წაშლა"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
      </div>

      {/* CREATE / EDIT PRODUCT MODAL */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-400" />
                <span>{editingProduct ? 'პროდუქტის რედაქტირება' : 'ახალი პროდუქტის დამატება'}</span>
              </h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4 text-xs">
              {/* Product Name */}
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  პროდუქტის დასახელება *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="მაგ: ბორჯომი 0.5ლ მინა"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Barcode with Auto-generate */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700 uppercase">
                    შტრიხ-კოდი (Barcode) *
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateBarcode}
                    className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    <span>გენერირება</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={formBarcode}
                  onChange={(e) => setFormBarcode(e.target.value)}
                  placeholder="მაგ: 4860019001344"
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Category */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700 uppercase">
                    კატეგორია *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(true)}
                    className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ახალი კატეგორია</span>
                  </button>
                </div>
                <select
                  required
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium text-xs sm:text-sm bg-white"
                >
                  <option value="" disabled>
                    აირჩიეთ კატეგორია
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                {/* Quick Category Selection Chips */}
                {categories.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      სწრაფი არჩევანი (დააჭირეთ სასურველ კატეგორიას):
                    </span>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1.5 bg-slate-50 rounded-xl border border-slate-200 scrollbar-thin">
                      {categories.map((c) => {
                        const isSelected = formCategoryId === c.id
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setFormCategoryId(c.id)}
                            className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all ${
                              isSelected
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {c.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Price Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    შესასყიდი ფასი (₾) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formPurchasePrice}
                    onChange={(e) => setFormPurchasePrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    გასაყიდი ფასი (₾) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formSellingPrice}
                    onChange={(e) => setFormSellingPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 font-bold text-emerald-700 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Stock Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    მიმდინარე ნაშთი
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    მინიმალური მარაგი
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Sold by Weight Toggle */}
              <div
                onClick={() => setFormIsWeighted(!formIsWeighted)}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  formIsWeighted
                    ? 'border-emerald-500 bg-emerald-50/80'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      formIsWeighted ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    <Scale className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 text-xs block leading-tight">
                      ეს პროდუქტი წონით გაიყიდება? (კგ / გრამობით)
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      {formIsWeighted
                        ? '✅ ჩართულია: POS-ში ხელმისაწვდომი იქნება წონის ღილაკი და გრამების კალკულატორი.'
                        : '❌ გამორთულია (სნიკერსი, ბაუნტი, სასმელი...): პროდუქტი გაიყიდება მხოლოდ მთელი ცალობით (1, 2, 3...).'}
                    </p>
                  </div>
                </div>

                <div className="relative inline-flex items-center shrink-0">
                  <input
                    type="checkbox"
                    checked={formIsWeighted}
                    onChange={(e) => setFormIsWeighted(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      formIsWeighted ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`block w-5 h-5 bg-white rounded-full transition-transform absolute top-0.5 left-0.5 shadow-xs ${
                        formIsWeighted ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-colors"
                >
                  გაუქმება
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition-all"
                >
                  {isSubmitting ? 'ინახება...' : 'შენახვა'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STOCK REPLENISHMENT MODAL */}
      {isStockModalOpen && stockModalProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-emerald-700 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">მარაგის მიღება (Stock-In)</h3>
                <p className="text-xs text-emerald-100 mt-0.5 truncate max-w-xs">
                  {stockModalProduct.name}
                </p>
              </div>
              <button
                onClick={() => setIsStockModalOpen(false)}
                className="text-emerald-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStock} className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="text-slate-500 font-semibold">მიმდინარე ნაშთი:</span>
                <span className="text-sm font-black text-slate-800">
                  {stockModalProduct.stock} ერთეული
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  მისაღები რაოდენობა *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  autoFocus
                  value={stockAddQty}
                  onChange={(e) => setStockAddQty(e.target.value)}
                  placeholder="მაგ: 50"
                  className="w-full text-lg font-bold px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  მიზეზი / ოპერაცია
                </label>
                <input
                  type="text"
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  შენიშვნა / ზედნადების #
                </label>
                <input
                  type="text"
                  value={stockNotes}
                  onChange={(e) => setStockNotes(e.target.value)}
                  placeholder="მაგ: ზედნადები #12345"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsStockModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl"
                >
                  გაუქმება
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30"
                >
                  {isSubmitting ? 'მიღება...' : 'მიღების დადასტურება'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CATEGORY MODAL */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold">ახალი კატეგორიის დამატება</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  აირჩიეთ მზა სიიდან 1-დაჭერით ან ჩაწერეთ ახალი კატეგორია
                </p>
              </div>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 text-xs">
              {/* Preset Supermarket Categories Grid */}
              <div>
                <span className="font-bold text-slate-700 uppercase text-[11px] block mb-2">
                  🏪 მაღაზიის მზა კატეგორიები (დააჭირეთ სწრაფად ასარჩევად):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-56 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200 scrollbar-thin">
                  {STANDARD_SUPERMARKET_CATEGORIES.map((preset) => {
                    const existingCat = categories.find(
                      (c) => c.name.trim().toLowerCase() === preset.name.trim().toLowerCase()
                    )
                    const isAdded = !!existingCat
                    const isCurrentlySelected = existingCat && formCategoryId === existingCat.id

                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => handleQuickAddPreset(preset.name)}
                        className={`p-2 rounded-xl text-left flex items-center justify-between gap-1 transition-all text-[11px] ${
                          isCurrentlySelected
                            ? 'bg-emerald-600 text-white shadow-xs font-bold'
                            : isAdded
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 font-semibold'
                            : 'bg-white text-slate-700 border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50'
                        }`}
                        title={
                          isAdded
                            ? 'უკვე არსებობს (დააჭირეთ პირდაპირ ასარჩევად)'
                            : 'დააჭირეთ მყისიერად დასამატებლად'
                        }
                      >
                        <span className="truncate flex items-center gap-1">
                          <span>{preset.icon}</span>
                          <span className="truncate">{preset.name}</span>
                        </span>
                        {isCurrentlySelected ? (
                          <span className="text-white font-black text-[10px] shrink-0">✓</span>
                        ) : isAdded ? (
                          <span className="text-emerald-600 font-bold text-[10px] shrink-0">✓</span>
                        ) : (
                          <span className="text-slate-400 text-[10px] font-bold shrink-0">+</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Manual Category Form */}
              <form onSubmit={handleCreateCategory} className="space-y-3 pt-3 border-t border-slate-100">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    ან ჩაწერეთ განსხვავებული კატეგორიის სახელი:
                  </label>
                  <input
                    type="text"
                    required
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="მაგ: სათამაშოები, სიგარეტი, ტკბილეული..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs sm:text-sm font-medium"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(false)}
                    className="px-3 py-2 border border-slate-300 hover:bg-slate-50 rounded-xl text-slate-600 font-semibold"
                  >
                    დახურვა
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs"
                  >
                    დამატება
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

