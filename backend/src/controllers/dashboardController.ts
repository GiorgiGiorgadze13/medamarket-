import { Response } from 'express'
import { prisma } from '../prisma'
import { AuthRequest } from '../middleware/auth'

export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query
    const now = new Date()

    // Default to today in local time
    const start = startDate
      ? new Date(String(startDate))
      : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const end = endDate
      ? new Date(String(endDate) + 'T23:59:59.999Z')
      : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

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
    const { period = 'daily' } = req.query
    const now = new Date()
    let start: Date

    if (period === 'weekly') {
      start = new Date(now)
      start.setDate(now.getDate() - 7)
    } else if (period === 'monthly') {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
    } else if (period === 'yearly') {
      start = new Date(now.getFullYear(), 0, 1)
    } else {
      // 14 days by default for daily granularity
      start = new Date(now)
      start.setDate(now.getDate() - 14)
      start.setHours(0, 0, 0, 0)
    }

    const sales = await prisma.sale.findMany({
      where: { createdAt: { gte: start } },
      select: { finalAmount: true, createdAt: true, paymentMethod: true },
      orderBy: { createdAt: 'asc' },
    })

    const grouped: Record<string, { revenue: number; transactions: number; cash: number; card: number }> = {}

    for (const sale of sales) {
      const key = sale.createdAt.toISOString().slice(0, 10)
      if (!grouped[key]) {
        grouped[key] = { revenue: 0, transactions: 0, cash: 0, card: 0 }
      }
      grouped[key].revenue += Number(sale.finalAmount)
      grouped[key].transactions += 1
      if (sale.paymentMethod === 'CASH') grouped[key].cash += Number(sale.finalAmount)
      else if (sale.paymentMethod === 'CARD') grouped[key].card += Number(sale.finalAmount)
      else {
        grouped[key].cash += Number(sale.finalAmount) / 2
        grouped[key].card += Number(sale.finalAmount) / 2
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

export const getBestSellers = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const topSales = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: { sale: { createdAt: { gte: thirtyDaysAgo } } },
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
