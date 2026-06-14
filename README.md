# JNTUH SCMS — Smart Campus Management System

Attendance tracking and Learning Management for JNTUH Engineering College.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **PostgreSQL** (Neon) via Prisma 6
- **next-auth** (credentials) + role-based API scoping
- Tailwind CSS + shadcn/ui + Zustand + React Query

## Prerequisites

- Node.js 20+
- PostgreSQL database (e.g. [Neon](https://neon.tech))

## Setup

1. **Clone and install**

   ```bash
   npm install
   ```

2. **Environment** — copy `.env.example` to `.env` and fill in values.

3. **Database** (new project)

   ```bash
   npm run db:migrate:deploy
   npm run db:seed
   ```

   If the DB was previously synced with `db:push`, baseline once then use migrations:

   ```bash
   npm run db:baseline
   npm run db:migrate:deploy
   ```

   Dev-only quick sync (no migration history):

   ```bash
   npm run db:push
   npm run db:seed
   ```

4. **Run dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000)

## Demo accounts

Password for all demo users: **`demo123`**

| Role | Email |
|------|-------|
| Super Admin | `vice.chancellor@jntuh.ac.in` |
| Admin | `registrar@jntuh.ac.in` |
| HOD (CSE) | `hod.cse@jntuh.ac.in` |
| Faculty | `faculty.venkat@jntuh.ac.in` |
| Lab Assistant | `lab.ravi@jntuh.ac.in` |
| Student | `student.ravi@jntuh.ac.in` |
| Parent | `parent.rajesh@jntuh.ac.in` |
| Visitor | `visitor.john@jntuh.ac.in` |
| Security | `security.murthy@jntuh.ac.in` |

## Roles & access

Each role sees only permitted sidebar sections. APIs enforce the same scope server-side:

- **Students / parents** — personal attendance, enrolled courses, ward reports
- **Faculty** — own courses, sessions, and enrolled students
- **HOD** — department-scoped dashboard, users, violations, sessions
- **Admin / super admin** — campus-wide access + masters management

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run typecheck` | TypeScript check |
| `npm run db:push` | Sync Prisma schema to DB (dev) |
| `npm run db:migrate` | Create/apply migrations (dev) |
| `npm run db:migrate:deploy` | Apply migrations (production/CI) |
| `npm run db:baseline` | Mark init migration applied on existing DB |
| `npm run db:seed` | Seed demo data |
| `npm run lint` | ESLint |
| `npm run smoke` | API smoke tests (requires running server + DB) |
| `npm run test:roles` | Role-based API access tests |

## Enterprise features

| Feature | Description |
|---------|-------------|
| **Audit logging** | Login, user CRUD, violation reviews, geofence creation — view in Settings → Audit Log (admin only) |
| **User management** | Create users, suspend/activate, reset passwords with scoped RBAC (admin / HOD) |
| **Global search** | Header search across users, courses, and attendance sessions (role-scoped) |
| **Rate limiting** | Upstash Redis when `UPSTASH_REDIS_*` set; in-memory fallback for dev |
| **Email** | Resend or SMTP — auto-sends welcome/reset emails on user CRUD |
| **Migrations** | Versioned schema in `prisma/migrations/` |
| **CI** | GitHub Actions: typecheck + build on push/PR (`.github/workflows/ci.yml`) |

### Deploy — Vercel

1. Import repo on [Vercel](https://vercel.com)
2. Set env vars from `.env.example` (`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, optional Upstash/Resend)
3. Build command (Vercel project settings or `vercel.json`):

   ```bash
   npx prisma migrate deploy && npm run build
   ```

4. Set `NEXTAUTH_URL` to your production domain (e.g. `https://scms.jntuh.ac.in`)

### Deploy — Docker

```bash
cp .env.example .env   # configure DATABASE_URL etc.
docker compose up --build
```

Runs app on port 3000 with a local Postgres container, or point `DATABASE_URL` at Neon.

### Production checklist

1. Set a strong `NEXTAUTH_SECRET` (32+ random bytes)
2. Use Neon **production** plan (avoid cold-start latency)
3. `npm run db:baseline` (if upgrading from `db:push`), then `npm run db:migrate:deploy`
4. Add **Upstash Redis** for multi-instance rate limiting
5. Add **Resend** or **SMTP** for user onboarding emails
6. Optional: `FACE_VERIFICATION_ENABLED=true` + `FACE_VERIFICATION_API_URL` for real ArcFace
7. Replace demo credentials; use hashed passwords via user create/reset APIs

## Notes

- Face verification: **stub** by default; enable with `FACE_VERIFICATION_ENABLED` + external API URL.
- Geofence validation supports **circle** and **polygon** zones.
- After schema or seed changes, sign out and back in to refresh JWT claims.
