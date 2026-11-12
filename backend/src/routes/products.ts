import { Router } from 'express'
import {
  getProducts, getProductByBarcode, createProduct,
  updateProduct, deleteProduct, getCategories, createCategory
} from '../controllers/productController'
import { authenticate, requireAdmin } from '../middleware/auth'

export const productsRouter = Router()

productsRouter.use(authenticate)
productsRouter.get('/', getProducts)
productsRouter.get('/categories', getCategories)
productsRouter.get('/barcode/:barcode', getProductByBarcode)
productsRouter.post('/categories', requireAdmin, createCategory)
productsRouter.post('/', requireAdmin, createProduct)
productsRouter.put('/:id', requireAdmin, updateProduct)
productsRouter.delete('/:id', requireAdmin, deleteProduct)
