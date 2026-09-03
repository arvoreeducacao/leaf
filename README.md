# 🍃 Leaf

Editor de documentos colaborativo da Árvore, no espírito do Notion: blocos, hierarquia de páginas, organizações e colaboração em tempo real — com migração completa de exports do Notion.

## Funcionalidades

- **Editor de blocos** (BlockNote): parágrafos, títulos, listas, checklists, citações, código, tabelas, imagens, destaques; slash menu (`/`), toolbar de formatação, atalhos markdown ao digitar e colagem rica direto do Notion ou Google Docs
- **Incorporar** (`/incorporar` ou colando o link numa linha vazia): Figma, YouTube, Vimeo, Loom, Miro, Google Docs, Sheets, Slides, Forms e Drive, Canva, Spotify, Typeform, CodeSandbox e CodePen aparecem dentro da página; link de fora dessa lista vira um cartão com o endereço, e o import do Notion traz os embeds dele já assim
- **Hierarquia de páginas**: subpáginas ilimitadas, sidebar em árvore, breadcrumb, mover documentos, lixeira em cascata com desfazer
- **Importação agnóstica** via slash menu: arquivos `.md` inseridos no ponto do cursor, ou o **zip de export do Notion inteiro** virando árvore de páginas (imagens, links internos, callouts e databases CSV convertidos)
- **Capa da página** no estilo do Notion: *Adicionar capa* ao passar o mouse no título, galeria de cores e gradientes, upload, link ou busca no **Unsplash** (com crédito ao fotógrafo), reposicionar arrastando e remover; a capa aparece também no link público
- **Exportação** para Markdown e HTML
- **Compartilhamento**: convites por email com papéis Pode ver / Pode comentar / Pode editar, link público somente leitura revogável
- **Organizações e teamspaces**: documento nasce privado; seções Privado / Organização / Teamspaces na sidebar; teamspaces abertos ou fechados; múltiplas organizações por pessoa com switcher; convidados externos com selo próprio
- **Comentários**: threads ancoradas em blocos, respostas, resolver e reabrir, papel dedicado de comentarista
- **Histórico de versões**: snapshots automáticos com throttle, preview e restauração
- **Busca**: `Ctrl+K` / `Alt+K` abrem a command palette (full-text via índice `FULLTEXT` do MySQL, recentes e ações rápidas), sempre filtrada por permissão no servidor. Com `OPENAI_API_KEY`, entra também a busca semântica: cada documento vira trechos com embedding em `document_chunks`, e a palette e o *Perguntar* misturam os dois rankings — sem a chave, ou se a OpenAI cair, a busca continua só no `FULLTEXT`
- **Colaboração em tempo real**: Yjs + WebSocket, cursores nomeados, indicador de presença, escrita autorizada no handshake e fallback automático para edição solo
- **Offline first**: the open document lives in the browser (Yjs in IndexedDB), stays editable with no connection and syncs on its own when the network is back; a service worker keeps the app shell and the pages you already visited, and falls back to its own screen when a page was never loaded
- **IA no editor** (opcional, ligada por chave no `.env`): `/` abre *Pedir para a IA* — escrever sobre um assunto, continuar o texto, resumir a página, listar próximos passos; com texto selecionado, a barra de formatação oferece melhorar a escrita, corrigir ortografia, encurtar, desenvolver, simplificar, mudar o tom, traduzir e explicar. A resposta chega escrevendo no documento, com aceitar ou desfazer antes de valer
- **Dois temas** (claro/escuro/sistema, contraste AA verificado) e **dois idiomas** (pt-BR e en-US)

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) · React 19 · TypeScript |
| Editor | BlockNote 0.54 sobre ProseMirror/Yjs |
| Estilo | Tailwind CSS v4 + design system Bonsai (tokens semânticos, Averta, ícones próprios) |
| Banco | Drizzle ORM · MySQL 8 / Aurora MySQL (driver `mysql2`, `DATABASE_URL`) |
| Auth | better-auth (email e senha; SSO da Árvore opcional via OAuth2/OIDC, restrição por domínio de email) |
| Arquivos | API S3 (`@aws-sdk/client-s3`) — emulador s3rver em dev |
| Realtime | Servidor WebSocket próprio (`scripts/dev-realtime.mjs`) falando o protocolo y-websocket |
| Offline | `y-indexeddb` for the document, a dedicated IndexedDB for the outbox, module service worker in `public/sw.js` |
| IA | `@blocknote/xl-ai` no editor e AI SDK no servidor (Anthropic ou OpenAI) |

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

A suíte E2E sobe quatro ambientes isolados: o app padrão na porta 3100 (banco `leaf_e2e`), um com realtime ligado na 3200 / ws 1235 (banco `leaf_e2e_realtime`), um com `LEAF_ALLOWED_EMAIL_DOMAINS=arvore.com.br` na 3300 (projeto `restricted`) e um com o SSO da Árvore ligado em credenciais de mentira na 3400 (projeto `sso`). Os dois primeiros derrubam as tabelas do respectivo banco e aplicam as migrações antes de subir o servidor; os outros dois reaproveitam o `leaf_e2e` já preparado (o usuário `leaf` só tem grant nos bancos existentes) e por isso não preparam nada. O `DATABASE_URL` é injetado no processo filho, então o `.env.local` do dev nunca é usado pela sandbox.

A E2E roda com um worker só (`E2E_WORKERS` permite mudar). Com o banco a ~150 ms de distância, cada caso leva perto de 20 s e a suíte inteira passa de 15 minutos — para rodar em pedaços, faça o build uma vez (`LEAF_DIST_DIR=.next-e2e pnpm exec next build`) e depois `pnpm exec playwright test --project=<projeto> <specs>`.

## Offline

Leaf opens and edits with no network. Three independent layers, and none of them needs to be online to work:

**The document.** Every open document becomes a `Y.Doc` persisted to IndexedDB by `y-indexeddb` — including when realtime is off, in which case the editor runs in collaboration mode against a local document with no provider. Closing the tab, losing the network and coming back loses nothing: the state is read from the browser's disk before any request.

**The way back to the server.** While the WebSocket is connected, the collaboration server is still what writes to MySQL. When it is not (realtime off, server down, or you with no network), every change goes into an outbox in IndexedDB (`leaf-offline`, key `outbox:<id>`) *before* the server is tried. The outbox is drained when the network returns, when the app opens and after every save; a document that already has a live collaboration session is dropped from the outbox instead of sent, because Yjs already carried those edits.

**The shell.** The service worker (`public/sw.js`, registered as a module) keeps the build and the fonts cache-first, and pages and navigation payloads network-first with a cache fallback. Nothing under `/api/` is cached: auth and freshness always go over the network. A page that was never loaded, with no network, falls back to `/offline`.

Navigating from the sidebar is not a browser navigation — Next only fetches the payload, so the page HTML would never enter the cache. That is why the client asks the service worker to *warm* the open page (`leaf:warm-page`), on the first visit and again when the tab is hidden. It is what makes a refresh with no network still open the document instead of the offline screen.

### Instalação como app (desktop)

O Leaf é instalável no Chrome e no Edge do desktop: `public/manifest.webmanifest` (id, escopo, ícones PNG 192/512 e um maskable de sangria total em `public/icon-maskable.svg`) mais o `apple-touch-icon.png` e as metatags de web app no `src/app/layout.tsx`. O menu da pessoa ganha **Instalar o Leaf** quando um navegador de desktop entrega o `beforeinstallprompt`; instalado (display standalone), o item some. No celular o item nunca aparece e o evento é engolido — a barra "adicionar à tela inicial" do Chrome no Android não sobe — porque lá o caminho é o app nativo. Os ícones PNG são gerados uma vez a partir dos SVGs de `public/` — ao mudar o logo, regenere os quatro.

### Why the Yjs state became a table

`document_realtime_state` holds the `Y.Doc` binary and an `identity`. Without it, every time a WebSocket room is recreated the server would build a fresh `Y.Doc` from the JSON — with different item IDs — and a client holding the old document in IndexedDB would add the two together on reconnect, **duplicating the content**. With the state persisted, the document identity never changes, and the merge is what Yjs promises.

The `identity` is the safety belt: before connecting, the client asks `GET /api/documents/:id/snapshot` and compares it with the one it stored. If it changed (the state was lost and the room was reseeded), the local copy is discarded before the merge instead of duplicating the document. The `content` column stays the JSON projection that search, export and history read.

The two representations are tie-broken by date: if `documents.updated_at` is newer than `document_realtime_state.updated_at` — which only happens when someone saved through the solo path, with no WebSocket — the room is reseeded from the JSON with a new identity, and whoever holds a local copy discards it. That is why the server writes the state *after* writing the content: the other order would rotate the identity on every save, and everyone would lose offline for no reason. For the same reason, when the client has to seed the document on its own (no WebSocket but with network), it tears down the collaboration connection for that session: a document seeded in the browser must not later join the room's, or the content shows up twice.

### What still does not work offline

- Creating, renaming, moving and deleting a document are server actions and need the network.
- Image upload needs the network — the block stays empty until the next send.
- Comments and version history are not cached.
- The sidebar and the document **title** offline are the ones from the last page warm-up, not live data. The document body comes from the local Yjs and is always right; the title may be stale.
- `navigator.onLine` lies (captive portal, wi-fi with no way out). That is why nothing depends on the `online` event alone: both the outbox and the collaboration reconnect retry every 5s while something is pending, and the request that fails is the probe.

## IA

A IA do editor nasce **desligada** e liga sozinha quando existe uma chave no ambiente — não há flag separada. Cada pessoa põe a **sua** chave no `.env.local`, do mesmo jeito que já faz com o banco:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

Só isso já basta: sem `LEAF_AI_MODEL`, o modelo é `claude-sonnet-5`. O resto é opcional:

| Variável | Para quê |
|---|---|
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | A chave. A presença de uma delas é o que liga a IA |
| `LEAF_AI_PROVIDER` | `anthropic` ou `openai`, quando as duas chaves existem no mesmo `.env` |
| `LEAF_AI_MODEL` | Troca o modelo. Obrigatório na OpenAI, que não tem padrão aqui |
| `LEAF_AI_BASE_URL` | Aponta para um gateway compatível em vez da API do provedor |
| `LEAF_AI_MAX_OUTPUT_TOKENS` | Teto de saída por resposta (padrão 8192) |

Quem não põe chave nenhuma continua com o editor de sempre: sem item de IA no `/`, sem botão na barra de formatação, sem rota respondendo.

**A chave nunca vai para o navegador.** O editor fala com `POST /api/ai`, e é o servidor que chama o provedor. A rota exige sessão, exige permissão de edição no documento que veio no corpo do pedido, e limita 20 chamadas por minuto por pessoa; quem só pode ver ou comentar recebe 403 e não vê a IA na tela.

O que a IA escreve entra como sugestão no documento aberto — em colaboração, num fork do `Y.Doc`, então ninguém mais vê o rascunho antes da hora. Aceitar aplica, desfazer descarta, e o histórico de versões continua sendo a rede de proteção.

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
| `ARVORE_SSO_CLIENT_ID` / `ARVORE_SSO_CLIENT_SECRET` / `ARVORE_SSO_ISSUER` | habilitam o botão "Entrar com a conta Árvore"; sem o client id, o provider não é registrado e a tela continua sendo o formulário de email e senha. O issuer padrão é `https://auth.arvore.com.br/api-arvore` |
| `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET` / `NOTION_REDIRECT_URI` | habilitam o import por link do Notion; sem elas o caminho fica desligado e o diálogo diz isso. Em produção o redirect é `https://leaf.arvore.com.br/api/notion/callback` |
| `NOTION_API_VERSION` | versão da API do Notion no cabeçalho `Notion-Version` (padrão `2022-06-28`) |
| `LEAF_EMBEDDING_MODEL` / `LEAF_EMBEDDING_DIMENSIONS` / `LEAF_EMBEDDING_BASE_URL` | busca semântica (opcionais; padrão `text-embedding-3-small` em 512 dimensões, na API da OpenAI). Quem liga a busca semântica é a `OPENAI_API_KEY`; a carga inicial dos trechos é o `node scripts/backfill-index.mjs` |
| `UNSPLASH_ACCESS_KEY` | liga a aba Unsplash do seletor de capa; sem ela, a aba explica que a busca não está configurada. A chave fica no servidor: o navegador fala com `/api/unsplash`, que exige sessão e limita 30 buscas por minuto por pessoa. Apps novos no Unsplash começam em modo demo (50 chamadas/hora) — produção precisa pedir o upgrade no painel deles |

**Acesso restrito**: com `LEAF_ALLOWED_EMAIL_DOMAINS` setada, a validação acontece
no servidor em quatro pontos — hook `before` do better-auth em `/sign-up/email` e
`/sign-in/email`, `databaseHooks.user.create.before` (cobre qualquer caminho de
criação de conta, inclusive OAuth) e `databaseHooks.session.create.before` (cobre
qualquer caminho de login). Os convites de documento e de organização usam a mesma
lista. Em produção (`leaf.arvore.com.br`) a variável deve valer `arvore.com.br`.

**Importar do Notion por link**: o Leaf é uma *public connection* do Notion, com
OAuth por pessoa — cada uma conecta a própria conta e importa só o que já enxerga
lá. A conexão se cria em `https://app.notion.com/developers/connections`, com
escopo de instalação **"selected workspaces only"** (escolha que não se muda
depois) e o redirect acima. As capacidades a marcar são **ler conteúdo**, **ler
comentários** (senão `GET /v1/comments` responde 403 e as threads não vêm) e
**ler informação de usuário com email** (é o que casa o autor do comentário com a
conta do Leaf). O token de cada pessoa fica em `notion_connections`.

**Login pelo SSO da Árvore**: o Leaf é um client OAuth2/OIDC do IdP da casa
(`client_id` `leaf`, escopos `openid profile email`, redirect
`https://leaf.arvore.com.br/api/auth/callback/arvore` e o equivalente em
`http://localhost:3000`). O provider é registrado pelo plugin `genericOAuth` do
better-auth com os endpoints explícitos `GET {issuer}/oauth2/authorize` e
`POST {issuer}/oauth2/token` — o IdP não publica documento de discovery, o
`token` autentica o client por `client_secret_post` em corpo
`x-www-form-urlencoded` e responde `access_token` + `id_token` sem
`refresh_token` nem endpoint `userinfo`. A identidade sai das claims do
`id_token` (`sub` vira o id externo da conta, `email` vira o email; como o IdP
não manda `name`, o nome nasce da parte local do email). Quem escolhe o método
de autenticação (Google incluído) é a tela do próprio IdP, não o Leaf.

**Banco**: o database `leaf` está provisionado no cluster Aurora MySQL da Árvore (`arvore-cluster`, MySQL 8.0.42), com usuário dedicado no Secrets Manager (`prd/leaf/database`). As migrações de `drizzle/mysql` rodam no boot do app; o `next build` **não** toca no banco. As sete migrações antigas de SQLite ficaram arquivadas em `drizzle/sqlite-legacy/` e não são mais executadas.

## Qualidade

Construído em 12 ondas com fechamento validado, mais o port para MySQL, a onda de autenticação restrita e a do login pelo SSO da Árvore: **274 testes unitários**, **52 cenários E2E** (desktop, mobile, colaboração em dois navegadores, domínio restrito e SSO), build de produção verde e design review do Bonsai com bloqueantes zerados nos dois temas.

---

Feito com o [Bonsai Design System](https://designsystem.arvore.dev) · Árvore Educação
