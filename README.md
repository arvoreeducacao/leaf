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
pnpm dev           # sobe o Next e o emulador S3 juntos
```

O banco fica em `data/leaf.db` e é migrado no boot. Os objetos do emulador S3
ficam em `.s3rver/`. As duas pastas estão no `.gitignore`.

## Scripts

| Script | O que faz |
| --- | --- |
| `pnpm dev` | Next dev + emulador S3 (porta 4568) |
| `pnpm dev:next` | Só o Next |
| `pnpm dev:s3` | Só o emulador S3 |
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

## Convenções

- Sem comentários no código.
- Só tokens Bonsai, sem hex cru fora do `globals.css`.
- Ícones sempre de `@/components/icons`.
- Checagem de permissão sempre no servidor, por `src/lib/authz.ts`.

Notas de integração entre as ondas de desenvolvimento em
[`INTEGRATION-NOTES.md`](./INTEGRATION-NOTES.md).
