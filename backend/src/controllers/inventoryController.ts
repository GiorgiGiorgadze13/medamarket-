import { Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { MovementType } from '../types/enums'
import { AuthRequest } from '../middleware/auth'
import { v4 as uuidv4 } from 'uuid'

const prisma = new PrismaClient()

export const getInventoryHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { productId, movementType, page = '1', limit = '50' } = req.query
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = {}
    if (productId) where.productId = String(productId)
    if (movementType) where.movementType = String(movementType) as MovementType

    const [history, total] = await prisma.$transaction([
      prisma.inventoryHistory.findMany({
        where,
        include: {
          product: {
            select: { name: true, barcode: true, stock: true },
          },
          user: {
            select: { name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.inventoryHistory.count({ where }),
    ])

    res.json({ history, total, page: Number(page), limit: Number(limit) })
  } catch (err) {
    console.error('Inventory history error:', err)
    res.status(500).json({ error: 'სერვერის შეცდომა' })
  }
}

export const addStock = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { productId } = req.params
    const { quantity, reason, notes } = req.body

    const qty = Number(quantity)
    if (!qty || qty <= 0) {
      res.status(400).json({ error: 'მიღებული რაოდენობა უნდა იყოს 0-ზე მეტი' })
      return
    }

    const updatedProduct = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } })
      if (!product) {
        throw new Error('პროდუქტი ვერ მოიძებნა')
      }

      const updated = await tx.product.update({
        where: { id: productId },
        data: { stock: { increment: qty } },
        include: { category: true },
      })

      await tx.inventoryHistory.create({
        data: {
          id: uuidv4(),
          productId,
          userId: req.user!.id,
          movementType: MovementType.PURCHASE,
          quantity: qty,
          reason: reason || 'მარაგის შევსება / მიღება',
          notes: notes || null,
        },
      })

      return updated
    })

    res.json({ product: updatedProduct, message: 'მარაგი წარმატებით შეივსო' })
  } catch (err: any) {
    console.error('Add stock error:', err)
    res.status(400).json({ error: err.message || 'სერვერის შეცდომა' })
  }
}

export const adjustStock = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { productId } = req.params
    const { newQuantity, reason, notes } = req.body

    if (!reason || !reason.trim()) {
      res.status(400).json({ error: 'მარაგის კორექტირების მიზეზის მითითება სავალდებულოა' })
      return
    }

    const targetQty = Number(newQuantity)
    if (isNaN(targetQty) || targetQty < 0) {
      res.status(400).json({ error: 'ახალი რაოდენობა უნდა იყოს 0 ან დადებითი რიცხვი' })
      return
    }

    const updatedProduct = await prisma.$transaction(async (tx) => {
      const current = await tx.product.findUnique({ where: { id: productId } })
      if (!current) {
        throw new Error('პროდუქტი ვერ მოიძებნა')
      }

      const diff = targetQty - current.stock

      const updated = await tx.product.update({
        where: { id: productId },
        data: { stock: targetQty },
        include: { category: true },
      })

      await tx.inventoryHistory.create({
        data: {
          id: uuidv4(),
          productId,
          userId: req.user!.id,
          movementType: MovementType.ADJUSTMENT,
          quantity: diff,
          reason: reason.trim(),
          notes: notes || null,
        },
      })

      return updated
    })

    res.json({ product: updatedProduct, message: 'მარაგი წარმატებით დარედაქტირდა' })
  } catch (err: any) {
    console.error('Adjust stock error:', err)
    res.status(400).json({ error: err.message || 'სერვერის შეცდომა' })
  }
}
