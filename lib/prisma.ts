import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "@/generated/prisma/client"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export function getPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    throw new Error("DATABASE_URL is not set")
  }
  if (globalForPrisma.prisma) return globalForPrisma.prisma
  const adapter = new PrismaPg({ connectionString: url })
  const prisma = new PrismaClient({ adapter })
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma
  }
  return prisma
}
