import { Router } from 'express'
import { getDashboardStats, getRevenueChart, getBestSellers } from '../controllers/dashboardController'
import { authenticate, requireAdmin } from '../middleware/auth'

export const dashboardRouter = Router()

dashboardRouter.use(authenticate, requireAdmin)
dashboardRouter.get('/stats', getDashboardStats)
dashboardRouter.get('/revenue-chart', getRevenueChart)
dashboardRouter.get('/best-sellers', getBestSellers)
