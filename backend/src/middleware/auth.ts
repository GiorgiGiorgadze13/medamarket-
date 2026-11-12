import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../prisma'

export interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    name: string
    role: string
  }
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'ავტორიზაცია საჭიროა' })
      return
    }

    const token = authHeader.substring(7)
    const secret = process.env.JWT_SECRET || 'fallback-secret'
    const decoded = jwt.verify(token, secret) as { id: string }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    })

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'მომხმარებელი ვერ მოიძებნა ან გათიშულია' })
      return
    }

    req.user = { id: user.id, email: user.email, name: user.name, role: user.role }
    next()
  } catch {
    res.status(401).json({ error: 'არასწორი ტოკენი' })
  }
}

export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({ error: 'ადმინისტრატორის უფლება საჭიროა' })
    return
  }
  next()
}
