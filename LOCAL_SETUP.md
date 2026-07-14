# Local Setup Guide

Step-by-step guide to run Gear&Glitch on your Windows machine.

---

## Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org)
- **PostgreSQL 15+** — [Download](https://postgresql.org/download/windows/)

---

## 1. Install PostgreSQL

1. Run the installer from postgresql.org
2. Set a **superuser password** (remember this — you'll need it)
3. Keep the default port: **5432**
4. Complete the installation

After install, open **pgAdmin** (installed automatically) or **SQL Shell (psql)** to confirm it works.

---

## 2. Create the Database

Open **pgAdmin** or **SQL Shell** and run:

```sql
CREATE DATABASE laptop_sale;
```

Or via command line (SQL Shell):

```
CREATE DATABASE laptop_sale;
\q
```

---

## 3. Clone & Install

```bash
git clone https://github.com/gearandglitch/shop.git
cd shop
npm install
cd frontend
npm install
cd ..
```

---

## 4. Configure Environment

Copy the example env file and edit it:

```bash
copy .env.example .env
```

Open `.env` and update `DATABASE_URL` with your local PostgreSQL credentials:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/laptop_sale
```

Replace `YOUR_PASSWORD` with the superuser password you set during PostgreSQL installation. If you created a different user, use that instead.

Also set:

```env
JWT_SECRET=any-long-random-string-here-at-least-32-characters
ADMIN_PASSWORD=a-strong-password-here
TECH_PASSWORD=a-strong-password-here
```

---

## 5. Run the App

Start both backend and frontend in one terminal:

```bash
npm run dev:all
```

Or start them separately in two terminals:

**Terminal 1 — Backend (port 8020):**

```bash
npm run dev
```

**Terminal 2 — Frontend (port 3000):**

```bash
cd frontend
npm run dev
```

Open **http://localhost:3000** in your browser.

> On first run the server creates all tables and seeds default admin/technician accounts automatically.

---

## 6. Default Login

| Role | URL | Email | Password |
|------|-----|-------|----------|
| Admin | `/admin` | `admin@gearandglitch.com` | (whatever you set in `.env`) |
| Technician | `/backoffice` | `tech@gearandglitch.com` | (whatever you set in `.env`) |
| Customer | `/dashboard` | `customer@gearandglitch.com` | `customer123` (dev only) |

---

## Useful Commands

```bash
npm run dev:all          # Both servers (backend + frontend)
npm run dev              # Backend only with auto-restart
npm run build            # Compile TypeScript
npm run typecheck        # Check for type errors

cd frontend
npm run dev              # Frontend only
npm run build            # Production build
```

---

## Troubleshooting

**"Password authentication failed"**
Your `.env` `DATABASE_URL` password doesn't match your PostgreSQL superuser password. Open pgAdmin → right-click server → Properties to check.

**"Database laptop_sale does not exist"**
Run `CREATE DATABASE laptop_sale;` in pgAdmin or SQL Shell.

**"listen address 127.0.0.1:5432 ... connection refused"**
PostgreSQL service isn't running. Open Windows Services (`services.msc`) and start `postgresql-x64-15` (version number may vary).

**Port 8020 already in use**
Kill the existing process or change `PORT` in `.env`.

**Port 3000 already in use**
Kill the existing process or change the port in `frontend/next.config.js`.
