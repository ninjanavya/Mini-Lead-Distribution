# Mini Lead Distribution System

A production-grade lead distribution system built with Next.js 15, TypeScript, PostgreSQL, Prisma, and shadcn/ui.

## Architecture Highlights

- **Concurrency-Safe Allocation**: Uses PostgreSQL transactions with `SELECT ... FOR UPDATE` row-level locking
- **Persistent Round-Robin**: Fair distribution state stored in database, never in memory
- **Webhook Idempotency**: Duplicate events tracked via `webhook_events` table
- **Database-Level Validation**: `UNIQUE(phone, service_id)` prevents duplicate leads
- **Real-Time Dashboard**: Auto-polling every 3 seconds for live updates

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui |

## Prerequisites

- **Node.js** 18+
- **PostgreSQL** running locally (or remote)
- **npm**

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Database

Edit `.env` with your PostgreSQL connection string:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lead_distribution?schema=public"
```

### 3. Create Database

Create the `lead_distribution` database in PostgreSQL:

```sql
CREATE DATABASE lead_distribution;
```

### 4. Generate Prisma Client, Push Schema & Seed

```bash
npm run setup
```

This runs:
- `prisma generate` — Generates the Prisma client
- `prisma db push` — Pushes schema to database
- `seed.ts` — Seeds services, providers, rules, and round-robin state

### 5. Start Development Server

```bash
npm run dev
```

Visit: [http://localhost:3000](http://localhost:3000)

## Routes

| Route | Description |
|-------|------------|
| `/` | Home page with navigation |
| `/request-service` | Lead submission form |
| `/dashboard` | Provider dashboard (real-time) |
| `/test-tools` | Testing tools (concurrent, webhook, quota) |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/services` | List available services |
| `POST` | `/api/leads` | Create lead & allocate providers |
| `GET` | `/api/dashboard` | Dashboard data |
| `POST` | `/api/webhooks/reset-quota` | Idempotent webhook for quota reset |
| `POST` | `/api/test/concurrent` | Generate 10 concurrent leads |

## Database Schema

```
services             providers            leads
├── id (PK)          ├── id (PK)          ├── id (PK)
├── name (UNIQUE)    ├── name (UNIQUE)    ├── name
└── created_at       ├── monthly_quota    ├── phone
                     ├── used_quota       ├── city
                     └── created_at       ├── service_id (FK)
                                          ├── description
lead_assignments     round_robin_state    └── UNIQUE(phone, service_id)
├── id (PK)          ├── id (PK)
├── lead_id (FK)     ├── service_id (FK, UNIQUE)
├── provider_id (FK) ├── last_index       webhook_events
├── created_at       └── updated_at       ├── id (PK)
└── UNIQUE(lead_id,                       ├── event_id (UNIQUE)
    provider_id)                          ├── type
                                          ├── processed
                                          └── created_at
```

## Allocation Rules

Every lead is assigned to **exactly 3 providers**:

| Service | Mandatory | Additional Pool |
|---------|-----------|----------------|
| Service 1 | Provider 1 | P2, P3, P4 (pick 2) |
| Service 2 | Provider 5 | P6, P7, P8 (pick 2) |
| Service 3 | P1 + P4 | P2, P3, P5, P6, P7, P8 (pick 1) |

## Concurrency Safety

The allocation engine runs inside a single PostgreSQL transaction with:

1. `SELECT ... FOR UPDATE` locks on provider rows
2. `SELECT ... FOR UPDATE` locks on round-robin state
3. Atomic quota increment (`used_quota = used_quota + 1`)
4. Serializable isolation level
5. 15-second transaction timeout

## Available Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run setup        # Full DB setup (generate + push + seed)
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to DB
npm run db:seed      # Run seed script
npm run db:reset     # Reset database (destructive!)
npm run db:studio    # Open Prisma Studio
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── leads/route.ts           # Lead creation + allocation
│   │   ├── dashboard/route.ts       # Dashboard data
│   │   ├── services/route.ts        # Service listing
│   │   ├── webhooks/reset-quota/    # Idempotent webhook
│   │   └── test/concurrent/         # Concurrency test
│   ├── dashboard/page.tsx           # Dashboard page
│   ├── request-service/page.tsx     # Lead form
│   ├── test-tools/page.tsx          # Test tools
│   ├── layout.tsx                   # Root layout
│   └── page.tsx                     # Home page
├── components/ui/                   # shadcn/ui components
├── hooks/
│   └── usePolling.ts                # Real-time polling hook
├── lib/
│   └── prisma.ts                    # Prisma singleton
├── services/
│   ├── allocation.ts                # Core allocation engine
│   ├── dashboard.ts                 # Dashboard queries
│   ├── lead.ts                      # Lead creation service
│   └── webhook.ts                   # Webhook processing
└── types/
    └── index.ts                     # TypeScript types
prisma/
├── schema.prisma                    # Database schema
└── seed.ts                          # Seed script
```

## Engineering Decisions

1. **Serializable Isolation**: Prevents phantom reads during concurrent allocation
2. **Raw SQL for Locking**: Prisma doesn't support `FOR UPDATE`, so raw queries are used inside interactive transactions
3. **Persistent Round-Robin**: Index stored in DB and locked during selection
4. **Batch Transactions for Webhooks**: Event recording + quota reset in single transaction
5. **Database-Level Constraints**: All uniqueness rules enforced at schema level, not application level
