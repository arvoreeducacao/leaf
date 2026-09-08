# Deploying Leaf

Leaf reads everything about where it runs from the environment, so deploying is
mostly a matter of setting variables. The full list is in the root README.

## Trying it

From the repository root:

```bash
docker compose up
```

That brings up MySQL, an S3-compatible store and the app on
`http://localhost:3000`. Migrations run on boot. Create an account at `/signup`.

The credentials in `docker-compose.yml` are placeholders and the compose file is
meant for trying Leaf out, not for running it for other people. At minimum,
change `BETTER_AUTH_SECRET` and every password before pointing a domain at it.

## Running it for real

The pieces you need:

- **MySQL 8** (or Aurora MySQL), reachable at `DATABASE_URL`
- **An S3-compatible bucket** for uploads
- **Two processes from the same image**: the Next.js app, and the collaboration
  server (`node scripts/dev-realtime.mjs`) that speaks the y-websocket protocol.
  Point the app at it with `LEAF_REALTIME_URL` and share `LEAF_REALTIME_SECRET`
  between them. The app also calls that process over plain HTTP to write into
  rooms that are open (MCP writes, for one): set `LEAF_REALTIME_SERVER_URL` to
  its internal address when the public `LEAF_REALTIME_URL` does not route HTTP
  to the same process.

Anything else — SSO, AI, Unsplash, Notion import, semantic search — is optional
and switches itself off when its keys are absent.

## Árvore's own deployment

Árvore runs Leaf on EKS. Those manifests are not in this repository: they name
an AWS account, roles and a cluster, and none of that is useful to anyone else.
The GitHub Actions workflow in `.github/workflows/deploy.yml` is here, with
every identifier read from repository secrets and variables.
