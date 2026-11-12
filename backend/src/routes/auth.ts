import { Router } from 'express'
import { login, getMe, createEmployee, updatePassword } from '../controllers/authController'
import { authenticate, requireAdmin } from '../middleware/auth'

export const authRouter = Router()

authRouter.post('/login', login)
authRouter.get('/me', authenticate, getMe)
authRouter.post('/employees', authenticate, requireAdmin, createEmployee)
authRouter.put('/password', authenticate, updatePassword)
