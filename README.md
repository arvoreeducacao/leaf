# 🍃 Leaf

Editor de documentos colaborativo da Árvore, no espírito do Notion: blocos, hierarquia de páginas, organizações e colaboração em tempo real — com migração completa de exports do Notion.

## Funcionalidades

- **Editor de blocos** (BlockNote): parágrafos, títulos, listas, checklists, citações, código, tabelas, imagens, destaques; slash menu (`/`), toolbar de formatação, atalhos markdown ao digitar e colagem rica direto do Notion ou Google Docs
- **Hierarquia de páginas**: subpáginas ilimitadas, sidebar em árvore, breadcrumb, mover documentos, lixeira em cascata com desfazer
- **Importação agnóstica** via slash menu: arquivos `.md` inseridos no ponto do cursor, ou o **zip de export do Notion inteiro** virando árvore de páginas (imagens, links internos, callouts e databases CSV convertidos)
- **Exportação** para Markdown e HTML
- **Compartilhamento**: convites por email com papéis Pode ver / Pode comentar / Pode editar, link público somente leitura revogável
- **Organizações e teamspaces**: documento nasce privado; seções Privado / Organização / Teamspaces na sidebar; teamspaces abertos ou fechados; múltiplas organizações por pessoa com switcher; convidados externos com selo próprio
- **Comentários**: threads ancoradas em blocos, respostas, resolver e reabrir, papel dedicado de comentarista
- **Histórico de versões**: snapshots automáticos com throttle, preview e restauração
- **Busca**: `Ctrl+K` / `Alt+K` abrem a command palette (full-text via SQLite FTS5, recentes e ações rápidas), sempre filtrada por permissão no servidor
- **Colaboração em tempo real**: Yjs + WebSocket, cursores nomeados, indicador de presença, escrita autorizada no handshake e fallback automático para edição solo
- **Dois temas** (claro/escuro/sistema, contraste AA verificado) e **dois idiomas** (pt-BR e en-US)

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) · React 19 · TypeScript |
| Editor | BlockNote 0.54 sobre ProseMirror/Yjs |
| Estilo | Tailwind CSS v4 + design system Bonsai (tokens semânticos, Averta, ícones próprios) |
| Banco | Drizzle ORM · SQLite em desenvolvimento (`data/leaf.db`) |
| Auth | better-auth (email e senha) |
| Arquivos | API S3 (`@aws-sdk/client-s3`) — emulador s3rver em dev |
| Realtime | Servidor WebSocket próprio (`scripts/dev-realtime.mjs`) falando o protocolo y-websocket |

## Rodando localmente

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

`pnpm dev` sobe três processos juntos: o Next em `http://localhost:3000`, o emulador S3 na `4568` e o servidor de colaboração na `1234`. Crie uma conta em `/signup` (sem verificação de email em dev) e pronto.

## Testes

```bash
pnpm test        # unitários (vitest)
pnpm test:e2e    # Playwright, em sandbox própria (não interfere no dev server)
```

A suíte E2E sobe dois ambientes isolados: o app padrão na porta 3100 e um segundo com realtime ligado na 3200 (ws na 1235).

## Produção

O app fala S3 e SQL por configuração — publicar é trocar env:

| Variável | Uso |
|---|---|
| `S3_ENDPOINT` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | storage de imagens (bucket provisionado: `arvore-leaf-uploads`) |
| `LEAF_REALTIME` / `LEAF_REALTIME_URL` (`wss://`) / `LEAF_REALTIME_SECRET` | colaboração em tempo real (o ws roda como processo próprio) |
| `BETTER_AUTH_URL` / `BETTER_AUTH_SECRET` | auth |

**Banco**: o database `leaf` está provisionado no cluster Aurora MySQL da Árvore (`arvore-cluster`). O código hoje usa o dialeto SQLite do Drizzle; a troca para MySQL (dialeto + regeneração de migrações + FTS5 → FULLTEXT) é a primeira tarefa pós-publicação — ver `docs/ROADMAP.md`.

## Documentação

- [`docs/ROADMAP.md`](docs/ROADMAP.md) — histórico das 12 ondas de construção, decisões e próximos passos
- [`INTEGRATION-NOTES.md`](INTEGRATION-NOTES.md) — decisões técnicas acumuladas, pendências e propostas de PR para o design system

## Qualidade

Construído em 12 ondas com fechamento validado: **239 testes unitários**, **51 cenários E2E** (desktop, mobile e colaboração em dois navegadores), build de produção verde e design review do Bonsai com bloqueantes zerados nos dois temas.

---

Feito com o [Bonsai Design System](https://designsystem.arvore.dev) · Árvore Educação
