# DesiPartyHub

The premier marketplace for discovering and booking Indian celebration vendors across the US — weddings, engagements, mehndi nights, garba, and more.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/desipartyhub run dev` — run the frontend (port 25018)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — cookie session secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + TanStack Query + wouter (routing)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → React Query hooks + Zod schemas)
- Build: esbuild (CJS bundle)
- Fonts: Plus Jakarta Sans (body) + Playfair Display (headings, serif)

## Where things live

- `artifacts/desipartyhub/` — React + Vite frontend
  - `src/pages/` — all page components (home, vendors, vendor-detail, categories, favorites, checklist, budget, bookings, login, register, admin, profile)
  - `src/components/layout/` — Layout, header, footer
  - `src/components/ui/` — shadcn/ui components + custom VendorCard
  - `src/index.css` — theme (saffron/jewel tones CSS variables)
- `artifacts/api-server/src/routes/` — all Express routes
  - `auth.ts` — login, register, logout, /me
  - `vendors.ts` — list, detail, CRUD, featured, cities
  - `reviews.ts` — per-vendor reviews
  - `bookings.ts` — booking inquiries
  - `favorites.ts` — user favorites
  - `checklist.ts` — event checklist
  - `budget.ts` — budget planner
  - `stats.ts` — homepage stats, cities
  - `admin.ts` — admin dashboard data
- `lib/db/src/schema/` — Drizzle schema files (users, vendors, categories, reviews, bookings, favorites, checklist, budget, sessions)
- `lib/api-spec/openapi.yaml` — source-of-truth OpenAPI spec
- `lib/api-client-react/src/generated/` — generated React Query hooks + Zod schemas (do not edit)

## Architecture decisions

- **Cookie-based sessions**: auth uses HTTP-only cookies + sessions table. SHA256 + salt for password hashing (no bcrypt dependency).
- **API-first with codegen**: OpenAPI spec drives generated React Query hooks; frontend uses these exclusively for type-safe data fetching.
- **`inArray()` for multi-ID queries**: Drizzle's `sql\`id = ANY(...)\`` breaks with array bind params — always use `inArray(table.col, ids)` instead.
- **Null vs undefined in query params**: Pass `undefined` (not `null`) for absent filter params to avoid the string "null" being sent to the server.
- **Vite proxy not needed**: The shared Replit reverse proxy routes `/api` to port 8080 and `/` to port 25018 automatically.

## Product

- **Vendor Discovery**: 25 vendors across 18 categories (venues, caterers, DJs, photographers, decorators, mehndi artists, priests, etc.). Filter by category, city, keyword.
- **Vendor Profiles**: Full-page profiles with hero image, about section, reviews, pricing, and inquiry form.
- **Booking Inquiries**: Users can send event details and contact info to any vendor.
- **Favorites**: Save vendors to a personal favorites list.
- **Event Checklist**: Personal task tracker for wedding planning.
- **Budget Planner**: Track event expenses by category.
- **Auth**: Cookie-based login/register with role-based access (admin vs user).
- **Admin Dashboard**: View all vendors, bookings, and user stats.

## Seed Credentials

- Admin: `admin@desipartyhub.com` / `admin123`
- Test user 1: `priya@test.com` / `test123`
- Test user 2: `raj@test.com` / `test123`

## Gotchas

- **Never use `console.log` in server code** — use `req.log` in route handlers and `logger` singleton elsewhere.
- **`zod` must be in `dependencies`** (not devDependencies) in `api-server/package.json` AND externalized in `build.mjs` — esbuild can't bundle `zod/v4` subpath.
- **`inArray()` not `sql\`id = ANY(...)\``** — Drizzle passes array bind params incorrectly with the raw SQL approach.
- **Category filter uses slug string** (e.g. "venues"), not numeric ID — the vendor filter select uses category slug as value.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
