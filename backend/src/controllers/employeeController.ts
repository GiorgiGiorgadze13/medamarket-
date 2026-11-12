import { Response } from 'express'
import { prisma } from '../prisma'
import { Role } from '../types/enums'
import { AuthRequest } from '../middleware/auth'

export const getEmployees = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employees = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { sales: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ employees })
  } catch (err) {
    console.error('Get employees error:', err)
    res.status(500).json({ error: 'სერვერის შეცდომა' })
  }
}

export const updateEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { name, email, role, isActive } = req.body

    const employee = await prisma.user.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(role && { role: role as Role }),
        ...(isActive !== undefined && { isActive }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    })
    res.json({ employee })
  } catch (err) {
    console.error('Update employee error:', err)
    res.status(500).json({ error: 'სერვერის შეცდომა' })
  }
}

export const deactivateEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    if (id === req.user!.id) {
      res.status(400).json({ error: 'საკუთარი თავის გათიშვა შეუძლებელია' })
      return
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    })

    res.json({ message: 'თანამშრომლის პროფილი წარმატებით გაითიშა' })
  } catch (err) {
    console.error('Deactivate employee error:', err)
    res.status(500).json({ error: 'სერვერის შეცდომა' })
  }
}
