# Self-Hosted Static Site Hosting Platform

This repository is a fully working MVP for a self-hosted static hosting platform powered by GitHub, PostgreSQL, Redis, BullMQ, Cloudflare R2, and Cloudflare Workers.

## Monorepo Layout

```text
/
├─ apps/
│  ├─ api/
│  │  ├─ prisma/
│  │  │  └─ schema.prisma
│  │  └─ src/
│  │     ├─ auth.ts
│  │     ├─ db.ts
│  │     ├─ env.ts
│  │     ├─ index.ts
│  │     ├─ middleware.ts
│  │     ├─ queue.ts
│  │     ├─ routes/
│  │     ├─ services/
│  │     └─ worker.ts
│  ├─ web/
│  │  ├─ app/
│  │  ├─ components/
│  │  ├─ lib/
│  │  └─ tailwind.config.ts
│  └─ worker/
│     ├─ src/
│     │  └─ index.ts
│     └─ wrangler.toml
├─ packages/
│  └─ cloudflare-worker/
│     └─ src/
│        ├─ index.ts
│        ├─ mime.ts
│        ├─ resolve.ts
│        └─ router.ts
├─ docker-compose.yml
├─ .env.example
└─ package.json
```

## What Runs Where

- `apps/web` is the dashboard. It handles GitHub OAuth callback completion, repository onboarding, project editing, deployment list views, and log streaming pages.
- `apps/api` is the backend. It owns Prisma, GitHub OAuth exchange, GitHub webhook ingestion, deployment creation, deployment status updates, and the BullMQ worker process.
- `apps/api/src/worker.ts` is the asynchronous build worker. It clones the repository, installs dependencies, runs the build command, uploads artifacts to R2, and updates deployment state.
- `apps/worker` is the Cloudflare Worker edge router. It reads hostnames, resolves them to the latest deployment ID, and serves files from R2 with proper cache and content-type headers.
- `packages/cloudflare-worker` contains shared edge-router helpers.

## Local Prerequisites

- Node.js 20 or newer
- Docker Desktop or Docker Engine
- A GitHub OAuth App
- A GitHub repository webhook secret
- Cloudflare R2 credentials or a local MinIO bucket for testing
- Cloudflare Workers KV namespace and route binding

## Environment Setup

1. Copy `.env.example` to `.env`.
2. Fill in the GitHub OAuth values.
3. Fill in PostgreSQL and Redis connection strings.
4. Fill in the R2 or MinIO credentials.
5. Fill in the Cloudflare API token, account ID, and KV namespace ID.
6. Set `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_ROOT_DOMAIN` for the web app.

## Step 1: GitHub OAuth App

1. Open GitHub Developer Settings.
2. Create a new OAuth App.
3. Set the homepage URL to your dashboard URL.
4. Set the callback URL to:
   `http://localhost:4000/auth/github/callback`
5. Copy the Client ID and Client Secret into `.env`.
6. Make sure the app has access to the repositories you want to deploy.

The backend uses the OAuth code exchange directly and stores the GitHub access token on the `User` record.

## Step 2: GitHub Webhooks

Each project gets a unique webhook secret.

1. Create a project from the dashboard.
2. Copy the generated webhook secret from the project record in the database or from your admin tooling if you add one.
3. In the GitHub repository, create a webhook.
4. Set the payload URL to:
   `http://localhost:4000/webhooks/github`
5. Set content type to `application/json`.
6. Set the secret to the project webhook secret.
7. Subscribe to the `push` event.

When a push arrives:

- The API verifies the `X-Hub-Signature-256` HMAC.
- The API creates a `Deployment` row with `pending` status.
- The API enqueues a BullMQ build job.

## Step 3: PostgreSQL and Redis

Start local infrastructure:

```bash
docker compose up -d
```

This starts:

- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`
- MinIO on `localhost:9000` and `localhost:9001`

MinIO is optional and is only for local S3-compatible testing. In production, use Cloudflare R2.

## Step 4: Database Migration

Generate the Prisma client and create the schema:

```bash
npm install
npm run db:generate
npm run db:migrate
```

The Prisma schema includes:

- `User`
- `Project`
- `Deployment`
- `CustomDomain`

Deployment states are:

- `pending`
- `building`
- `ready`
- `failed`

## Step 5: Cloudflare R2

### Production R2

1. Create an R2 bucket in Cloudflare.
2. Create an API token with R2 read/write access.
3. Fill these values in `.env`:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `R2_BUCKET_NAME`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
4. Leave `R2_ENDPOINT` empty for production R2.

### Local MinIO Testing

1. Open the MinIO console at `http://localhost:9001`.
2. Log in with the credentials from `.env.example`.
3. Create a bucket with the same name as `R2_BUCKET_NAME`.
4. Set `R2_ENDPOINT=http://localhost:9000`.
5. Keep the same `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` values that MinIO expects.

The build worker uploads every built file to:

```text
deployments/<deployment_id>/...
```

## Step 6: Cloudflare Worker and KV

The edge router is configured in:

- `apps/worker/wrangler.toml`

It binds:

- `ASSETS` to the R2 bucket
- `DEPLOYMENT_MAP` to a KV namespace

It also defines:

- `EDGE_API_BASE_URL`
- `EDGE_API_SECRET`
- `EDGE_ROOT_DOMAIN`

### KV Mapping Flow

1. The build worker finishes a deployment.
2. The worker updates the database deployment status to `ready`.
3. The worker writes `host:<hostname>` keys into Cloudflare KV.
4. The edge Worker resolves the incoming host to a deployment ID.
5. The Worker serves the requested asset from R2.

## Step 7: Run Locally

Use these commands from the repository root:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

That starts:

- API on `http://localhost:4000`
- Dashboard on `http://localhost:3000`
- BullMQ build worker in the API process group

Then open the dashboard and:

1. Click `Connect GitHub`.
2. Finish the OAuth flow.
3. Pick an accessible repository.
4. Set the build command and output directory.
5. Create the project.
6. Configure the GitHub webhook.
7. Push a commit and watch the log stream.

## Step 8: Deploy to Production

### API

1. Provision a managed PostgreSQL database.
2. Provision Redis.
3. Set all API env vars on the production host.
4. Build and run the API:
   ```bash
   npm run build --workspace apps/api
   npm run dev --workspace apps/api
   ```
   In production, run the compiled server with your process manager of choice.

### Dashboard

1. Deploy `apps/web` to your preferred Node or static hosting platform.
2. Set:
   - `NEXT_PUBLIC_API_BASE_URL`
   - `NEXT_PUBLIC_ROOT_DOMAIN`
3. Point users to the deployed dashboard URL.

### Build Worker

1. Run `apps/api/src/worker.ts` as a separate long-lived process if you do not colocate it with the API.
2. Make sure it can reach Redis, PostgreSQL, GitHub, and R2.

### Edge Worker

1. Create the R2 bucket and KV namespace in Cloudflare.
2. Update `apps/worker/wrangler.toml` with real bucket and namespace IDs.
3. Update the route to your own domain or wildcard subdomain.
4. Deploy:
   ```bash
   cd apps/worker
   npx wrangler deploy
   ```

## Important Behavior

- The worker uses isolated Node child processes for build execution instead of Docker containers, which keeps the MVP portable and easy to run locally.
- Webhook verification uses the GitHub HMAC signature header.
- Deployment logs are stored in the database and streamed through polling/SSE in the dashboard.
- The edge router resolves hostnames using KV first and can fall back to the API if needed.

## Deliverables Covered

- Monorepo structure for `apps/web`, `apps/api`, `apps/worker`, and `packages/cloudflare-worker`
- Complete Prisma schema
- GitHub OAuth flow
- GitHub webhook receiver
- BullMQ build worker
- Cloudflare R2 upload flow
- Cloudflare Worker edge router
- `wrangler.toml`
- `.env.example`
- Infrastructure wiring guide

