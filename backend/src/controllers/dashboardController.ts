import { Response } from 'express'
import { prisma } from '../prisma'
import { AuthRequest } from '../middleware/auth'

/**
 * Helper to calculate start & end timestamps based on named period or custom dates.
 */
function parseDateRange(period?: string, startDate?: string, endDate?: string): { start: Date; end: Date; isSingleDay: boolean } {
  const now = new Date()

  // 1. If explicit startDate is provided
  if (startDate) {
    let start: Date
    let end: Date

    if (typeof startDate === 'string' && startDate.length === 10 && !startDate.includes('T')) {
      const [y, m, d] = startDate.split('-').map(Number)
      start = new Date(y, m - 1, d, 0, 0, 0, 0)
    } else {
      start = new Date(String(startDate))
    }

    const endStr = endDate || startDate
    if (typeof endStr === 'string' && endStr.length === 10 && !endStr.includes('T')) {
      const [y, m, d] = endStr.split('-').map(Number)
      end = new Date(y, m - 1, d, 23, 59, 59, 999)
    } else {
      end = new Date(String(endStr))
      end.setHours(23, 59, 59, 999)
    }

    const isSingleDay =
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth() &&
      start.getDate() === end.getDate()

    return { start, end, isSingleDay }
  }

  // 2. Based on named periods
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  switch (period) {
    case 'today':
      return { start: todayStart, end: todayEnd, isSingleDay: true }

    case '2days': {
      const start = new Date(todayStart)
      start.setDate(start.getDate() - 1)
      return { start, end: todayEnd, isSingleDay: false }
    }

    case '3days': {
      const start = new Date(todayStart)
      start.setDate(start.getDate() - 2)
      return { start, end: todayEnd, isSingleDay: false }
    }

    case 'week':
    case 'weekly': {
      const start = new Date(todayStart)
      start.setDate(start.getDate() - 6)
      return { start, end: todayEnd, isSingleDay: false }
    }

    case '2weeks':
    case 'daily': {
      // 14 days (retaining backward compatibility with old 'daily')
      const start = new Date(todayStart)
      start.setDate(start.getDate() - 13)
      return { start, end: todayEnd, isSingleDay: false }
    }

    case 'month':
    case 'monthly': {
      // 30 days
      const start = new Date(todayStart)
      start.setDate(start.getDate() - 29)
      return { start, end: todayEnd, isSingleDay: false }
    }

    case 'year':
    case 'yearly': {
      // From Jan 1 of current year
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
      return { start, end: todayEnd, isSingleDay: false }
    }

    default:
      return { start: todayStart, end: todayEnd, isSingleDay: true }
  }
}

export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { period, startDate, endDate } = req.query
    const { start, end } = parseDateRange(
      period ? String(period) : undefined,
      startDate ? String(startDate) : undefined,
      endDate ? String(endDate) : undefined
    )

    const dateFilter = { createdAt: { gte: start, lte: end } }

    const [sales, allProducts] = await prisma.$transaction([
      prisma.sale.findMany({
        where: dateFilter,
        include: {
          items: {
            include: {
              product: {
                select: { purchasePrice: true },
              },
            },
          },
        },
      }),
      prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, stock: true, minStockLevel: true },
      }),
    ])

    const totalRevenue = sales.reduce((sum, s) => sum + Number(s.finalAmount), 0)
    const totalTransactions = sales.length
    const totalItemsSold = sales.reduce((sum, s) => sum + s.items.reduce((iSum, item) => iSum + item.quantity, 0), 0)

    let cashRevenue = 0
    let cardRevenue = 0
    for (const sale of sales) {
      if (sale.paymentMethod === 'CASH') {
        cashRevenue += Number(sale.finalAmount)
      } else if (sale.paymentMethod === 'CARD') {
        cardRevenue += Number(sale.finalAmount)
      } else if (sale.paymentMethod === 'MIXED') {
        cashRevenue += Number(sale.cashAmount || 0)
        cardRevenue += Number(sale.cardAmount || 0)
      }
    }

    // Gross profit = final revenue - Cost of Goods Sold (purchasePrice * quantity)
    let totalCostOfGoodsSold = 0
    for (const sale of sales) {
      for (const item of sale.items) {
        totalCostOfGoodsSold += Number(item.product.purchasePrice) * item.quantity
      }
    }
    const grossProfit = totalRevenue - totalCostOfGoodsSold

    const totalProducts = allProducts.length
    const lowStockProducts = allProducts.filter(p => p.stock > 0 && p.stock <= p.minStockLevel).length
    const outOfStockProducts = allProducts.filter(p => p.stock <= 0).length

    res.json({
      totalRevenue,
      totalTransactions,
      totalItemsSold,
      cashRevenue,
      cardRevenue,
      grossProfit,
      totalProducts,
      lowStockProducts,
      outOfStockProducts,
    })
  } catch (err) {
    console.error('Dashboard stats error:', err)
    res.status(500).json({ error: 'სერვერის შეცდომა' })
  }
}

export const getRevenueChart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { period, startDate, endDate } = req.query
    const { start, end, isSingleDay } = parseDateRange(
      period ? String(period) : undefined,
      startDate ? String(startDate) : undefined,
      endDate ? String(endDate) : undefined
    )

    const sales = await prisma.sale.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: {
        finalAmount: true,
        createdAt: true,
        paymentMethod: true,
        cashAmount: true,
        cardAmount: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    const grouped: Record<string, { revenue: number; transactions: number; cash: number; card: number }> = {}

    for (const sale of sales) {
      let key: string
      if (isSingleDay) {
        const d = new Date(sale.createdAt)
        const hour = d.getHours()
        key = `${hour.toString().padStart(2, '0')}:00`
      } else {
        key = sale.createdAt.toISOString().slice(0, 10)
      }

      if (!grouped[key]) {
        grouped[key] = { revenue: 0, transactions: 0, cash: 0, card: 0 }
      }
      const amount = Number(sale.finalAmount)
      grouped[key].revenue += amount
      grouped[key].transactions += 1

      if (sale.paymentMethod === 'CASH') {
        grouped[key].cash += amount
      } else if (sale.paymentMethod === 'CARD') {
        grouped[key].card += amount
      } else {
        // MIXED
        const cashVal = sale.cashAmount != null ? Number(sale.cashAmount) : amount / 2
        const cardVal = sale.cardAmount != null ? Number(sale.cardAmount) : amount / 2
        grouped[key].cash += cashVal
        grouped[key].card += cardVal
      }
    }

    const chartData = Object.entries(grouped).map(([date, data]) => ({
      date,
      revenue: Math.round(data.revenue * 100) / 100,
      transactions: data.transactions,
      cash: Math.round(data.cash * 100) / 100,
      card: Math.round(data.card * 100) / 100,
    }))

    res.json({ chartData })
  } catch (err) {
    console.error('Revenue chart error:', err)
    res.status(500).json({ error: 'სერვერის შეცდომა' })
  }
}

export const getBestSellers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { period, startDate, endDate } = req.query
    const { start, end } = parseDateRange(
      period ? String(period) : undefined,
      startDate ? String(startDate) : undefined,
      endDate ? String(endDate) : undefined
    )

    const topSales = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: { sale: { createdAt: { gte: start, lte: end } } },
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    })

    const bestSellers = await Promise.all(
      topSales.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { id: true, name: true, barcode: true, sellingPrice: true, stock: true },
        })
        return {
          id: product?.id || item.productId,
          name: product?.name || 'უცნობი პროდუქტი',
          barcode: product?.barcode || '-',
          sellingPrice: product?.sellingPrice || 0,
          stock: product?.stock || 0,
          product,
          totalQuantity: Math.round((item._sum.quantity || 0) * 100) / 100,
          totalRevenue: Math.round(Number(item._sum.totalPrice || 0) * 100) / 100,
        }
      })
    )

    res.json({ bestSellers })
  } catch (err) {
    console.error('Best sellers error:', err)
    res.status(500).json({ error: 'სერვერის შეცდომა' })
  }
}
