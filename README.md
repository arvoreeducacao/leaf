# 🍃 Leaf

A collaborative document editor in the spirit of Notion: blocks, a page
hierarchy, organisations and real-time collaboration — with a complete migration
path from Notion.

Leaf is built and used by [Árvore](https://arvore.com.br) and released under the
AGPL-3.0. You can run your own: everything about where it runs comes from the
environment, and every integration switches itself off when its keys are absent.

```bash
docker compose up     # MySQL, an S3-compatible store and Leaf on :3000
```

## Features

- **Block editor** (BlockNote): paragraphs, headings, lists, checklists, quotes,
  code, tables, images, highlights; a slash menu (`/`), a formatting toolbar,
  markdown shortcuts as you type, and rich paste straight from Notion or Google
  Docs
- **Embeds** (`/embed`, or paste a link on an empty line): Figma, YouTube,
  Vimeo, Loom, Miro, Google Docs, Sheets, Slides, Forms and Drive, Canva,
  Spotify, Typeform, CodeSandbox and CodePen render inside the page. A link
  outside that list becomes a card showing the address, and the Notion import
  brings its embeds in already like this
- **Page hierarchy**: unlimited subpages, a tree sidebar, breadcrumbs, moving
  documents, and a cascading trash with undo
- **Format-agnostic import** from the slash menu: `.md` files inserted at the
  cursor, or **an entire Notion export zip** turned into a page tree (images,
  internal links, callouts and CSV databases all converted)
- **Page covers**, Notion-style: *Add cover* on hovering the title, a gallery of
  colours and gradients, upload, link, or an **Unsplash** search (crediting the
  photographer), drag to reposition, and remove. The cover shows on the public
  link too
- **Export** to Markdown and HTML
- **Sharing**: email invitations with Can view / Can comment / Can edit, plus a
  revocable read-only public link
- **Organisations and teamspaces**: documents are born private; the sidebar has
  Private / Organisation / Teamspaces sections; teamspaces can be open or
  closed; a person can belong to several organisations and switch between them;
  external guests carry their own badge
- **Comments**: threads anchored to blocks, replies, resolve and reopen, and a
  dedicated commenter role
- **Version history**: throttled automatic snapshots, preview and restore
- **Search**: `Ctrl+K` / `Alt+K` open the command palette (full-text through
  MySQL's `FULLTEXT` index, recents, and quick actions), always filtered by
  permission on the server. With an `OPENAI_API_KEY`, semantic search joins in:
  every document becomes embedded chunks in `document_chunks`, and both the
  palette and *Ask* blend the two rankings. With no key, or if OpenAI is down,
  search falls back to `FULLTEXT` alone
- **Real-time collaboration**: Yjs over WebSocket, named cursors, a presence
  indicator, write access authorised at the handshake, and an automatic fallback
  to solo editing
- **Offline first**: the open document lives in the browser (Yjs in IndexedDB),
  stays editable with no connection and syncs on its own when the network is
  back; a service worker keeps the app shell and the pages you already visited,
  and falls back to its own screen when a page was never loaded
- **AI in the editor** (optional, switched on by a key in `.env`): `/` opens
  *Ask AI* — write about a topic, continue the text, summarise the page, list
  next steps. With text selected, the formatting toolbar offers improve writing,
  fix spelling, shorten, expand, simplify, change tone, translate and explain.
  The answer arrives writing into the document, with accept or undo before it
  counts
- **Two themes** (light/dark/system, AA contrast verified) and **two languages**
  (pt-BR and en-US)

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) · React 19 · TypeScript |
| Editor | BlockNote 0.54 on ProseMirror/Yjs |
| Styling | Tailwind CSS v4 · shadcn/ui · semantic tokens · Lucide icons |
| Database | Drizzle ORM · MySQL 8 / Aurora MySQL (`mysql2` driver, `DATABASE_URL`) |
| Auth | better-auth (email and password; optional Google and optional company SSO over OAuth2/OIDC, with email-domain restriction) |
| Files | S3 API (`@aws-sdk/client-s3`) — s3rver emulator in development |
| Real-time | A WebSocket server of its own (`scripts/dev-realtime.mjs`) speaking the y-websocket protocol |
| Offline | `y-indexeddb` for the document, a dedicated IndexedDB for the outbox, a module service worker in `public/sw.js` |
| AI | `@blocknote/xl-ai` in the editor, the AI SDK on the server (Anthropic or OpenAI) |

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

## Offline

Leaf opens and edits with no network. Three independent layers, and none of them
needs to be online to work:

**The document.** Every open document becomes a `Y.Doc` persisted to IndexedDB by
`y-indexeddb` — including when real-time is off, in which case the editor runs in
collaboration mode against a local document with no provider. Closing the tab,
losing the network and coming back loses nothing: the state is read from the
browser's disk before any request.

**The way back to the server.** While the WebSocket is connected, the
collaboration server is still what writes to MySQL. When it is not (real-time
off, server down, or you with no network), every change goes into an outbox in
IndexedDB (`leaf-offline`, key `outbox:<id>`) *before* the server is tried. The
outbox is drained when the network returns, when the app opens and after every
save; a document that already has a live collaboration session is dropped from
the outbox instead of sent, because Yjs already carried those edits.

**The shell.** The service worker (`public/sw.js`, registered as a module) keeps
the build and the fonts cache-first, and pages and navigation payloads
network-first with a cache fallback. Nothing under `/api/` is cached: auth and
freshness always go over the network. A page that was never loaded, with no
network, falls back to `/offline`.

Navigating from the sidebar is not a browser navigation — Next only fetches the
payload, so the page HTML would never enter the cache. That is why the client
asks the service worker to *warm* the open page (`leaf:warm-page`), on the first
visit and again when the tab is hidden. It is what makes a refresh with no
network still open the document instead of the offline screen.

### Installing as an app

Leaf installs on desktop Chrome and Edge, and on Android and iPhone:
`public/manifest.webmanifest` (id, scope, PNG icons at 192/512 and a full-bleed
maskable one in `public/icon-maskable.svg`) plus `apple-touch-icon.png` and the
web-app meta tags in `src/app/layout.tsx`. The account menu gains **Install
Leaf** when a browser hands over `beforeinstallprompt`; once installed (display
standalone) the item disappears. On iPhone the only path is Safari's Share
sheet, and the app says so. The PNG icons are generated once from the SVGs in
`public/` — when the logo changes, regenerate all four.

### Why the Yjs state became a table

`document_realtime_state` holds the `Y.Doc` binary and an `identity`. Without it,
every time a WebSocket room is recreated the server would build a fresh `Y.Doc`
from the JSON — with different item IDs — and a client holding the old document
in IndexedDB would add the two together on reconnect, **duplicating the
content**. With the state persisted, the document identity never changes, and the
merge is what Yjs promises.

The `identity` is the safety belt: before connecting, the client asks
`GET /api/documents/:id/snapshot` and compares it with the one it stored. If it
changed (the state was lost and the room was reseeded), the local copy is
discarded before the merge instead of duplicating the document. The `content`
column stays the JSON projection that search, export and history read.

The two representations are tie-broken by date: if `documents.updated_at` is
newer than `document_realtime_state.updated_at` — which only happens when
someone saved through the solo path, with no WebSocket — the room is reseeded
from the JSON with a new identity, and whoever holds a local copy discards it.
That is why the server writes the state *after* writing the content: the other
order would rotate the identity on every save, and everyone would lose offline
for no reason. For the same reason, when the client has to seed the document on
its own (no WebSocket but with network), it tears down the collaboration
connection for that session: a document seeded in the browser must not later
join the room's, or the content shows up twice.

### What still does not work offline

- Creating, renaming, moving and deleting a document are server actions and need
  the network.
- Image upload needs the network — the block stays empty until the next send.
- Comments and version history are not cached.
- The sidebar and the document **title** offline are the ones from the last page
  warm-up, not live data. The document body comes from the local Yjs and is
  always right; the title may be stale.
- `navigator.onLine` lies (captive portal, wi-fi with no way out). That is why
  nothing depends on the `online` event alone: both the outbox and the
  collaboration reconnect retry every 5s while something is pending, and the
  request that fails is the probe.

## AI

The editor's AI is born **off** and switches itself on when a key exists in the
environment — there is no separate flag. Each person puts **their own** key in
`.env.local`, the same way they already do with the database:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

That alone is enough: with no `LEAF_AI_MODEL`, the model is `claude-sonnet-5`.
The rest is optional:

| Variable | What for |
|---|---|
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | The key. The presence of one of them is what switches the AI on |
| `LEAF_AI_PROVIDER` | `anthropic` or `openai`, when both keys live in the same `.env` |
| `LEAF_AI_MODEL` | Changes the model. Required on OpenAI, which has no default here |
| `LEAF_AI_BASE_URL` | Points at a compatible gateway instead of the provider's API |
| `LEAF_AI_MAX_OUTPUT_TOKENS` | Output ceiling per answer (default 8192) |

Anyone who sets no key at all keeps the editor they always had: no AI item in
`/`, no button on the formatting toolbar, no route answering.

**The key never reaches the browser.** The editor talks to `POST /api/ai`, and it
is the server that calls the provider. The route requires a session, requires
edit permission on the document sent in the request body, and caps 20 calls per
minute per person; anyone who can only view or comment gets a 403 and never sees
the AI on screen.

What the AI writes enters as a suggestion in the open document — in
collaboration, on a fork of the `Y.Doc`, so nobody else sees the draft before its
time. Accept applies it, undo discards it, and version history is still the
safety net.

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

## MCP

Leaf exposes a remote [MCP](https://modelcontextprotocol.io) server at
`${BETTER_AUTH_URL}/api/mcp` (Streamable HTTP transport, stateless) protected by
OAuth 2.1 — and Leaf itself is the authorization server, through the
`@better-auth/oauth-provider` plugin plus better-auth's `jwt` plugin. No external
service takes part: any Leaf installation has MCP working with what comes in this
repository and the `LEAF_MCP_ENABLED` flag.

How it works, in order: the MCP client gets a `401` with
`WWW-Authenticate: Bearer resource_metadata=...`, reads
`/.well-known/oauth-protected-resource` and
`/.well-known/oauth-authorization-server`, registers itself at
`/api/auth/oauth2/register` (dynamic registration, always a **public** client
with PKCE S256; redirects only `https`, or `http` on
`localhost`/`127.0.0.1`/`[::1]` for command-line clients), sends the person to
Leaf's sign-in and then to the consent screen at `/oauth/consent`, and trades the
code for a 15-minute JWT access token (`aud` = `${BETTER_AUTH_URL}/api/mcp`,
signed with the EdDSA key kept in the `jwks` table) plus a rotating refresh
token. Every tool call runs on behalf of the person who authorised it, under the
same ACL as the interface (`src/lib/authz.ts`): whoever cannot see a document in
Leaf cannot see it through MCP either.

Scopes: `leaf:read` (search, reading documents, databases, comments and
organisations), `leaf:write` (the write tools; without the scope they are not
even registered) and `offline_access` (refresh token). People see and revoke
authorised apps under **Connected apps** in the account menu
(`/connected-apps`); revoking deletes the consent and invalidates that client's
refresh tokens.

Read tools: `search_documents`, `get_document`, `list_documents`,
`list_organizations`, `list_teamspaces`, `list_members` (emails only for
administrators), `whoami`, `get_database`, `query_database` (filter, search and
ordering by property name, values in text and raw) and `list_comments`.

Comments and attachments (`leaf:write`): `create_comment` (opens a thread, or
replies with `replyTo`), `resolve_comment` (author or editor) and `upload_file`
(image, PDF, text, markdown, CSV and JSON, up to 500 kB; the returned URL works
in a page or in a row's file column).

Write tools (`leaf:write`): `create_document` (with icon and cover),
`update_document` (body in append/replace, title, icon, cover and property values
when the document is a row; a body write refuses if the page was edited in the
last 15 s, since a collaboration room is probably open, and uses an optimistic
guard on `updated_at`), `move_document` (to another page, to a teamspace, to the
organisation root or back to Private, with the subtree), `duplicate_document`,
`trash_document` and `restore_document` (owner only), `upload_image`, and the
database ones: `create_database`, `create_database_row`, `update_database_row`,
`delete_database_row` (goes to the trash), `add_database_property`,
`update_database_property`, `delete_database_property`, `create_database_view`
and `update_database_view`.

Every property reference accepts a name or an id; select options and people
accept a name. Trash yes, permanent delete no; sharing, public links and members
stay out. Limits: body up to 1 MB, 60 calls/min per person, up to 50 results per
call, markdown up to 400 thousand characters.

To connect (swap `https://leaf.example.org` for your installation's
`BETTER_AUTH_URL`):

- **Claude (web and desktop)**: Settings → Connectors → Add custom connector →
  URL `https://leaf.example.org/api/mcp`. Claude registers the client and opens
  Leaf's sign-in and consent screens.
- **Claude Code**:
  `claude mcp add --transport http leaf https://leaf.example.org/api/mcp`, then
  `/mcp` inside Claude Code to authenticate (the callback is on
  `http://localhost`, which is why loopback is allowed at registration).
- **Cursor**: in `.cursor/mcp.json` (or the MCP settings),
  `{ "mcpServers": { "leaf": { "url": "https://leaf.example.org/api/mcp" } } }`;
  Cursor opens the OAuth flow on the first call.
- **Inspector**: `npx @modelcontextprotocol/inspector` → Streamable HTTP
  transport → the URL above → Connect. To test locally use
  `BETTER_AUTH_URL=http://localhost:3000` and `pnpm dev`.

## Database

Any MySQL 8 will do, with a dedicated user. The migrations in `drizzle/mysql` run
when the app boots; `next build` does **not** touch the database. The seven old
SQLite migrations are archived in `drizzle/sqlite-legacy/` and are no longer run.

## Contributing

Leaf is built for Árvore first, and reviews happen when there is time — but
contributions are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) has the house
rules, the DCO sign-off and what to run before opening a pull request. Everyone
taking part is expected to follow the
[code of conduct](CODE_OF_CONDUCT.md).

Found a security problem? Do not open an issue — [SECURITY.md](SECURITY.md) has
the private channels.

## Licence

[AGPL-3.0](LICENSE).

In short: you can run, study, modify and redistribute Leaf. If you run a modified
Leaf as a network service, the people using it are entitled to that modified
source — point `NEXT_PUBLIC_LEAF_SOURCE_URL` at your fork and the account menu
does it for you.

Copyright © 2026 Árvore Educação.
