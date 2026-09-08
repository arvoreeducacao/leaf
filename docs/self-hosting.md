# Self-hosting Leaf

Everything Leaf needs to know about where it runs comes from the
environment. Nothing here is required to *try* Leaf — `docker compose up` at
the repository root gets you a working instance.

## Running locally

```bash
pnpm install
cp .env.example .env.local   # point DATABASE_URL at a MySQL 8 of your own
pnpm dev
```

`pnpm dev` starts three processes together: Next on `http://localhost:3000`, the
S3 emulator on `4568`, and the collaboration server on `1234`. The migrations in
`drizzle/mysql` run when the app boots. Create an account at `/signup` — there is
no email verification in development — and you are in.

## Tests

```bash
pnpm test        # unit (vitest)
pnpm test:e2e    # Playwright, in its own sandbox (does not disturb the dev server)
```

The tests need a real MySQL — there is no in-memory SQLite any more. Each vitest
worker uses its own database `<LEAF_TEST_DATABASE_URL>_<VITEST_POOL_ID>`
(`leaf_test_1` … `leaf_test_6`, with `maxWorkers: 6`), truncated between suites;
the schema is applied by the migrations on first use.

The E2E suite brings up four isolated environments: the default app on port 3100
(database `leaf_e2e`), one with real-time on 3200 / ws 1235 (database
`leaf_e2e_realtime`), one with `LEAF_ALLOWED_EMAIL_DOMAINS` set on 3300 (project
`restricted`), and one with SSO wired to fake credentials on 3400 (project
`sso`). The first two drop the tables of their database and apply the migrations
before starting the server; the other two reuse the already-prepared `leaf_e2e`
and so prepare nothing. `DATABASE_URL` is injected into the child process, so the
dev `.env.local` is never used by the sandbox.

E2E runs with a single worker (`E2E_WORKERS` changes that). With the database
~150 ms away, each case takes close to 20 s and the whole suite runs past 15
minutes. To run it in pieces, build once
(`LEAF_DIST_DIR=.next-e2e pnpm exec next build`) and then
`pnpm exec playwright test --project=<project> <specs>`.

## Configuration

Leaf speaks S3 and SQL through configuration — deploying is a matter of setting
the environment:

| Variable | Use |
|---|---|
| `DATABASE_URL` | `mysql://user:password@host:3306/leaf` — required; the app will not boot without it |
| `DATABASE_POOL_SIZE` | `mysql2` pool size (default `10`) |
| `S3_ENDPOINT` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Image storage |
| `LEAF_REALTIME` / `LEAF_REALTIME_URL` (`wss://`) / `LEAF_REALTIME_SECRET` | Real-time collaboration (the ws runs as its own process) |
| `BETTER_AUTH_URL` / `BETTER_AUTH_SECRET` | Auth |
| `NEXT_PUBLIC_LEAF_SOURCE_URL` | Where **Source code** in the account menu points. Set it to your fork — the AGPL requires that whoever uses your modified Leaf can get its source |
| `LEAF_ALLOWED_EMAIL_DOMAINS` | Comma-separated list (e.g. `example.com`). Empty or absent = no restriction (development and tests). Set = only those domains can sign up, sign in and receive invitations |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Switch on the sign-in-with-Google button; without both, the button does not appear |
| `LEAF_SSO_CLIENT_ID` / `LEAF_SSO_CLIENT_SECRET` / `LEAF_SSO_ISSUER` | Switch on company SSO over OAuth2/OIDC. With no client id or no issuer the provider is not registered and the screen stays the email-and-password form; with them, password sign-up leaves the screen |
| `LEAF_SSO_PROVIDER_ID` / `LEAF_SSO_PROVIDER_NAME` | The provider id (default `sso`, written to `account.provider_id` — changing it later locks out whoever already signed in) and the name shown on the button (default `SSO`) |
| `LEAF_SSO_AUTHORIZATION_URL` / `LEAF_SSO_TOKEN_URL` / `LEAF_SSO_LOGOUT_URL` | The provider's endpoints. The first two default to `{issuer}/oauth2/authorize` and `{issuer}/oauth2/token`; without the logout one, the switch-account link does not appear |
| `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET` / `NOTION_REDIRECT_URI` | Switch on the Notion import by link; without them the path is off and the dialog says so. In production the redirect is `https://<your-host>/api/notion/callback` |
| `NOTION_API_VERSION` | The Notion API version in the `Notion-Version` header (default `2025-09-03`, the first with *data sources*: a database with more than one data source becomes one Leaf database per source, with the source name in the title; a database with a single source stays as it was, mapped by the database id) |
| `LEAF_EMBEDDING_MODEL` / `LEAF_EMBEDDING_DIMENSIONS` / `LEAF_EMBEDDING_BASE_URL` | Semantic search (optional; defaults to `text-embedding-3-small` at 512 dimensions, on OpenAI's API). What switches semantic search on is `OPENAI_API_KEY`; the initial chunk load is `node scripts/backfill-index.mjs` |
| `GITHUB_TOKEN` / `LEAF_GITHUB_ORG` / `LEAF_GITHUB_REPOS` | Switch on the GitHub pull requests database. Without the token, or with an empty repo list, the database is off and the route answers 412. `LEAF_GITHUB_ORG` qualifies a short name (`leaf` becomes `<org>/leaf`); the list accepts both forms, comma-separated |
| `LEAF_GITHUB_SYNC_SECRET` / `LEAF_GITHUB_SYNC_OWNER` | Let a scheduled job trigger the sync with no session: the secret (16 characters minimum) goes in `Authorization: Bearer` and the email says whose account owns the database. Missing either one, only a person's session can trigger the route |
| `UNSPLASH_ACCESS_KEY` | Switches on the Unsplash tab in the cover picker; without it, the tab explains that search is not configured. The key stays on the server: the browser talks to `/api/unsplash`, which requires a session and caps 30 searches per minute per person. New Unsplash apps start in demo mode (50 calls/hour) — production needs the upgrade request in their dashboard |
| `LEAF_MCP_ENABLED` | Switches on the remote MCP server and the embedded OAuth 2.1 authorization server (`/api/mcp`, `/api/auth/oauth2/*`, `/.well-known/*`). Absent = on outside production and **off in production**; off, all of that answers 404 and the connected-apps screen disappears |
| `LEAF_MCP_WRITE` | With MCP on, allows the write tools. Absent = on; `0`/`false`/`off` disables writing entirely, even for tokens holding the `leaf:write` scope |

`deploy/README.md` has the deployment shapes; `docker-compose.yml` brings the
whole thing up locally in one command.

**Restricted access**: with `LEAF_ALLOWED_EMAIL_DOMAINS` set, validation happens
on the server at four points — better-auth's `before` hook on `/sign-up/email`
and `/sign-in/email`, `databaseHooks.user.create.before` (covering any account
creation path, OAuth included) and `databaseHooks.session.create.before`
(covering any sign-in path). Document and organisation invitations use the same
list.

**Importing from Notion**: Leaf is a Notion *public connection*, with OAuth per
person — each one connects their own account and imports only what they can
already see there. Three paths use the same connection: **Import from Notion** in
the sidebar's Private section (and in the ⌘K palette) brings into that person's
Private everything they ticked on Notion's consent screen, skipping what another
account in the organisation already brought and reporting how many pages were
left out; **Import from Notion** in the editor's `/` menu brings one page and its
tree in as a subpage of the open document; and **Import Notion workspace**, on
the organisation page and only for an owner or admin, brings everything into the
organisation or a teamspace, warning and confirming when another account already
imported (running it again from another account duplicates the collection,
because the Notion→Leaf map is per person). After signing in to Notion the person
returns where they were (a relative, validated `return`). The connection is
created at `https://app.notion.com/developers/connections`, with the installation
scope **"selected workspaces only"** (a choice that cannot be changed later) and
the redirect above. The capabilities to tick are **read content**, **read
comments** (otherwise `GET /v1/comments` answers 403 and threads do not come
through) and **read user information including email** (that is what matches a
comment's author to their Leaf account). Each person's token lives in
`notion_connections`.

**GitHub pull requests database**: `POST /api/sync/github` creates (or updates) a
`kind database` called *GitHub pull requests*, with one `kind row` per PR and a
fixed schema of repository, number, state, author, updated at, and URL. The rows
are machine-owned: any edit on screen is overwritten on the next pass.

The engine mirrors `src/lib/notion/sync.ts` — an idempotent upsert by external id
in a mapping table of its own (`github_documents`, keyed by `user_id` +
`github_id`), skipping whatever has not changed by the PR's `updated_at`. Since
the listing comes ordered by `updated` descending, each repository keeps a cursor
(`repo:<owner>/<name>`) with the top of the last **complete** pass and stops
paginating when it crosses it; an interrupted pass does not move the cursor, so
the next one restarts from the top and the rows already up to date come cheap.
The row body is left empty on purpose: the PR description is not part of this
version.

The route accepts two triggers. With a session, the person syncs into their own
space (the body accepts `destination`, like the import routes, and `force` to
rewrite everything). With `Authorization: Bearer $LEAF_GITHUB_SYNC_SECRET`, the
database is the one owned by the account in `LEAF_GITHUB_SYNC_OWNER` — that is
how a scheduled job can run it unattended.

**SSO sign-in**: with the `LEAF_SSO_*` variables filled in, Leaf becomes an
OAuth2/OIDC client of the company's provider (scopes `openid profile email`,
redirect `https://<your-host>/api/auth/callback/<provider id>` and the equivalent
on `http://localhost:3000`). The provider is registered by better-auth's
`genericOAuth` plugin with explicit endpoints `GET {issuer}/oauth2/authorize` and
`POST {issuer}/oauth2/token` — a provider with no discovery document is the
anticipated case. `token` authenticates the client with `client_secret_post` in
an `x-www-form-urlencoded` body and answers `access_token` + `id_token` with no
`refresh_token` and no `userinfo` endpoint. Identity comes from the `id_token`
claims (`sub` becomes the account's external id, `email` becomes the email; since
the IdP does not send `name`, the name is born from the local part of the email).
Which authentication method to offer is the provider's screen to decide, not
Leaf's.

## Database

Any MySQL 8 will do, with a dedicated user. The migrations in `drizzle/mysql` run
when the app boots; `next build` does **not** touch the database. The seven old
SQLite migrations are archived in `drizzle/sqlite-legacy/` and are no longer run.

