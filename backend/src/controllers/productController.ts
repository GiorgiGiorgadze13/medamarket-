import { Response } from 'express'
import { prisma } from '../prisma'
import { AuthRequest } from '../middleware/auth'

export const getProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, category, sortBy, sortOrder, lowStock, outOfStock } = req.query

    const where: any = { isActive: true }

    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { barcode: { contains: String(search) } },
      ]
    }

    if (category) {
      where.categoryId = String(category)
    }

    const orderBy: any = {}
    if (sortBy) {
      orderBy[String(sortBy)] = sortOrder === 'desc' ? 'desc' : 'asc'
    } else {
      orderBy.name = 'asc'
    }

    const products = await prisma.product.findMany({
      where,
      include: { category: true },
      orderBy,
    })

    let filtered = products
    if (lowStock === 'true') {
      filtered = filtered
        .filter(p => p.stock <= p.minStockLevel)
        .sort((a, b) => a.stock - b.stock)
    }
    if (outOfStock === 'true') {
      filtered = filtered.filter(p => p.stock <= 0)
    }

    res.json({ products: filtered })
  } catch (err) {
    console.error('getProducts error:', err)
    res.status(500).json({ error: 'სერვერის შეცდომა' })
  }
}

export const getProductByBarcode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { barcode } = req.params
    const product = await prisma.product.findUnique({
      where: { barcode },
      include: { category: true },
    })

    if (!product || !product.isActive) {
      res.status(404).json({ error: 'პროდუქტი მოცემული შტრიხ-კოდით ვერ მოიძებნა' })
      return
    }

    res.json({ product })
  } catch (err) {
    console.error('getProductByBarcode error:', err)
    res.status(500).json({ error: 'სერვერის შეცდომა' })
  }
}

export const createProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, barcode, categoryId, purchasePrice, sellingPrice, stock, minStockLevel } = req.body

    if (!name || !barcode || !categoryId || purchasePrice === undefined || sellingPrice === undefined) {
      res.status(400).json({ error: 'ყველა სავალდებულო ველი უნდა იყოს შევსებული' })
      return
    }

    const existing = await prisma.product.findUnique({ where: { barcode } })
    if (existing) {
      res.status(409).json({ error: 'პროდუქტი ამ შტრიხ-კოდით უკვე არსებობს' })
      return
    }

    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        barcode: barcode.trim(),
        categoryId,
        purchasePrice: Number(purchasePrice),
        sellingPrice: Number(sellingPrice),
        stock: Number(stock) || 0,
        minStockLevel: Number(minStockLevel) || 5,
      },
      include: { category: true },
    })

    res.status(201).json({ product })
  } catch (err) {
    console.error('createProduct error:', err)
    res.status(500).json({ error: 'სერვერის შეცდომა' })
  }
}

export const updateProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { name, barcode, categoryId, purchasePrice, sellingPrice, stock, minStockLevel, isActive } = req.body

    if (barcode) {
      const existing = await prisma.product.findFirst({
        where: { barcode: barcode.trim(), NOT: { id } },
      })
      if (existing) {
        res.status(409).json({ error: 'პროდუქტი ამ შტრიხ-კოდით უკვე არსებობს' })
        return
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(barcode && { barcode: barcode.trim() }),
        ...(categoryId && { categoryId }),
        ...(purchasePrice !== undefined && { purchasePrice: Number(purchasePrice) }),
        ...(sellingPrice !== undefined && { sellingPrice: Number(sellingPrice) }),
        ...(stock !== undefined && { stock: Number(stock) }),
        ...(minStockLevel !== undefined && { minStockLevel: Number(minStockLevel) }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { category: true },
    })

    res.json({ product })
  } catch (err) {
    console.error('updateProduct error:', err)
    res.status(500).json({ error: 'სერვერის შეცდომა' })
  }
}

export const deleteProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    })
    res.json({ message: 'პროდუქტი წარმატებით წაიშალა (დეაქტივირდა)' })
  } catch (err) {
    console.error('deleteProduct error:', err)
    res.status(500).json({ error: 'სერვერის შეცდომა' })
  }
}

export const getCategories = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { products: { where: { isActive: true } } },
        },
      },
    })
    res.json({ categories })
  } catch (err) {
    console.error('getCategories error:', err)
    res.status(500).json({ error: 'სერვერის შეცდომა' })
  }
}

export const createCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name } = req.body
    if (!name || !name.trim()) {
      res.status(400).json({ error: 'კატეგორიის სახელი სავალდებულოა' })
      return
    }

    const category = await prisma.category.create({
      data: { name: name.trim() },
    })
    res.status(201).json({ category })
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'ეს კატეგორია უკვე არსებობს' })
      return
    }
    console.error('createCategory error:', err)
    res.status(500).json({ error: 'სერვერის შეცდომა' })
  }
}
