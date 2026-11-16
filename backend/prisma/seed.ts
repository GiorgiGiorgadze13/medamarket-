import { PrismaClient } from '@prisma/client'
import { Role } from '../src/types/enums'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const adminPassword = await bcrypt.hash('admin123', 10)
  await prisma.user.upsert({
    where: { email: 'admin@medamarket.ge' },
    update: {},
    create: {
      email: 'admin@medamarket.ge',
      name: 'ადმინისტრატორი',
      password: adminPassword,
      role: Role.ADMIN,
    },
  })

  const cashierPassword = await bcrypt.hash('cashier123', 10)
  await prisma.user.upsert({
    where: { email: 'cashier@medamarket.ge' },
    update: {},
    create: {
      email: 'cashier@medamarket.ge',
      name: 'მოლარე',
      password: cashierPassword,
      role: Role.CASHIER,
    },
  })

  const categoryNames = [
    'ხილ-ბოსტნეული',
    'სასმელი',
    'ბაკალეა',
    'ჩაი, ყავა და კაკაო',
    'პურ-ფუნთუშეული',
    'ტკბილეული და ნაყინი',
    'სნექი',
    'კონსერვი',
    'სოსისი და ძეხვეული',
    'კვერცხი და რძის ნაწარმი',
    'ხორცი და ნახევარფაბრიკატები',
    'სახლის მოვლა და ჰიგიენა',
    'ზღვის პროდუქტები',
    'ცხოველთა კვება',
    'სათამაშოები',
    'სიგარეტი და თამბაქო',
    'ტკბილეული',
    'მარცვლეული',
    'ხორცეული',
    'რძის ნაწარმი',
    'სანელებლები და სოუსები',
    'ბავშვის მოვლა',
    'რძის პროდუქტები',
    'პური და საკონდიტრო',
    'ხორცი და თევზი',
    'ბოსტნეული და ხილი',
    'სასმელები',
    'მარცვლეული და პარკოსნები',
    'კონდიტერული',
    'სანელებლები',
    'საყოფაცხოვრებო ქიმია',
    'სხვა',
  ]

  const createdCategories: Record<string, string> = {}
  for (const name of categoryNames) {
    const cat = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    })
    createdCategories[name] = cat.id
  }

  const products = [
    { name: 'რძე 1ლ', barcode: '4860019710019', cat: 'რძის პროდუქტები', pp: 2.5, sp: 3.2, stock: 50, min: 10 },
    { name: 'ყველი სულგუნი 500გ', barcode: '4860019710026', cat: 'რძის პროდუქტები', pp: 8.0, sp: 11.5, stock: 30, min: 5 },
    { name: 'პური ქართული', barcode: '4860019710033', cat: 'პური და საკონდიტრო', pp: 1.8, sp: 2.5, stock: 100, min: 20 },
    { name: 'ბორჯომი 0.5ლ', barcode: '4860004740025', cat: 'სასმელები', pp: 0.9, sp: 1.5, stock: 200, min: 50 },
    { name: 'ბორჯომი 1ლ', barcode: '4860004740032', cat: 'სასმელები', pp: 1.5, sp: 2.2, stock: 150, min: 30 },
    { name: 'კვერცხი 10ც', barcode: '4860019710040', cat: 'სხვა', pp: 4.5, sp: 6.0, stock: 80, min: 15 },
    { name: 'ზეთი მზესუმზირა 1ლ', barcode: '4860019710057', cat: 'სხვა', pp: 5.0, sp: 7.5, stock: 60, min: 10 },
    { name: 'შაქარი 1კგ', barcode: '4860019710064', cat: 'სხვა', pp: 2.8, sp: 4.0, stock: 100, min: 20 },
    { name: 'მაკარონი სპაგეტი 500გ', barcode: '4860019710071', cat: 'მარცვლეული და პარკოსნები', pp: 1.5, sp: 2.5, stock: 70, min: 15 },
    { name: 'ჩოკოლადი მილქა 100გ', barcode: '7622210100658', cat: 'კონდიტერული', pp: 3.5, sp: 5.0, stock: 40, min: 10 },
    { name: 'ყავა 500გ', barcode: '4860019710088', cat: 'სხვა', pp: 12.0, sp: 18.0, stock: 25, min: 5 },
    { name: 'ჩაი შავი 100გ', barcode: '4860019710095', cat: 'სხვა', pp: 3.0, sp: 5.0, stock: 45, min: 10 },
    { name: 'მარილი 1კგ', barcode: '4860019710101', cat: 'სანელებლები', pp: 0.8, sp: 1.5, stock: 90, min: 20 },
    { name: 'ბრინჯი 1კგ', barcode: '4860019710118', cat: 'მარცვლეული და პარკოსნები', pp: 3.5, sp: 5.5, stock: 55, min: 15 },
    { name: 'ბანანი 1კგ', barcode: '4860019710125', cat: 'ბოსტნეული და ხილი', pp: 2.0, sp: 3.5, stock: 60, min: 20 },
  ]

  for (const p of products) {
    await prisma.product.upsert({
      where: { barcode: p.barcode },
      update: {},
      create: {
        name: p.name,
        barcode: p.barcode,
        categoryId: createdCategories[p.cat],
        purchasePrice: p.pp,
        sellingPrice: p.sp,
        stock: p.stock,
        minStockLevel: p.min,
      },
    })
  }

  console.log('✅ Seed completed successfully')
  console.log('📧 Admin: admin@medamarket.ge / admin123')
  console.log('📧 Cashier: cashier@medamarket.ge / cashier123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
