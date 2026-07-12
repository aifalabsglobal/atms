# AIMSCS — Smart Campus Management System

Attendance tracking and Learning Management for AIMSCS.

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

**One-command demo prep:**

```bash
npm run demo:prep
npm run dev
```

**Share with anyone:** open `/login` and click **Copy demo kit for anyone** — copies the URL, password, and all role logins in one paste.

**Presenter:** click **Copy 5-min demo script** on the login page, or use the in-app **Demo mode** banner after login.

| Role | Email |
|------|-------|
| Super Admin | `vice.chancellor@aimscs.ac.in` |
| Admin | `registrar@aimscs.ac.in` |
| HOD (CSE) | `hod.cse@aimscs.ac.in` |
| Faculty | `faculty.venkat@aimscs.ac.in` |
| Lab Assistant | `lab.ravi@aimscs.ac.in` |
| Student | `student.ravi@aimscs.ac.in` |
| Parent | `parent.rajesh@aimscs.ac.in` |
| Visitor | `visitor.john@aimscs.ac.in` |
| Security | `security.murthy@aimscs.ac.in` |

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
| `npm run demo:prep` | Push schema + seed demo data (run before demos) |
| `npm run db:seed` | Seed demo data only |
| `npm run seed:synthetic` | Add 50+ synthetic students, attendance history, grades (run after seed) |
| `npm run lint` | ESLint |
| `npm run smoke` | Full API smoke tests (requires running server + DB) |
| `npm run smoke:quick` | Fast smoke (health + login + dashboard, ~30s) |
| `npm run test:roles` | Role-based API access tests |

## Enterprise features

| Feature | Description |
|---------|-------------|
| **Audit logging** | Login, user CRUD, violation reviews, geofence creation — view in Settings → Audit Log (admin only) |
| **Condonation requests** | Role-wise request → HOD/Admin decide → **Cleared for term** (raw % unchanged). Proof upload (image/PDF), year-scoped clearance, exam-eligibility messaging, audit + anchor. Demo: `student.divya@aimscs.ac.in` / `demo123` or `npm run db:seed:condonation-demo`. |
| **User management** | Create users, suspend/activate, reset passwords with scoped RBAC (admin / HOD) |
| **Global search** | Header search across users, courses, and attendance sessions (role-scoped) |
| **Rate limiting** | Upstash Redis when `UPSTASH_REDIS_*` set; auth, coding, and demo routes protected |
| **Health check** | `GET /api/health` — DB ping, no auth (Docker/load balancer ready) |
| **Security headers** | HSTS, CSP, X-Frame-Options via `next.config.ts` + middleware |
| **Email** | Resend or SMTP — auto-sends welcome/reset emails on user CRUD |
| **Migrations** | Versioned schema in `prisma/migrations/` |
| **CI** | GitHub Actions: typecheck + build + Postgres integration + role tests |

### Deploy — Vercel

1. Import repo on [Vercel](https://vercel.com)
2. Set env vars from `.env.example` (`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, optional Upstash/Resend)
3. Build command (Vercel project settings or `vercel.json`):

   ```bash
   npx prisma migrate deploy && npm run build
   ```

4. Set `NEXTAUTH_URL` to your production domain (e.g. `https://scms.aimscs.ac.in`)

### Deploy — Docker

```bash
cp .env.example .env   # configure DATABASE_URL etc.
docker compose up --build
```

Runs app on port 3000 with a local Postgres container, or point `DATABASE_URL` at Neon.

### Production checklist

1. Set a strong `NEXTAUTH_SECRET` (32+ random bytes) — app **refuses to start** in production with the dev default
2. Use Neon **production** plan (avoid cold-start latency) or self-hosted Postgres with connection pooling
3. `npm run db:baseline` (if upgrading from `db:push`), then `npm run db:migrate:deploy`
4. Add **Upstash Redis** for multi-instance rate limiting (`UPSTASH_REDIS_*`), or `ALLOW_IN_MEMORY_RATE_LIMIT=true` for single-instance Docker only
5. Add **Resend** or **SMTP** for user onboarding emails
6. Verify `GET /api/health` returns `{ status: "ok" }` (used by Docker/load balancers)
7. Optional: `FACE_VERIFICATION_ENABLED=true` + `FACE_VERIFICATION_API_URL` for real ArcFace
8. Replace demo credentials; use hashed passwords via user create/reset APIs
9. **Coding judge** uses Node `vm` — suitable for trusted campus users only; use an isolated runner (Judge0/Piston) for untrusted code

## Performance tips

Remote Neon DB adds ~1–2s per query from India. For faster local dev:

```bash
docker compose up db -d   # local Postgres on :5432
# Point DATABASE_URL at postgresql://scms:scms@localhost:5432/scms?sslmode=disable
npm run demo:prep && npm run dev
```

The app now caches session tokens for 5 minutes and reduces background API polling.

## Notes

- Face verification: **stub** by default; enable with `FACE_VERIFICATION_ENABLED` + external API URL.
- Geofence validation supports **circle** and **polygon** zones.
- After schema or seed changes, sign out and back in to refresh JWT claims.
