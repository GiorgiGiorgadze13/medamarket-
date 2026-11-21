import { Response } from 'express'
import { prisma } from '../prisma'
import { AuthRequest } from '../middleware/auth'

/**
 * Helper to calculate start & end timestamps based on named period or custom dates.
 */
function parseDateRange(period?: string, startDate?: string, endDate?: string): { start: Date; end: Date; isSingleDay: boolean } {
  // Asia/Tbilisi is UTC+4 year-round (no DST)
  const now = new Date()
  const tbilisiStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tbilisi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const [nowY, nowM, nowD] = tbilisiStr.split('-').map(Number)

  // 1. If explicit startDate is provided (format: YYYY-MM-DD)
  if (startDate) {
    let startY = nowY, startM = nowM, startD = nowD
    if (typeof startDate === 'string' && startDate.length === 10 && !startDate.includes('T')) {
      const [y, m, d] = startDate.split('-').map(Number)
      startY = y
      startM = m
      startD = d
    }
    // 00:00:00 in Asia/Tbilisi = 20:00:00 previous day UTC
    const start = new Date(Date.UTC(startY, startM - 1, startD, -4, 0, 0, 0))

    const endStr = endDate || startDate
    let endY = startY, endM = startM, endD = startD
    if (typeof endStr === 'string' && endStr.length === 10 && !endStr.includes('T')) {
      const [y, m, d] = endStr.split('-').map(Number)
      endY = y
      endM = m
      endD = d
    }
    // 23:59:59.999 in Asia/Tbilisi = 19:59:59.999 same day UTC
    const end = new Date(Date.UTC(endY, endM - 1, endD, 19, 59, 59, 999))

    const isSingleDay = startY === endY && startM === endM && startD === endD
    return { start, end, isSingleDay }
  }

  // 2. Named periods based on today in Asia/Tbilisi
  const todayStart = new Date(Date.UTC(nowY, nowM - 1, nowD, -4, 0, 0, 0))
  const todayEnd = new Date(Date.UTC(nowY, nowM - 1, nowD, 19, 59, 59, 999))

  switch (period) {
    case 'today':
      return { start: todayStart, end: todayEnd, isSingleDay: true }

    case '2days': {
      const start = new Date(Date.UTC(nowY, nowM - 1, nowD - 1, -4, 0, 0, 0))
      return { start, end: todayEnd, isSingleDay: false }
    }

    case '3days': {
      const start = new Date(Date.UTC(nowY, nowM - 1, nowD - 2, -4, 0, 0, 0))
      return { start, end: todayEnd, isSingleDay: false }
    }

    case 'week':
    case 'weekly': {
      const start = new Date(Date.UTC(nowY, nowM - 1, nowD - 6, -4, 0, 0, 0))
      return { start, end: todayEnd, isSingleDay: false }
    }

    case '2weeks':
    case 'daily': {
      // 14 days
      const start = new Date(Date.UTC(nowY, nowM - 1, nowD - 13, -4, 0, 0, 0))
      return { start, end: todayEnd, isSingleDay: false }
    }

    case 'month':
    case 'monthly': {
      // 30 days
      const start = new Date(Date.UTC(nowY, nowM - 1, nowD - 29, -4, 0, 0, 0))
      return { start, end: todayEnd, isSingleDay: false }
    }

    case 'year':
    case 'yearly': {
      // From Jan 1 of current year in Asia/Tbilisi
      const start = new Date(Date.UTC(nowY, 0, 1, -4, 0, 0, 0))
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

    const totalRevenue = sales.reduce((sum, s) => sum + (Number(s.finalAmount) || 0), 0)
    const totalTransactions = sales.length
    const totalItemsSold = sales.reduce(
      (sum, s) => sum + (s.items || []).reduce((iSum, item) => iSum + (Number(item.quantity) || 0), 0),
      0
    )

    let cashRevenue = 0
    let cardRevenue = 0
    let bogCardRevenue = 0
    let tbcCardRevenue = 0
    let libertyCardRevenue = 0
    let otherCardRevenue = 0

    for (const sale of sales) {
      const finalAmt = Number(sale.finalAmount) || 0
      if (sale.paymentMethod === 'CASH') {
        cashRevenue += finalAmt
      } else if (sale.paymentMethod === 'CARD') {
        cardRevenue += finalAmt
        const bank = sale.cardBank
        if (bank === 'BOG') bogCardRevenue += finalAmt
        else if (bank === 'TBC') tbcCardRevenue += finalAmt
        else if (bank === 'LIBERTY') libertyCardRevenue += finalAmt
        else otherCardRevenue += finalAmt
      } else if (sale.paymentMethod === 'MIXED') {
        const cAmt = Number(sale.cashAmount) || 0
        const cardAmt = Number(sale.cardAmount) || 0
        cashRevenue += cAmt
        cardRevenue += cardAmt
        const bank = sale.cardBank
        if (bank === 'BOG') bogCardRevenue += cardAmt
        else if (bank === 'TBC') tbcCardRevenue += cardAmt
        else if (bank === 'LIBERTY') libertyCardRevenue += cardAmt
        else otherCardRevenue += cardAmt
      }
    }

    // Gross profit = final revenue - Cost of Goods Sold (purchasePrice * quantity)
    let totalCostOfGoodsSold = 0
    for (const sale of sales) {
      for (const item of (sale.items || [])) {
        const purchasePrice = Number(item.product?.purchasePrice) || 0
        const qty = Number(item.quantity) || 0
        totalCostOfGoodsSold += purchasePrice * qty
      }
    }
    const grossProfit = Math.max(0, Math.round((totalRevenue - totalCostOfGoodsSold) * 100) / 100)

    const totalProducts = allProducts.length
    const lowStockProducts = allProducts.filter(p => p.stock > 0 && p.stock <= p.minStockLevel).length
    const outOfStockProducts = allProducts.filter(p => p.stock <= 0).length

    res.json({
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalTransactions,
      totalItemsSold: Math.round(totalItemsSold * 100) / 100,
      cashRevenue: Math.round(cashRevenue * 100) / 100,
      cardRevenue: Math.round(cardRevenue * 100) / 100,
      bogCardRevenue: Math.round(bogCardRevenue * 100) / 100,
      tbcCardRevenue: Math.round(tbcCardRevenue * 100) / 100,
      libertyCardRevenue: Math.round(libertyCardRevenue * 100) / 100,
      otherCardRevenue: Math.round(otherCardRevenue * 100) / 100,
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
        const hourStr = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Tbilisi',
          hour: '2-digit',
          hour12: false,
        }).format(new Date(sale.createdAt))
        key = `${hourStr}:00`
      } else {
        key = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Tbilisi',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(sale.createdAt))
      }

      if (!grouped[key]) {
        grouped[key] = { revenue: 0, transactions: 0, cash: 0, card: 0 }
      }
      const amount = Number(sale.finalAmount) || 0
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
