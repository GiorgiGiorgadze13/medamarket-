export type Role = 'ADMIN' | 'CASHIER'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  isActive?: boolean
  createdAt?: string
  _count?: {
    sales: number
  }
}

export interface Category {
  id: string
  name: string
  createdAt?: string
  _count?: {
    products: number
  }
}

export interface Product {
  id: string
  name: string
  barcode: string
  categoryId: string
  category?: Category
  purchasePrice: number | string
  sellingPrice: number | string
  stock: number
  minStockLevel: number
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export type PaymentMethod = 'CASH' | 'CARD' | 'MIXED'

export interface SaleItem {
  id?: string
  saleId?: string
  productId: string
  product?: {
    name: string
    barcode: string
  }
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface Sale {
  id: string
  receiptNumber: string
  cashierId: string
  cashier?: {
    name: string
    email: string
  }
  totalAmount: number | string
  discountAmount: number | string
  finalAmount: number | string
  paymentMethod: PaymentMethod
  cashAmount?: number | string | null
  cardAmount?: number | string | null
  changeAmount: number | string
  createdAt: string
  items: SaleItem[]
}

export interface CartItem {
  product: Product
  quantity: number
  discountPercent?: number
}

export type MovementType = 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'RETURN'

export interface InventoryHistory {
  id: string
  productId: string
  product?: {
    name: string
    barcode: string
    stock: number
  }
  userId: string
  user?: {
    name: string
    email: string
  }
  movementType: MovementType
  quantity: number
  reason?: string
  notes?: string
  createdAt: string
}

export interface DashboardStats {
  totalRevenue: number
  totalTransactions: number
  totalItemsSold: number
  cashRevenue: number
  cardRevenue: number
  grossProfit: number
  totalProducts: number
  lowStockProducts: number
  outOfStockProducts: number
}

export interface RevenueChartData {
  date: string
  revenue: number
  transactions: number
  cash: number
  card: number
}

export interface BestSeller {
  id: string
  name: string
  barcode: string
  totalQuantity: number
  totalRevenue: number
}

