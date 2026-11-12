import axios from 'axios'
import {
  User,
  Product,
  Category,
  Sale,
  InventoryHistory,
  DashboardStats,
  RevenueChartData,
  BestSeller,
  Role,
} from '../types'

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api')

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach Bearer token to all outgoing requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Intercept 401 Unauthorized responses
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token if expired or invalid, unless on login route
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export const api = {
  // Auth
  auth: {
    login: async (email: string, password: string) => {
      const res = await apiClient.post<{ token: string; user: User }>('/auth/login', { email, password })
      return res.data
    },
    getMe: async () => {
      const res = await apiClient.get<{ user: User }>('/auth/me')
      return res.data
    },
    createEmployee: async (data: { email: string; name: string; password: string; role?: Role }) => {
      const res = await apiClient.post<{ user: User }>('/auth/employees', data)
      return res.data
    },
    updatePassword: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await apiClient.put<{ message: string }>('/auth/password', data)
      return res.data
    },
  },

  // Products & Categories
  products: {
    getAll: async (params?: {
      search?: string
      category?: string
      sortBy?: string
      sortOrder?: 'asc' | 'desc'
      lowStock?: boolean
      outOfStock?: boolean
    }) => {
      const res = await apiClient.get<{ products: Product[] }>('/products', { params })
      return res.data.products
    },
    getByBarcode: async (barcode: string) => {
      const res = await apiClient.get<{ product: Product }>(`/products/barcode/${encodeURIComponent(barcode)}`)
      return res.data.product
    },
    create: async (data: {
      name: string
      barcode: string
      categoryId: string
      purchasePrice: number
      sellingPrice: number
      stock?: number
      minStockLevel?: number
    }) => {
      const res = await apiClient.post<{ product: Product }>('/products', data)
      return res.data.product
    },
    update: async (
      id: string,
      data: Partial<{
        name: string
        barcode: string
        categoryId: string
        purchasePrice: number
        sellingPrice: number
        stock: number
        minStockLevel: number
        isActive: boolean
      }>
    ) => {
      const res = await apiClient.put<{ product: Product }>(`/products/${id}`, data)
      return res.data.product
    },
    delete: async (id: string) => {
      const res = await apiClient.delete<{ message: string }>(`/products/${id}`)
      return res.data
    },
    getCategories: async () => {
      const res = await apiClient.get<{ categories: Category[] }>('/products/categories')
      return res.data.categories
    },
    createCategory: async (name: string) => {
      const res = await apiClient.post<{ category: Category }>('/products/categories', { name })
      return res.data.category
    },
  },

  // Sales
  sales: {
    create: async (data: {
      items: { productId: string; quantity: number }[]
      paymentMethod: 'CASH' | 'CARD' | 'MIXED'
      cashAmount?: number | null
      cardAmount?: number | null
      discountAmount?: number
    }) => {
      const res = await apiClient.post<{ sale: Sale }>('/sales', data)
      return res.data.sale
    },
    getAll: async (params?: { startDate?: string; endDate?: string; page?: number; limit?: number }) => {
      const res = await apiClient.get<{
        sales: Sale[]
        total: number
        page: number
        limit: number
      }>('/sales', { params })
      return res.data
    },
    getById: async (id: string) => {
      const res = await apiClient.get<{ sale: Sale }>(`/sales/${id}`)
      return res.data.sale
    },
  },

  // Inventory
  inventory: {
    getHistory: async (params?: { productId?: string; movementType?: string; page?: number; limit?: number }) => {
      const res = await apiClient.get<{
        history: InventoryHistory[]
        total: number
        page: number
        limit: number
      }>('/inventory/history', { params })
      return res.data
    },
    addStock: async (
      productId: string,
      data: { quantity: number; reason?: string; notes?: string }
    ) => {
      const res = await apiClient.post<{ message: string; product: Product }>(
        `/inventory/add-stock/${productId}`,
        data
      )
      return res.data
    },
    adjustStock: async (
      productId: string,
      data: { newStock: number; reason?: string; notes?: string }
    ) => {
      const res = await apiClient.post<{ message: string; product: Product }>(
        `/inventory/adjust/${productId}`,
        data
      )
      return res.data
    },
  },

  // Dashboard & Analytics
  dashboard: {
    getStats: async (params?: { startDate?: string; endDate?: string }) => {
      const res = await apiClient.get<DashboardStats>('/dashboard/stats', { params })
      return res.data
    },
    getRevenueChart: async (params?: { period?: 'daily' | 'weekly' | 'monthly' | 'yearly' }) => {
      const res = await apiClient.get<{ chartData: RevenueChartData[] }>('/dashboard/revenue-chart', { params })
      return res.data.chartData
    },
    getBestSellers: async () => {
      const res = await apiClient.get<{ bestSellers: BestSeller[] }>('/dashboard/best-sellers')
      return res.data.bestSellers
    },
  },

  // Employees
  employees: {
    getAll: async () => {
      const res = await apiClient.get<{ employees: User[] }>('/employees')
      return res.data.employees
    },
    update: async (id: string, data: Partial<{ name: string; email: string; role: Role; isActive: boolean }>) => {
      const res = await apiClient.put<{ employee: User }>(`/employees/${id}`, data)
      return res.data.employee
    },
    deactivate: async (id: string) => {
      const res = await apiClient.delete<{ message: string }>(`/employees/${id}`)
      return res.data
    },
  },
}

