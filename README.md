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
- **Busca**: `Ctrl+K` / `Alt+K` abrem a command palette (full-text via índice `FULLTEXT` do MySQL, recentes e ações rápidas), sempre filtrada por permissão no servidor
- **Colaboração em tempo real**: Yjs + WebSocket, cursores nomeados, indicador de presença, escrita autorizada no handshake e fallback automático para edição solo
- **Dois temas** (claro/escuro/sistema, contraste AA verificado) e **dois idiomas** (pt-BR e en-US)

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) · React 19 · TypeScript |
| Editor | BlockNote 0.54 sobre ProseMirror/Yjs |
| Estilo | Tailwind CSS v4 + design system Bonsai (tokens semânticos, Averta, ícones próprios) |
| Banco | Drizzle ORM · MySQL 8 / Aurora MySQL (driver `mysql2`, `DATABASE_URL`) |
| Auth | better-auth (email e senha; Google OAuth opcional, restrição por domínio de email) |
| Arquivos | API S3 (`@aws-sdk/client-s3`) — emulador s3rver em dev |
| Realtime | Servidor WebSocket próprio (`scripts/dev-realtime.mjs`) falando o protocolo y-websocket |

## Rodando localmente

```bash
pnpm install
cp .env.example .env.local   # aponte DATABASE_URL para um MySQL 8 seu
pnpm dev
```

`pnpm dev` sobe três processos juntos: o Next em `http://localhost:3000`, o emulador S3 na `4568` e o servidor de colaboração na `1234`. As migrações de `drizzle/mysql` rodam no boot do app. Crie uma conta em `/signup` (sem verificação de email em dev) e pronto.

O ambiente de desenvolvimento da Árvore usa o database `leaf_dev` no cluster Aurora MySQL (`arvore-cluster`), com o mesmo usuário `leaf` da produção.

## Testes

```bash
pnpm test        # unitários (vitest)
pnpm test:e2e    # Playwright, em sandbox própria (não interfere no dev server)
```

Os testes precisam de MySQL de verdade — não há mais SQLite em memória. Cada worker do vitest usa o seu próprio database `<LEAF_TEST_DATABASE_URL>_<VITEST_POOL_ID>` (`leaf_test_1` … `leaf_test_6`, com `maxWorkers: 6`), truncado entre suítes; o schema é aplicado pelas migrações no primeiro uso.

A suíte E2E sobe três ambientes isolados: o app padrão na porta 3100 (banco `leaf_e2e`), um com realtime ligado na 3200 / ws 1235 (banco `leaf_e2e_realtime`) e um com `LEAF_ALLOWED_EMAIL_DOMAINS=arvore.com.br` na 3300 (projeto `restricted`). Os dois primeiros derrubam as tabelas do respectivo banco e aplicam as migrações antes de subir o servidor; o terceiro reaproveita o `leaf_e2e` já preparado (o usuário `leaf` só tem grant nos bancos existentes) e por isso não prepara nada. O `DATABASE_URL` é injetado no processo filho, então o `.env.local` do dev nunca é usado pela sandbox.

A E2E roda com um worker só (`E2E_WORKERS` permite mudar). Com o banco a ~150 ms de distância, cada caso leva perto de 20 s e a suíte inteira passa de 15 minutos — para rodar em pedaços, faça o build uma vez (`LEAF_DIST_DIR=.next-e2e pnpm exec next build`) e depois `pnpm exec playwright test --project=<projeto> <specs>`.

## Produção

O app fala S3 e SQL por configuração — publicar é trocar env:

| Variável | Uso |
|---|---|
| `DATABASE_URL` | `mysql://usuario:senha@host:3306/leaf` — obrigatória; o app não sobe sem ela |
| `DATABASE_POOL_SIZE` | tamanho do pool do `mysql2` (padrão `10`) |
| `S3_ENDPOINT` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | storage de imagens (bucket provisionado: `arvore-leaf-uploads`) |
| `LEAF_REALTIME` / `LEAF_REALTIME_URL` (`wss://`) / `LEAF_REALTIME_SECRET` | colaboração em tempo real (o ws roda como processo próprio) |
| `BETTER_AUTH_URL` / `BETTER_AUTH_SECRET` | auth |
| `LEAF_ALLOWED_EMAIL_DOMAINS` | lista separada por vírgula (ex. `arvore.com.br`). Vazia ou ausente = sem restrição (dev e testes). Setada = só esses domínios criam conta, entram e recebem convite |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | habilitam o botão "Entrar com Google"; sem as duas, o provider não é registrado e a UI não muda |

**Acesso restrito**: com `LEAF_ALLOWED_EMAIL_DOMAINS` setada, a validação acontece
no servidor em quatro pontos — hook `before` do better-auth em `/sign-up/email` e
`/sign-in/email`, `databaseHooks.user.create.before` (cobre qualquer caminho de
criação de conta, inclusive OAuth) e `databaseHooks.session.create.before` (cobre
qualquer caminho de login). Os convites de documento e de organização usam a mesma
lista. Em produção (`leaf.arvore.com.br`) a variável deve valer `arvore.com.br`.

**Banco**: o database `leaf` está provisionado no cluster Aurora MySQL da Árvore (`arvore-cluster`, MySQL 8.0.42), com usuário dedicado no Secrets Manager (`prd/leaf/database`). As migrações de `drizzle/mysql` rodam no boot do app; o `next build` **não** toca no banco. As sete migrações antigas de SQLite ficaram arquivadas em `drizzle/sqlite-legacy/` e não são mais executadas.

## Documentação

- [`docs/ROADMAP.md`](docs/ROADMAP.md) — histórico das 12 ondas de construção, decisões e próximos passos
- [`INTEGRATION-NOTES.md`](INTEGRATION-NOTES.md) — decisões técnicas acumuladas, pendências e propostas de PR para o design system

## Qualidade

Construído em 12 ondas com fechamento validado, mais o port para MySQL e a onda de autenticação restrita: **270 testes unitários**, **52 cenários E2E** (desktop, mobile, colaboração em dois navegadores e domínio restrito), build de produção verde e design review do Bonsai com bloqueantes zerados nos dois temas.

---

Feito com o [Bonsai Design System](https://designsystem.arvore.dev) · Árvore Educação
