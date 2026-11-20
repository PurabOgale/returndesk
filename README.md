# ReturnDesk

A full-stack returns and replacements support desk built with **Next.js (App Router)**, **TypeScript**, **PostgreSQL (`pg` / raw SQL)**, and **Tailwind CSS**.

> **Live Deployment:** _Pending deployment — see [Deploying to Vercel & Neon/Supabase](#deploying-to-vercel--neonsupabase) below._

---

## Architecture & Design Decisions

### 1. Why Raw SQL (`pg`) Instead of an ORM
- **Explicit SQL & Query Control:** Server-side search (`ILIKE`), status/reason filtering, allowlisted sorting, and `LIMIT`/`OFFSET` pagination are written directly in parameterized SQL (`src/lib/requests-service.ts`).
- **Database-Level Constraint Enforcement:** Business rules are enforced at **both** the application layer (`src/lib/domain.ts`) and the PostgreSQL schema layer (`src/db/schema.sql`):
  - **Rule 2 (Approval Resolution & Refund Amount):** Enforced via `chk_approval_resolution` and `chk_refund_amount` `CHECK` constraints so invalid states cannot exist even via direct SQL.
  - **Rule 3 (One Live Request Per Item):** Enforced via a **partial unique index**:
    ```sql
    CREATE UNIQUE INDEX idx_one_live_request_per_order_item
      ON return_requests (LOWER(TRIM(order_number)), LOWER(TRIM(item_sku)))
      WHERE status IN ('Open', 'In Review', 'Approved') AND removed_at IS NULL;
    ```
    This prevents race-condition duplicates at the database level while automatically allowing a new request once an earlier one is `Rejected`, `Completed`, or removed.
  - **Concurrency-Safe Human-Readable References:** `return_request_ref_seq` generates sequential references (`RET-2026-0001`, `RET-2026-0002`, ...) inside transactions without client input.
  - **Soft Removal (Rule 5):** `removed_at TIMESTAMPTZ NULL` hides removed requests from `GET /api/requests` and `GET /api/requests/[id]` (`404`) while preserving every record and note in PostgreSQL (`ON DELETE RESTRICT` on `return_notes`).

### 2. Centralized Business Rule Engine & Error Semantics
All 5 business rules live in `src/lib/domain.ts` and `src/lib/requests-service.ts`—never duplicated across route handlers:
1. **Status Flow:** `Open -> In Review -> Approved | Rejected`, `Approved -> Completed`. `Rejected` and `Completed` are final. Illegal transitions return `409 Conflict` (`INVALID_STATUS_TRANSITION`).
2. **Approval Resolution:** Approving requires `Refund`, `Replacement`, or `Store Credit`. `Refund` requires `refundAmount > 0`; other resolutions forbid `refundAmount`. Violations return `422 Unprocessable Entity`.
3. **One Live Request Per Order + Item:** Duplicate live requests return `409 Conflict` (`DUPLICATE_LIVE_REQUEST`).
4. **Locked Once Decided:** Editing `Approved`, `Rejected`, or `Completed` requests via `PATCH` returns `409 Conflict` (`REQUEST_LOCKED`). Notes remain appendable at any status.
5. **Removal:** Only `Open` or `Rejected` requests may be removed via `DELETE`. Removing `In Review`, `Approved`, or `Completed` returns `409 Conflict` (`REMOVAL_NOT_ALLOWED`).

Every API error returns a consistent JSON envelope:
```json
{
  "error": {
    "code": "INVALID_STATUS_TRANSITION",
    "message": "Cannot transition request from 'Open' to 'Completed'. Legal next statuses: In Review.",
    "details": { "currentStatus": "Open", "targetStatus": "Completed", "allowedTransitions": ["In Review"] }
  }
}
```

### 3. API Endpoints
| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Verifies PostgreSQL connectivity (`SELECT 1`) |
| `GET` | `/api/requests` | Server-side search, status/reason filter, sort, and pagination |
| `POST` | `/api/requests` | Create a new return request (generates `RET-YYYY-XXXX`) |
| `GET` | `/api/requests/[id]` | Fetch single request + chronological notes (`404` if removed) |
| `PATCH` | `/api/requests/[id]` | Edit details (refused with `409` if decided/locked) |
| `DELETE` | `/api/requests/[id]` | Soft-remove request (refused with `409` unless `Open` or `Rejected`) |
| `POST` | `/api/requests/[id]/transition` | Advance status with Rule 1 & Rule 2 enforcement |
| `POST` | `/api/requests/[id]/notes` | Append an immutable note (`201 Created`) |

---

## Setup From a Clean Machine

### Prerequisites
- **Node.js** 18+ (tested on Node 18.20)
- **PostgreSQL** 13+ (local, Docker, Neon, or Supabase)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
```bash
cp .env.example .env
```
Edit `.env` and set `DATABASE_URL` to your PostgreSQL connection string:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/returndesk"
DATABASE_SSL="false"
```

### 3. Run Database Migration & Seed Script
This creates all tables, constraints, indexes, and seeds **35 return requests** across all 5 statuses, all 5 reasons, all 3 resolutions, and chronological notes:
```bash
npm run db:setup
```
To wipe and re-seed from scratch later:
```bash
npm run db:seed -- --reset
```

### 4. Run Unit Tests & Start Development Server
```bash
npm test
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## Deploying to Vercel & Neon/Supabase

1. Push this repository (including its git commit history) to GitHub:
   ```bash
   git remote add origin https://github.com/<your-username>/returndesk.git
   git push -u origin main
   ```
2. Create a free PostgreSQL database on **Neon** or **Supabase** and copy its connection string (`?sslmode=require`).
3. Run `DATABASE_URL="<your-cloud-url>" npm run db:setup` locally once to create the schema and load the 35 seed requests.
4. Import the GitHub repository in **Vercel**, add `DATABASE_URL` (and `DATABASE_SSL="true"` if needed) in **Project Settings -> Environment Variables**, and deploy.

---

## Assumptions & Notes
- **Contact Fields:** A request requires at least one of `customerEmail` or `customerPhone` (enforced by both API validation and `chk_customer_contact`).
- **Currency:** `refund_amount` is stored as `NUMERIC(10, 2)` and displayed in USD (`$`).
- **Time Spent:** ~4 hours focused on PostgreSQL schema design, server-side business rule enforcement, API error semantics, seed data, and responsive App Router UI.
