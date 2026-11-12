import { Router } from 'express'
import { createSale, getSales, getSaleById, getSaleReceipt, deleteSale } from '../controllers/saleController'
import { authenticate } from '../middleware/auth'

export const salesRouter = Router()
salesRouter.use(authenticate)
salesRouter.post('/', createSale)
salesRouter.get('/', getSales)
salesRouter.get('/:id', getSaleById)
salesRouter.get('/:id/receipt', getSaleReceipt)
salesRouter.delete('/:id', deleteSale)
