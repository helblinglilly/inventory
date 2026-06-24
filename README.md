# Inventory

Bare-bones home inventory app built with Next.js, TypeScript, Tailwind, Turso, Drizzle, Better Auth, and Vercel Blob.

## What is in place

- Email/password authentication wired through Better Auth.
- Turso-ready Drizzle schema for auth, rooms, places, and items.
- Server-backed inventory reads and writes with immediate refresh after changes.
- Room and place navigation, search, low-stock dashboard, and quick stock +/- actions.
- Optional image upload route prepared for Vercel Blob and an external image proxy.

## Environment

Copy `.env.example` to `.env.local` and fill in the real values when ready:

```bash
cp .env.example .env.local
```

Variables:

- `BETTER_AUTH_SECRET`: random secret for Better Auth.
- `BETTER_AUTH_URL`: app base URL, for example `http://localhost:3000` locally.
- `TURSO_DATABASE_URL`: Turso URL. Defaults to `file:local.db` for local fallback.
- `TURSO_AUTH_TOKEN`: Turso auth token.
- `BLOB_READ_WRITE_TOKEN`: Vercel Blob token for image uploads.
- `IMAGE_PROXY_BASE_URL`: optional proxy endpoint. The app appends `?url=<blob-url>`.

## Local development

Install and run:

```bash
npm install
npm run db:migrate
npm run dev
```

Then open <http://localhost:3000>.

## Database commands

```bash
npm run auth:generate
npm run db:generate
npm run db:migrate
npm run db:studio
```

Notes:

- `auth:generate` refreshes `src/db/auth-schema.ts` from the Better Auth config.
- `db:generate` creates SQL migrations in `drizzle/`.
- `db:migrate` applies those migrations to the configured Turso or local libsql database.

## Deploying to Vercel

1. Import the GitHub repo into Vercel.
2. Add the environment variables above in the Vercel project.
3. Provision Turso and set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
4. Create a Vercel Blob store and set `BLOB_READ_WRITE_TOKEN`.
5. Run the Drizzle migrations against the production database before first sign-in.

## Next steps

- Wire real Vercel and Turso credentials.
- Decide the final `img.helbling.uk` URL contract if it should be something other than `?url=`.
- Add stronger conflict handling for concurrent edits from multiple sessions.
- Add edit/delete flows, shopping views, and richer image handling.
