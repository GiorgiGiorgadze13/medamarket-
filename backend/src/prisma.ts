import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const dbUrl =
      process.env.DATABASE_URL ||
      'postgresql://neondb_owner:npg_EKr5aMdtU6qO@ep-still-mud-begpl2uj-pooler.c-9.us-east-2.aws.neon.tech/neondb?sslmode=require'

    globalForPrisma.prisma = new PrismaClient({
      datasources: {
        db: {
          url: dbUrl,
        },
      },
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })
  }
  return globalForPrisma.prisma
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient()
    const value = (client as any)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
})
