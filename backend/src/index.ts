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
import { prisma } from './prisma'

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
apiRouter.get('/health', async (_req, res) => {
  try {
    const hasDb = !!process.env.DATABASE_URL
    let dbConnected = false
    let userCount = 0
    if (hasDb) {
      userCount = await prisma.user.count()
      dbConnected = true
    }
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: {
        configured: hasDb,
        connected: dbConnected,
        userCount,
      },
    })
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: {
        configured: !!process.env.DATABASE_URL,
        connected: false,
        error: err?.message || 'Database connection error',
      },
    })
  }
})

// Mount on /api for local dev and standard Vercel rewrites,
// plus root fallback in case a serverless router already stripped /api
app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'Meda Market API is live',
    timestamp: new Date().toISOString(),
    env: {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasJwtSecret: !!process.env.JWT_SECRET,
    },
  })
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

