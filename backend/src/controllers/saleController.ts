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
    const { items, paymentMethod, cashAmount, cardAmount, discountAmount } = req.body

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'კალათა ცარიელია' })
      return
    }

    if (!['CASH', 'CARD', 'MIXED'].includes(paymentMethod)) {
      res.status(400).json({ error: 'გადახდის მეთოდი არასწორია' })
      return
    }

    // Atomic transaction for sale creation & stock deduction
    const sale = await prisma.$transaction(async (tx) => {
      let totalAmount = 0

      // Validate products and check stock levels
      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } })
        if (!product || !product.isActive) {
          throw new Error(`პროდუქტი ვერ მოიძებნა ან არააქტიურია (ID: ${item.productId})`)
        }
        if (product.stock < item.quantity) {
          throw new Error(`${product.name}: არასაკმარისი მარაგი (მარაგშია: ${product.stock}, მოთხოვნილია: ${item.quantity})`)
        }
        totalAmount += Number(product.sellingPrice) * item.quantity
      }

      const discount = Number(discountAmount) || 0
      const finalAmount = Math.max(0, totalAmount - discount)

      let changeAmount = 0
      if (paymentMethod === 'CASH') {
        const received = Number(cashAmount) || 0
        if (received < finalAmount) {
          throw new Error('მიღებული თანხა ნაკლებია გადასახდელზე')
        }
        changeAmount = received - finalAmount
      } else if (paymentMethod === 'MIXED') {
        const totalPaid = (Number(cashAmount) || 0) + (Number(cardAmount) || 0)
        if (totalPaid < finalAmount) {
          throw new Error('ჯამური გადახდილი თანხა ნაკლებია გადასახდელზე')
        }
        changeAmount = totalPaid - finalAmount
      } else if (paymentMethod === 'CARD') {
        changeAmount = 0
      }

      const receiptNumber = generateReceiptNumber()

      // Create Sale record
      const createdSale = await tx.sale.create({
        data: {
          receiptNumber,
          cashierId: req.user!.id,
          totalAmount,
          discountAmount: discount,
          finalAmount,
          paymentMethod: paymentMethod as PaymentMethod,
          cashAmount: cashAmount !== undefined && cashAmount !== null ? Number(cashAmount) : null,
          cardAmount: cardAmount !== undefined && cardAmount !== null ? Number(cardAmount) : null,
          changeAmount,
          items: {
            create: await Promise.all(
              items.map(async (item: { productId: string; quantity: number }) => {
                const product = await tx.product.findUnique({ where: { id: item.productId } })
                return {
                  id: uuidv4(),
                  productId: item.productId,
                  quantity: item.quantity,
                  unitPrice: Number(product!.sellingPrice),
                  totalPrice: Number(product!.sellingPrice) * item.quantity,
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
    console.error('Sale error:', err)
    res.status(400).json({ error: err.message || 'სერვერის შეცდომა' })
  }
}

export const getSales = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, page = '1', limit = '20' } = req.query
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = {}
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(String(startDate))
      if (endDate) where.createdAt.lte = new Date(String(endDate) + 'T23:59:59.999Z')
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
