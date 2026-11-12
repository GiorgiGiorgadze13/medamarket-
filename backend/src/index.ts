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

// Routes
app.use('/api/auth', authRouter)
app.use('/api/products', productsRouter)
app.use('/api/sales', salesRouter)
app.use('/api/inventory', inventoryRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/employees', employeesRouter)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use(errorHandler)

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Meda Market Backend running on http://localhost:${PORT}`)
  })
}

export default app
