# DagrofaShield: git-push-to-deploy (LAN test box)

Redeploys DagrofaShield to `192.168.86.163` on `git push box main`. This is
a **LAN-only test deployment**: no TLS, no external exposure, seed/demo data
only. The automated hook is plain bash + `docker compose` - no AI agent
runs as part of the deploy path itself.

- Frontend: `http://192.168.86.163:3000` (only port opened on the box)
- Backend + Postgres: internal Docker network only, no host port mapping
- nginx (TLS reverse proxy in the base `docker-compose.yml`) is **not**
  started by this deployment

## One-time setup

**0. Verify SSH and Docker access from your local machine first:**

```bash
ssh home@192.168.86.163 'echo ok'                       # must use existing key auth
ssh home@192.168.86.163 'docker ps && docker compose version'
```

If either fails, stop - don't work around it (no password auth, no sudo
prefixing, no SSH config changes). Fix key auth / group membership on the
box first.

**1. Pre-create the `/opt` directories, once, with sudo:**

This deployment lives under `/opt` rather than `home`'s own home directory.
`/opt` is root-owned by default, so `home` needs these three directories
created and handed to it before anything else runs. Nothing past this step
ever calls `sudo` - `setup-box.sh` and the `post-receive` hook both refuse
to run if any of these three don't already exist and aren't writable by
`home`, rather than guessing at how to get access.

```bash
ssh home@192.168.86.163 '
  sudo mkdir -p /opt/dagrofashield.git /opt/dagrofashield-deploy /opt/dagrofashield-secrets
  sudo chown -R home:home /opt/dagrofashield.git /opt/dagrofashield-deploy /opt/dagrofashield-secrets
'
```

**2. Copy this `deploy/` directory to the box and run the setup script:**

```bash
scp -r deploy home@192.168.86.163:~/dagrofashield-setup
ssh home@192.168.86.163 'cd ~/dagrofashield-setup && ./setup-box.sh'
```

`setup-box.sh` (idempotent, safe to re-run):
- Re-checks Docker works without sudo (refuses to proceed and tells you
  exactly what to fix otherwise - it never silently adds `sudo`).
- Creates the bare repo at `/opt/dagrofashield.git` and the deploy worktree at
  `/opt/dagrofashield-deploy` (kept outside the bare repo).
- Generates `/opt/dagrofashield-secrets/.env` (mode 600) with a fresh
  `POSTGRES_PASSWORD` and `JWT_ACCESS_SECRET` (`openssl rand`), only if one
  doesn't already exist - **it will never overwrite/rotate an existing
  secrets file**, so re-running setup never breaks a running database.
  `ENTRA_*` is left blank on purpose: the backend boots with Entra ID/OIDC
  disabled and falls back to the local seeded admin account only (see
  `backend/src/common/config/env.validation.ts` - Entra vars are
  intentionally not required).
- Installs `deploy/post-receive` as `/opt/dagrofashield.git/hooks/post-receive`.

Nothing in this step touches a docker volume, and the generated secrets are
never printed to the terminal.

**3. Add the remote and do the first deploy, from your local machine:**

```bash
git remote add box ssh://home@192.168.86.163/opt/dagrofashield.git
git push box main
```

The hook (`deploy/post-receive`, see below for exactly what it does) builds,
tests, and - only if that passes - starts the stack and applies the Prisma
migration that ships in this repo (`backend/prisma/migrations/`).

**4. Seed demo data (one-time, manual, not part of the automated hook):**

There is no "seed on deploy" flag in this codebase - `prisma/seed.ts` mostly
uses `.create()`, not `.upsert()` (risks, assessments, controls, control
tests, evidence), so running it on every push would duplicate demo data
indefinitely. It's meant to run once:

```bash
ssh home@192.168.86.163 \
  'cd /opt/dagrofashield-deploy && docker compose --env-file /opt/dagrofashield-secrets/.env -f docker-compose.yml -f docker-compose.override.yml exec -T backend npm run prisma:seed'
```

This seeds org units, categories, example users, ~15 example risks,
assessments, the control library, control tests (incl. one Fail with
evidence), and three example compliance frameworks. It prints the seeded
account emails; **every seeded account shares the password
`DagrofaShield2026!`** (from `backend/prisma/seed.ts` - already public in
this repo, not a secret this setup generated). Sign in as
`admin@dagrofa.dk`. Rotate these before the box holds anything real.

**5. Verify:**

```bash
ssh home@192.168.86.163 'curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000'
ssh home@192.168.86.163 \
  'docker compose --env-file /opt/dagrofashield-secrets/.env -f /opt/dagrofashield-deploy/docker-compose.yml -f /opt/dagrofashield-deploy/docker-compose.override.yml -p dagrofashield-deploy ps'
tail -f /opt/dagrofashield-deploy/deploy.log   # (on the box)
```

- `curl` should print `200`.
- From any other device on the LAN: `http://192.168.86.163:3000` should load.
- `docker compose ps` should show `postgres` and `backend` with **no**
  `0.0.0.0:xxxx->` host port entries, and `frontend` with `0.0.0.0:3000->3000`.
- `deploy.log` should have a `DEPLOY SUCCEEDED` entry for your push.

## Everyday deploys

```bash
git push box main
```

That's it. Watch the push output - a failed build or test prints
`DEPLOY FAILED: ...` and a non-zero exit, and **whatever was already
running is left completely untouched**. Full output (not just the summary
line) is in `/opt/dagrofashield-deploy/deploy.log` on the box.

New Prisma migration in this repo? It's applied automatically
(`prisma migrate deploy`, non-interactive/production-safe) after `up -d` on
every push that includes one - nothing extra to run.

## What the hook actually does (`deploy/post-receive`)

On a push to `main`:

1. `git checkout -f <new commit>` into `/opt/dagrofashield-deploy`.
2. `docker build --target build ./backend` (the Dockerfile's intermediate
   stage - has source + devDependencies, unlike the slim runtime image) and
   `npm test` in it - the backend's Jest **unit** suite (scoring logic, RBAC
   guards/org-unit scoping; no database required, ~8s). Then
   `docker compose build backend frontend` (this also fails the deploy if
   `next build` fails, i.e. the frontend's own build is its test gate - it
   has no dedicated test script). If any of this fails: log it, exit
   non-zero, stop - `up -d` is never called, so nothing running is touched.

   The backend also ships integration tests (`npm run test:e2e`) that
   exercise real HTTP flows end-to-end, but they need a real disposable
   Postgres database (see the main `README.md` "Running the tests"
   section) - deliberately **not** wired into this hook to keep it fast and
   dependency-free. Add them to the hook yourself if you want that stronger
   gate; note they'd need their own throwaway database, separate from the
   one this deployment runs.

3. Only once tests pass: (re)writes `docker-compose.override.yml` (never
   committed to git - regenerated fresh every deploy, see the `.example`
   file in this directory for what it contains and why), then
   `docker compose up -d postgres backend frontend` (nginx is never
   started), then `prisma migrate deploy` in the backend container.
4. Appends a timestamped entry to `deploy.log` either way.

Every `docker compose` call the hook makes uses
`--env-file /opt/dagrofashield-secrets/.env` - the base `docker-compose.yml`
already reads `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `FRONTEND_ORIGIN`,
etc. via `${VAR}` interpolation, so this is what actually gets the step-2
secrets into the containers (an `env_file:` block in the override would
only inject vars into the container's own runtime environment - it
wouldn't participate in that `${VAR}` interpolation at all).

Never run by the hook, on success or failure: `docker compose down`,
`docker system prune`, or anything with `-v` - `postgres_data` and
`evidence_data` are never touched.

## Operations

```bash
ssh home@192.168.86.163
cd /opt/dagrofashield-deploy

# live logs
docker compose --env-file /opt/dagrofashield-secrets/.env -f docker-compose.yml -f docker-compose.override.yml logs -f

# tear the stack down (containers only - named volumes survive `down` without -v)
docker compose --env-file /opt/dagrofashield-secrets/.env -f docker-compose.yml -f docker-compose.override.yml down

# deploy history
cat deploy.log
```

## Note on the initial Prisma migration

The app's own `README.md` documents generating `backend/prisma/migrations/`
as an interactive first-deploy step (`prisma migrate dev --name init`,
committed afterward). A non-interactive push-to-deploy hook can't run that
safely, so this change generates and commits that initial migration
directly (`backend/prisma/migrations/20260908180529_init/`) - the hook
always runs the non-interactive, production-safe `prisma migrate deploy`.
