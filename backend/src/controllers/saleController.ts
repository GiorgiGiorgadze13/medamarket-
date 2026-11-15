import { Response } from 'express'
import { prisma } from '../prisma'
import { PaymentMethod, MovementType } from '../types/enums'
import { AuthRequest } from '../middleware/auth'
import { v4 as uuidv4 } from 'uuid'

function generateReceiptNumber(): string {
  const now = new Date()
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '')
  const timePart = now.toTimeString().slice(0, 8).replace(/:/g, '')
  const randomPart = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `MM-${datePart}-${timePart}-${randomPart}`
}

export const createSale = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { items, paymentMethod, cashAmount, cardAmount, discountAmount, idempotencyKey, cardBank } = req.body

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'კალათა ცარიელია' })
      return
    }

    if (!['CASH', 'CARD', 'MIXED'].includes(paymentMethod)) {
      res.status(400).json({ error: 'გადახდის მეთოდი არასწორია' })
      return
    }

    const validCardBank =
      (paymentMethod === 'CARD' || paymentMethod === 'MIXED') && typeof cardBank === 'string' && cardBank.trim().length > 0
        ? cardBank.trim()
        : null

    // 1. Idempotency Check: If key was provided, verify if sale already exists
    const validIdempotencyKey = typeof idempotencyKey === 'string' && idempotencyKey.trim().length > 0
      ? idempotencyKey.trim()
      : null

    if (validIdempotencyKey) {
      const existingSale = await prisma.sale.findUnique({
        where: { idempotencyKey: validIdempotencyKey },
        include: {
          items: {
            include: { product: true },
          },
          cashier: {
            select: { name: true, email: true },
          },
        },
      })

      if (existingSale) {
        // Return existing sale without deducting stock again or creating duplicate
        res.status(200).json({ sale: existingSale, isDuplicate: true })
        return
      }
    }

    // Atomic transaction for sale creation & stock deduction
    const sale = await prisma.$transaction(async (tx) => {
      // Re-verify idempotency inside transaction to prevent race conditions from concurrent duplicate requests
      if (validIdempotencyKey) {
        const raceCheck = await tx.sale.findUnique({
          where: { idempotencyKey: validIdempotencyKey },
          include: {
            items: {
              include: { product: true },
            },
            cashier: {
              select: { name: true, email: true },
            },
          },
        })
        if (raceCheck) {
          return raceCheck
        }
      }
      let originalTotal = 0
      let totalItemDiscounts = 0

      // Validate products and check stock levels
      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } })
        if (!product || !product.isActive) {
          throw new Error(`პროდუქტი ვერ მოიძებნა ან არააქტიურია (ID: ${item.productId})`)
        }
        if (product.stock < item.quantity) {
          throw new Error(`${product.name}: არასაკმარისი მარაგი (მარაგშია: ${product.stock}, მოთხოვნილია: ${item.quantity})`)
        }
        const basePrice = Number(product.sellingPrice)
        const discountPct = Math.min(100, Math.max(0, Number(item.discountPercent) || 0))
        const itemOriginal = basePrice * item.quantity
        const itemDiscount = itemOriginal * (discountPct / 100)
        originalTotal += itemOriginal
        totalItemDiscounts += itemDiscount
      }

      const cartDiscount = Number(discountAmount) || 0
      const totalDiscount = Math.round((totalItemDiscounts + cartDiscount) * 100) / 100
      const finalAmount = Math.max(0, Math.round((originalTotal - totalDiscount) * 100) / 100)

      let changeAmount = 0
      if (paymentMethod === 'CASH') {
        const received = Number(cashAmount) || 0
        if (received < finalAmount) {
          throw new Error('მიღებული თანხა ნაკლებია გადასახდელზე')
        }
        changeAmount = Math.round((received - finalAmount) * 100) / 100
      } else if (paymentMethod === 'MIXED') {
        const totalPaid = (Number(cashAmount) || 0) + (Number(cardAmount) || 0)
        if (totalPaid < finalAmount) {
          throw new Error('ჯამური გადახდილი თანხა ნაკლებია გადასახდელზე')
        }
        changeAmount = Math.round((totalPaid - finalAmount) * 100) / 100
      } else if (paymentMethod === 'CARD') {
        changeAmount = 0
      }

      const receiptNumber = generateReceiptNumber()

      // Create Sale record
      const createdSale = await tx.sale.create({
        data: {
          idempotencyKey: validIdempotencyKey,
          receiptNumber,
          cashierId: req.user!.id,
          totalAmount: Math.round(originalTotal * 100) / 100,
          discountAmount: totalDiscount,
          finalAmount,
          paymentMethod: paymentMethod as PaymentMethod,
          cardBank: validCardBank,
          cashAmount: cashAmount !== undefined && cashAmount !== null ? Number(cashAmount) : null,
          cardAmount: cardAmount !== undefined && cardAmount !== null ? Number(cardAmount) : null,
          changeAmount,
          items: {
            create: await Promise.all(
              items.map(async (item: { productId: string; quantity: number; discountPercent?: number }) => {
                const product = await tx.product.findUnique({ where: { id: item.productId } })
                const basePrice = Number(product!.sellingPrice)
                const discountPct = Math.min(100, Math.max(0, Number(item.discountPercent) || 0))
                const effectiveUnitPrice = Math.max(0, Math.round(basePrice * (1 - discountPct / 100) * 100) / 100)
                const totalPrice = Math.round(effectiveUnitPrice * item.quantity * 100) / 100
                return {
                  id: uuidv4(),
                  productId: item.productId,
                  quantity: item.quantity,
                  unitPrice: effectiveUnitPrice,
                  totalPrice: totalPrice,
                }
              })
            ),
          },
        },
        include: {
          items: {
            include: { product: true },
          },
          cashier: {
            select: { name: true, email: true },
          },
        },
      })

      // Decrement stock and create inventory history records
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        })

        await tx.inventoryHistory.create({
          data: {
            id: uuidv4(),
            productId: item.productId,
            userId: req.user!.id,
            movementType: MovementType.SALE,
            quantity: -item.quantity,
            reason: `გაყიდვა #${receiptNumber}`,
          },
        })
      }

      return createdSale
    })

    res.status(201).json({ sale })
  } catch (err: any) {
    // If a unique constraint violation happens on idempotencyKey concurrently
    if (err.code === 'P2002' && err.meta?.target?.includes('idempotencyKey') && req.body.idempotencyKey) {
      try {
        const existing = await prisma.sale.findUnique({
          where: { idempotencyKey: String(req.body.idempotencyKey).trim() },
          include: {
            items: { include: { product: true } },
            cashier: { select: { name: true, email: true } },
          },
        })
        if (existing) {
          res.status(200).json({ sale: existing, isDuplicate: true })
          return
        }
      } catch (subErr) {
        // Fall through to general error handler
      }
    }
    console.error('Sale error:', err)
    res.status(400).json({ error: err.message || 'სერვერის შეცდომა' })
  }
}

export const getSales = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, page = '1', limit = '20', paymentMethod, cardBank } = req.query
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = {}
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(String(startDate))
      if (endDate) where.createdAt.lte = new Date(String(endDate) + 'T23:59:59.999Z')
    }

    if (paymentMethod && paymentMethod !== 'ALL') {
      where.paymentMethod = String(paymentMethod)
    }

    if (cardBank && cardBank !== 'ALL') {
      where.cardBank = String(cardBank)
    }

    const [sales, total] = await prisma.$transaction([
      prisma.sale.findMany({
        where,
        include: {
          items: {
            include: {
              product: {
                select: { name: true, barcode: true },
              },
            },
          },
          cashier: {
            select: { name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.sale.count({ where }),
    ])

    res.json({ sales, total, page: Number(page), limit: Number(limit) })
  } catch (err) {
    console.error('Get sales error:', err)
    res.status(500).json({ error: 'სერვერის შეცდომა' })
  }
}

export const getSaleById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            product: {
              include: { category: true },
            },
          },
        },
        cashier: {
          select: { name: true, email: true },
        },
      },
    })
    if (!sale) {
      res.status(404).json({ error: 'გაყიდვა ვერ მოიძებნა' })
      return
    }
    res.json({ sale })
  } catch (err) {
    res.status(500).json({ error: 'სერვერის შეცდომა' })
  }
}

export const getSaleReceipt = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: { product: true },
        },
        cashier: {
          select: { name: true },
        },
      },
    })
    if (!sale) {
      res.status(404).json({ error: 'ქვითარი ვერ მოიძებნა' })
      return
    }
    res.json({ sale })
  } catch (err) {
    res.status(500).json({ error: 'სერვერის შეცდომა' })
  }
}

export const deleteSale = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { items: true },
    })

    if (!sale) {
      res.status(404).json({ error: 'ჩეკი ვერ მოიძებნა' })
      return
    }

    await prisma.$transaction(async (tx) => {
      // 1. Restore product stock
      for (const item of sale.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        })

        await tx.inventoryHistory.create({
          data: {
            id: uuidv4(),
            productId: item.productId,
            userId: req.user!.id,
            movementType: MovementType.RETURN,
            quantity: item.quantity,
            reason: `ჩეკის წაშლა #${sale.receiptNumber}`,
          },
        })
      }

      // 2. Delete sale items
      await tx.saleItem.deleteMany({
        where: { saleId: id },
      })

      // 3. Delete sale record
      await tx.sale.delete({
        where: { id },
      })
    })

    res.json({ message: 'ჩეკი წარმატებით წაიშალა და პროდუქციის მარაგი დაბრუნდა' })
  } catch (err: any) {
    console.error('Delete sale error:', err)
    res.status(500).json({ error: err?.message || 'სერვერის შეცდომა' })
  }
}
