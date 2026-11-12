import { Router } from 'express'
import { getEmployees, updateEmployee, deactivateEmployee } from '../controllers/employeeController'
import { authenticate, requireAdmin } from '../middleware/auth'

export const employeesRouter = Router()

employeesRouter.use(authenticate, requireAdmin)
employeesRouter.get('/', getEmployees)
employeesRouter.put('/:id', updateEmployee)
employeesRouter.delete('/:id', deactivateEmployee)
