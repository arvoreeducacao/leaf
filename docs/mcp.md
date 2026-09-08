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

