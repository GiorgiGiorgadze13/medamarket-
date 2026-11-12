# Meda Market — POS & Inventory Management System

A full-featured Point-of-Sale and Inventory Management System built for Georgian retail, with Georgian-language UI and product data.

## 🛠 Tech Stack

**Backend**
- Node.js + TypeScript
- Express.js (REST API)
- Prisma ORM + PostgreSQL
- JWT Authentication
- bcryptjs password hashing

**Frontend**
- React 18 + TypeScript
- Vite
- Tailwind CSS
- React Router v6
- Recharts (dashboard analytics)
- Axios (HTTP client)
- react-hot-toast (notifications)
- lucide-react (icons)

## 📋 Prerequisites

- **Node.js** 18 or later
- **npm** 9 or later
- **PostgreSQL** 14 or later (running locally or remote)

## 🚀 Setup Instructions

### 1. Download / Clone the project

```bash
git clone <repo-url>
cd Medamarket
```

### 2. Create the PostgreSQL database

Connect to PostgreSQL and run:

```sql
CREATE DATABASE medamarket;
```

### 3. Install backend dependencies

```bash
cd backend
npm install
```

### 4. Configure backend environment

Edit `backend/.env` and update the connection string with your PostgreSQL credentials:

```env
DATABASE_URL="postgresql://<user>:<password>@localhost:5432/medamarket"
JWT_SECRET="medamarket-jwt-secret-2024-change-in-production"
PORT=3001
NODE_ENV=development
```

### 5. Run database migrations

```bash
npx prisma migrate dev --name init
```

### 6. Seed the database

```bash
npx prisma db seed
```

### 7. Start the backend

```bash
npm run dev
```

The API server starts on **http://localhost:3001**.

### 8. Install frontend dependencies and start

Open a new terminal:

```bash
cd ../frontend
npm install
npm run dev
```

The frontend starts on **http://localhost:5173**.

---

## 🔑 Default Credentials

| Role  | Email | Password |
|-------|-------|----------|
| Admin | admin@medamarket.ge | admin123 |
| Cashier | cashier@medamarket.ge | cashier123 |

> ⚠️ Change these credentials before deploying to production.

---

## 📁 Project Structure

```
Medamarket/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma   # Database schema
│   │   └── seed.ts         # Seed data (users, categories, products)
│   ├── src/                # TypeScript source
│   │   ├── index.ts        # Express app entry point
│   │   ├── routes/         # API route handlers
│   │   ├── middleware/      # Auth & error middleware
│   │   └── types/          # Shared TypeScript types
│   ├── .env                # Environment variables (do not commit)
│   ├── .env.example        # Environment variable template
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    ├── src/
    │   ├── main.tsx         # React entry point
    │   ├── App.tsx          # Router setup
    │   ├── components/      # Reusable UI components
    │   ├── pages/           # Page-level components
    │   ├── hooks/           # Custom React hooks
    │   ├── api/             # Axios API helpers
    │   └── types/           # Shared TypeScript types
    ├── index.html
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── tsconfig.json
    └── package.json
```

## 🔌 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Login and get JWT |
| GET | /api/products | List products |
| POST | /api/products | Create product |
| GET | /api/sales | List sales |
| POST | /api/sales | Create new sale |
| GET | /api/inventory | Inventory history |
| GET | /api/reports/dashboard | Dashboard stats |

## 📄 License

MIT
