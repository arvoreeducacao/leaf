# Leaf

Editor de documentos da Árvore, no estilo Notion. Roda 100% local.

## Stack

- Next.js 16 (App Router, `src/`), React 19, TypeScript, Tailwind v4
- Tema Bonsai (tokens, fonte Averta e ícones copiados do `arvore-design-system`)
- SQLite local via drizzle-orm + better-sqlite3
- Autenticação com better-auth (email e senha)
- Imagens em S3 via `@aws-sdk/client-s3`, com s3rver como emulador de dev

## Como rodar

```bash
pnpm install
cp .env.example .env.local
pnpm db:generate   # só quando o schema mudar
pnpm dev           # sobe o Next, o emulador S3 e o servidor de colaboração
```

O banco fica em `data/leaf.db` e é migrado no boot. Os objetos do emulador S3
ficam em `.s3rver/`. As duas pastas estão no `.gitignore`.

## Scripts

| Script | O que faz |
| --- | --- |
| `pnpm dev` | Next dev + emulador S3 (porta 4568) + servidor de colaboração (porta 1234) |
| `pnpm dev:next` | Só o Next |
| `pnpm dev:s3` | Só o emulador S3 |
| `pnpm dev:realtime` | Só o servidor de colaboração |
| `pnpm build` | Build de produção |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm db:generate` | Gera a migração a partir de `src/db/schema.ts` |
| `pnpm db:migrate` | Aplica as migrações pelo drizzle-kit |

## Rotas

- `/login`, `/signup`
- `/` shell autenticado, redireciona para o documento mais recente
- `/doc/[id]` documento
- `POST /api/uploads` e `GET /api/uploads/[...key]`
- `/api/auth/[...all]`
- `POST /api/realtime/{authz,seed,persist}` — uso interno do servidor de
  colaboração, protegidas por `LEAF_REALTIME_SECRET`

## Colaboração em tempo real

Yjs + `y-websocket`, com o servidor em `scripts/dev-realtime.mjs`. Cada
documento é uma sala `doc:{id}`; o acesso é conferido no handshake pelo mesmo
`src/lib/authz.ts` do app, e quem não pode editar conecta em modo leitura (os
updates dele são descartados **no servidor**). Enquanto a sala está aberta, quem
grava o `documents.content` é o servidor, pelo mesmo caminho do autosave.

| Env | Default | Para que serve |
| --- | --- | --- |
| `LEAF_REALTIME` | ligado fora de produção | Liga/desliga a colaboração; desligado, o editor usa o autosave de sempre |
| `LEAF_REALTIME_PORT` | `1234` | Porta do servidor ws |
| `LEAF_REALTIME_HOST` | todas as interfaces | Interface do servidor ws |
| `LEAF_REALTIME_URL` | derivada do navegador | URL do ws (use `wss://` em deploy) |
| `LEAF_REALTIME_SECRET` | `leaf-dev-realtime` em dev, **obrigatória** em produção | Autentica o servidor ws nas rotas internas |
| `LEAF_APP_URL` | `http://127.0.0.1:3000` | Onde o servidor ws acha o Next |

Se o servidor ws não subir, o editor espera 2,5 s, desiste e volta ao modo sem
colaboração — nada trava.

## Convenções

- Sem comentários no código.
- Só tokens Bonsai, sem hex cru fora do `globals.css`.
- Ícones sempre de `@/components/icons`.
- Checagem de permissão sempre no servidor, por `src/lib/authz.ts`.

Notas de integração entre as ondas de desenvolvimento em
[`INTEGRATION-NOTES.md`](./INTEGRATION-NOTES.md).
