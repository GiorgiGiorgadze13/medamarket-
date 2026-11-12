import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { authRouter } from './routes/auth'
import { productsRouter } from './routes/products'
import { salesRouter } from './routes/sales'
import { inventoryRouter } from './routes/inventory'
import { dashboardRouter } from './routes/dashboard'
import { employeesRouter } from './routes/employees'
import { errorHandler } from './middleware/errorHandler'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: true,
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Unified API router
const apiRouter = express.Router()
apiRouter.use('/auth', authRouter)
apiRouter.use('/products', productsRouter)
apiRouter.use('/sales', salesRouter)
apiRouter.use('/inventory', inventoryRouter)
apiRouter.use('/dashboard', dashboardRouter)
apiRouter.use('/employees', employeesRouter)
apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Mount on /api for local dev and standard Vercel rewrites,
// plus root fallback in case a serverless router already stripped /api
app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'Meda Market API is live', timestamp: new Date().toISOString() })
})
app.use('/api', apiRouter)
app.use(apiRouter)

app.use(errorHandler)

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Meda Market Backend running on http://localhost:${PORT}`)
  })
}

export default app
// Compatibility with CommonJS loaders in serverless environments
module.exports = app
module.exports.default = app

