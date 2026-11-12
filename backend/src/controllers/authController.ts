import { Request, Response } from 'express'
import { prisma } from '../prisma'
import { Role } from '../types/enums'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { AuthRequest } from '../middleware/auth'

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      res.status(400).json({ error: 'ელ-ფოსტა და პაროლი სავალდებულოა' })
      return
    }

    const user = await prisma.user.findUnique({ where: { email } })

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'მომხმარებელი ვერ მოიძებნა' })
      return
    }

    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      res.status(401).json({ error: 'არასწორი პაროლი' })
      return
    }

    const secret = process.env.JWT_SECRET || 'fallback-secret'
    const token = jwt.sign({ id: user.id }, secret, { expiresIn: '24h' })

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'სერვერის შეცდომა' })
  }
}

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({ user: req.user })
}

export const createEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, name, password, role } = req.body
    if (!email || !name || !password) {
      res.status(400).json({ error: 'ყველა ველი სავალდებულოა' })
      return
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      res.status(409).json({ error: 'ეს ელ-ფოსტა უკვე გამოყენებულია' })
      return
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { email, name, password: hashedPassword, role: (role as Role) || Role.CASHIER },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    })

    res.status(201).json({ user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'სერვერის შეცდომა' })
  }
}

export const updatePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } })
    if (!user) { res.status(404).json({ error: 'მომხმარებელი ვერ მოიძებნა' }); return }

    const isValid = await bcrypt.compare(currentPassword, user.password)
    if (!isValid) { res.status(401).json({ error: 'მიმდინარე პაროლი არასწორია' }); return }

    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } })
    res.json({ message: 'პაროლი წარმატებით შეიცვალა' })
  } catch {
    res.status(500).json({ error: 'სერვერის შეცდომა' })
  }
}
