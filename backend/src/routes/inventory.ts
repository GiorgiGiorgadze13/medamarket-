import { Router } from 'express'
import { getInventoryHistory, addStock, adjustStock } from '../controllers/inventoryController'
import { authenticate, requireAdmin } from '../middleware/auth'

export const inventoryRouter = Router()

inventoryRouter.use(authenticate)
inventoryRouter.get('/history', getInventoryHistory)
inventoryRouter.post('/add-stock/:productId', requireAdmin, addStock)
inventoryRouter.post('/adjust/:productId', requireAdmin, adjustStock)
