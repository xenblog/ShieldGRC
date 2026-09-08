# DagrofaShield

A self-hosted GRC (Governance, Risk & Compliance) platform for IT security,
information security, and compliance at Dagrofa.

Covers: Overview/Dashboards, Risk Management (Risk Register + Risk
Assessment), Controls (Control Library + Control Testing), and Compliance
(Frameworks). AI Governance and Supplier Risk are shown as locked/"coming
later" nav items - see [ARCHITECTURE.md](./ARCHITECTURE.md) for how they plug
in later without a schema rewrite.

## Repository layout

```
dagrofa-shield/
  backend/     NestJS + Prisma REST API
  frontend/    Next.js (App Router) UI
  nginx/       Reverse proxy config (TLS termination)
  docker-compose.yml
  .env.example
  ARCHITECTURE.md
```

## Tech stack

- Backend: NestJS (TypeScript), REST API, Prisma ORM, PostgreSQL 16
- Frontend: Next.js (App Router), React, Tailwind CSS
- Auth: local email/password (seeded dev admin) and/or Entra ID (Azure AD)
  OIDC SSO, behind a common `AuthProvider` abstraction
- Deployment: Docker Compose (frontend, backend, postgres, nginx)

## Important: this environment could not run Node/npm/Docker

This codebase was authored without a working Node.js, npm, or Docker
installation available to verify it end-to-end (no `npm install`, no
`prisma generate`/`migrate`, no `next build`, no `docker compose up`, no test
run were possible in the authoring environment). Everything below has been
written to be internally consistent (schema field names, DTO shapes, API
routes, and the frontend's calls to them all cross-checked by hand), but you
should treat the **first deploy below as also being the first real
build/compile** of this project, and budget time to fix any dependency
version hiccups Prisma/NestJS/Next.js releases may have introduced since
this was written.

## Prerequisites (Linux deployment target)

- Ubuntu/Debian VM (or similar), with:
  - Docker Engine + Docker Compose plugin (`docker compose version` works)
  - A domain name pointed at the VM, and a TLS certificate for it (e.g. from
    Let's Encrypt / certbot) if you want HTTPS from day one - see step 4.

## First deploy

1. **Clone the repo onto the VM** and `cd` into it.

2. **Create your `.env`:**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set at minimum:
   - `POSTGRES_PASSWORD` - a long random value
   - `JWT_ACCESS_SECRET` - `openssl rand -base64 48`
   - `FRONTEND_ORIGIN` - your public https URL (e.g. `https://shield.dagrofa.dk`)

   Leave the `ENTRA_*` variables blank to run with local-account login only
   (a seeded local admin - see step 6). Fill them in once you've registered
   an Entra ID app (Azure Portal → Entra ID → App registrations) - the
   redirect URI must be `https://<your-domain>/api/auth/entra/callback`.

3. **TLS certificate for nginx:**

   Put your certificate and key at `nginx/certs/fullchain.pem` and
   `nginx/certs/privkey.pem` (this path is bind-mounted read-only into the
   nginx container - see `docker-compose.yml`). For a quick first boot
   without a real certificate yet, generate a self-signed one so nginx has
   something to load (replace with a real cert - e.g. via certbot - before
   going live):

   ```bash
   mkdir -p nginx/certs
   openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
     -keyout nginx/certs/privkey.pem -out nginx/certs/fullchain.pem \
     -subj "/CN=localhost"
   ```

4. **Build and start everything:**

   ```bash
   docker compose up -d --build
   ```

5. **Run the initial Prisma migration.** This repo intentionally does not
   ship a pre-baked `prisma/migrations` folder (it was authored without a
   database available to generate one against) - the first deploy creates
   it:

   ```bash
   docker compose exec backend npx prisma migrate dev --name init
   ```

   This both creates the migration SQL (committed at
   `backend/prisma/migrations/`) and applies it. **Commit the generated
   `backend/prisma/migrations/` folder to git** so subsequent deploys can use
   the non-interactive, production-safe command instead:

   ```bash
   docker compose exec backend npx prisma migrate deploy
   ```

6. **Seed initial data** (org units, categories, example users, ~15 example
   risks, assessments, the control library, control tests incl. one Fail
   with evidence, and the three example compliance frameworks):

   ```bash
   docker compose exec backend npm run prisma:seed
   ```

   The seed script prints the seeded local account emails. All seeded local
   accounts share one password: `DagrofaShield2026!` (see
   `backend/prisma/seed.ts`). **Rotate every seeded password (or disable
   local login for those accounts once Entra ID SSO is confirmed working)
   before this instance holds anything real.**

7. Visit `https://<your-domain>/` and sign in as `admin@dagrofa.dk` with the
   seed password above.

## Everyday operations

### Applying a new migration after a schema change

```bash
# on a dev machine with a local Postgres, generate the migration:
cd backend && npx prisma migrate dev --name <description>
# commit the new backend/prisma/migrations/<timestamp>_<description> folder
# then on the server:
docker compose exec backend npx prisma migrate deploy
```

### Restarting after a code change

```bash
git pull
docker compose up -d --build
docker compose exec backend npx prisma migrate deploy
```

### Backups

Two things need backing up: the Postgres database and the evidence-upload
volume (control-test evidence files live on disk, not in the database - see
`backend/src/common/evidence/evidence-storage.util.ts`).

**Postgres backup** (logical dump, safe to run while the stack is up):

```bash
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > backup-$(date +%Y%m%d-%H%M%S).sql.gz
```

Restore into a fresh `postgres_data` volume:

```bash
gunzip -c backup-20260101-020000.sql.gz \
  | docker compose exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

**Evidence volume backup** (the `evidence_data` named volume mounted at
`/data/evidence` in the backend container):

```bash
docker run --rm \
  -v dagrofa-shield_evidence_data:/data/evidence:ro \
  -v "$(pwd)":/backup \
  alpine tar czf /backup/evidence-backup-$(date +%Y%m%d-%H%M%S).tar.gz -C / data/evidence
```

(Adjust the volume name prefix if your Compose project name differs - check
with `docker volume ls`.) Restore by extracting the tarball back into a fresh
`evidence_data` volume the same way, in reverse.

Schedule both of the above via cron for regular backups; keep at least one
copy off the VM.

## Running the tests

Backend unit tests (scoring logic, RBAC guards/org-unit scoping - no
database required):

```bash
cd backend
npm install
npm test
```

Backend integration tests (exercise the main API flows for every module
end-to-end over HTTP, including RBAC/org-unit-scoping boundaries, live risk
scoring, assessment progress auto-computation, control-test evidence upload
with an allowlist/size cap, and framework coverage computation). These need
a **real, disposable Postgres database** - point `DATABASE_URL` at one you
don't mind being wiped, e.g.:

```bash
docker run -d --name dgs-test-db -p 5433:5432 \
  -e POSTGRES_PASSWORD=test -e POSTGRES_DB=dagrofashield_test postgres:16-alpine
export DATABASE_URL="postgresql://postgres:test@localhost:5433/dagrofashield_test"
cd backend
npx prisma migrate deploy   # or `migrate dev` if migrations don't exist yet
npm run test:e2e
```

The e2e suite also writes small sample evidence files under
`backend/data/evidence/` as a side effect of testing file upload - safe to
delete afterward, already `.gitignore`d.

## Local development (without Docker)

```bash
# once, and again whenever backend/prisma/schema.prisma changes:
cd backend && npm install && npx prisma generate

# start a local Postgres however you like, then:
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dagrofashield"
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev        # backend on :4000

# in a second terminal:
cd frontend && npm install
npm run dev               # frontend on :3000, proxies /api/* to :4000 (see next.config.js)
```

No Entra ID configuration is required for local dev - log in with the
seeded local admin account.

## Security-relevant defaults worth knowing about

- Helmet default headers + nginx-level HSTS/X-Frame-Options/etc.
- Rate limiting globally (300 req/min/IP) and tightened further on the login
  endpoints specifically (5-10 req/min).
- Access tokens are short-lived JWTs kept in memory on the frontend only
  (never localStorage); refresh tokens are httpOnly, rotated on every use,
  and revocable server-side.
- Evidence files: extension + MIME allowlist, 25MB per file cap, stored on
  disk behind the backend (never served directly by nginx), access
  re-checked per request against the requester's org-unit scope.
- See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full RBAC/org-unit
  scoping model and the audit log design.
