# How offline works

Leaf opens and edits with no network. Three independent layers, and none of them
needs to be online to work:

**The document.** Every open document becomes a `Y.Doc` persisted to IndexedDB by
`y-indexeddb` — including when real-time is off, in which case the editor runs in
collaboration mode against a local document with no provider. Closing the tab,
losing the network and coming back loses nothing: the state is read from the
browser's disk before any request.

**The way back to the server.** While the WebSocket is connected, the
collaboration server is still what writes to MySQL. While it is reconnecting
(a deploy, a restart), changes stay only in the local `Y.Doc` and reach the
room when it comes back: saving the body straight to MySQL in that window would
make the room look outdated and get reseeded. When there is no collaboration
(real-time off, the room never answered, or you with no network), every change
goes into an outbox in IndexedDB (`leaf-offline`, key `outbox:<id>`) *before*
the server is tried. The outbox is drained when the network returns, when the
app opens and after every save; a document that already has a live
collaboration session is dropped from the outbox instead of sent, because Yjs
already carried those edits.

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

The `identity` is the safety belt, checked twice. Before connecting, the client
asks `GET /api/documents/:id/snapshot` and compares it with the one it stored.
Then it sends that identity when it joins (`?identity=`), and the collaboration
server compares it with the room it just opened: the room may have been
reseeded between the two. If they differ, the server refuses with `4410`, and
the tab discards its local copy and joins again, instead of merging two
lineages and duplicating the document. The `content` column stays the JSON
projection that search, export and history read.

The two representations are tie-broken by content: when a room opens, the
server rebuilds the JSON from the stored state and compares it with
`documents.content`, ignoring block ids. Only a body written outside the room
(the solo path, a version restore) makes them differ; then the room is
reseeded from the JSON with a new identity, and whoever holds a local copy
discards it. Renaming, moving or changing the icon touches
`documents.updated_at` but not the body, so it no longer reseeds anything. A
save from the room writes the content first and the state after, and keeps the
identity. For the same reason, when the client has to seed the document on its
own (no WebSocket but with network), it tears down the collaboration connection
for that session: a document seeded in the browser must not later join the
room's, or the content shows up twice.

### When access changes

The collaboration server checks access once, when a tab joins. When an owner
changes a share, the organization access, a member or a teamspace, the app asks
the server (`POST /access`, with `LEAF_REALTIME_SECRET`) to close the affected
connections with `4100`: those of the person, or every connection to the
documents when the change is about the documents. The tabs reconnect in about
200 ms and pass the same check again, so someone who became a viewer stops
writing and someone who lost access is refused.

### Writes that do not come from an editor

The MCP (`update_document`) and any other server-side body write have to reach
the room while it is open, or the room would save its own state over them a few
seconds later. So `writeBlocksToLiveRoom` (`src/lib/realtime-room.ts`) asks the
collaboration server for the live state (`GET /rooms/doc:<id>`, guarded by
`LEAF_REALTIME_SECRET`), computes the Yjs delta with the Leaf schema (append or
replace) and posts it back (`POST /rooms/doc:<id>/update`); the room broadcasts
it to everyone connected and persists it through the usual path, identity
preserved. When there is no room, the write goes straight to `documents.content`
and the next room reseeds from it. When the collaboration server cannot be
reached, a write on a page edited in the last 15 s is refused rather than
risked. The app finds the server through `LEAF_REALTIME_SERVER_URL`, or by
turning `LEAF_REALTIME_URL` from `ws`/`wss` into `http`/`https`.

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

