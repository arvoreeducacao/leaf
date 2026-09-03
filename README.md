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
| Auth | better-auth (email e senha; SSO da Árvore opcional via OAuth2/OIDC, restrição por domínio de email) |
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

A suíte E2E sobe quatro ambientes isolados: o app padrão na porta 3100 (banco `leaf_e2e`), um com realtime ligado na 3200 / ws 1235 (banco `leaf_e2e_realtime`), um com `LEAF_ALLOWED_EMAIL_DOMAINS=arvore.com.br` na 3300 (projeto `restricted`) e um com o SSO da Árvore ligado em credenciais de mentira na 3400 (projeto `sso`). Os dois primeiros derrubam as tabelas do respectivo banco e aplicam as migrações antes de subir o servidor; os outros dois reaproveitam o `leaf_e2e` já preparado (o usuário `leaf` só tem grant nos bancos existentes) e por isso não preparam nada. O `DATABASE_URL` é injetado no processo filho, então o `.env.local` do dev nunca é usado pela sandbox.

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
| `ARVORE_SSO_CLIENT_ID` / `ARVORE_SSO_CLIENT_SECRET` / `ARVORE_SSO_ISSUER` | habilitam o botão "Entrar com a conta Árvore"; sem o client id, o provider não é registrado e a tela continua sendo o formulário de email e senha. O issuer padrão é `https://auth.arvore.com.br/api-arvore` |
| `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET` / `NOTION_REDIRECT_URI` | habilitam o import por link do Notion; sem elas o caminho fica desligado e o diálogo diz isso. Em produção o redirect é `https://leaf.arvore.com.br/api/notion/callback` |
| `NOTION_API_VERSION` | versão da API do Notion no cabeçalho `Notion-Version` (padrão `2022-06-28`) |
| `LEAF_MCP_ENABLED` | liga o servidor MCP remoto e o authorization server OAuth 2.1 embutido (`/api/mcp`, `/api/auth/oauth2/*`, `/.well-known/*`). Ausente = ligado fora de produção e **desligado em produção**; desligado, tudo isso responde 404 e a tela de aplicativos conectados some |
| `LEAF_MCP_WRITE` | com o MCP ligado, permite as tools de escrita (`create_document`, `update_document`). Ausente = ligado; `0`/`false`/`off` desliga a escrita por completo, mesmo para tokens com o escopo `leaf:write` |

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

## MCP

O Leaf expõe um servidor [MCP](https://modelcontextprotocol.io) remoto em
`${BETTER_AUTH_URL}/api/mcp` (transporte Streamable HTTP, stateless) protegido
por OAuth 2.1 — e o próprio Leaf é o authorization server, via o plugin
`@better-auth/oauth-provider` mais o plugin `jwt` do better-auth. Nenhum serviço
externo participa: qualquer instalação do Leaf tem o MCP funcionando só com o
que vem neste repositório e a flag `LEAF_MCP_ENABLED`.

Como funciona, em ordem: o cliente MCP recebe `401` com
`WWW-Authenticate: Bearer resource_metadata=...`, lê
`/.well-known/oauth-protected-resource` e `/.well-known/oauth-authorization-server`,
registra-se sozinho em `/api/auth/oauth2/register` (registro dinâmico, sempre
client **público** com PKCE S256; redirect só `https`, ou `http` em
`localhost`/`127.0.0.1`/`[::1]` para clientes de linha de comando), manda a
pessoa para o login do Leaf e para a tela de consentimento em `/oauth/consent`,
e troca o código por um access token JWT de 15 minutos (`aud` =
`${BETTER_AUTH_URL}/api/mcp`, assinado com a chave EdDSA guardada na tabela
`jwks`) mais um refresh token rotativo. Cada chamada de tool roda em nome da
pessoa que autorizou, com a mesma ACL da interface (`src/lib/authz.ts`): quem
não enxerga um documento no Leaf também não enxerga pelo MCP.

Escopos: `leaf:read` (busca, leitura de documentos, bases, comentários e
organizações), `leaf:write` (`create_document`, `update_document`; sem o escopo
as tools nem são registradas) e `offline_access` (refresh token). A pessoa vê e
revoga os aplicativos autorizados em **Aplicativos conectados**, no menu da
conta (`/connected-apps`); revogar apaga o consentimento e invalida os refresh
tokens daquele cliente.

Tools: `search_documents`, `get_document`, `list_documents`,
`list_organizations`, `get_database`, `list_comments`, `create_document`,
`update_document` (append/replace, recusa escrever se a página foi editada nos
últimos 15 s — provavelmente há uma sala de colaboração aberta — e usa guard
otimista no `updated_at`). Nada de apagar, compartilhar, link público ou
membros. Limites: body até 1 MB, 60 chamadas/min por pessoa, até 50 resultados
por chamada, markdown até 400 mil caracteres.

Como conectar (troque `https://leaf.exemplo.org` pela `BETTER_AUTH_URL` da sua
instalação):

- **Claude (web e desktop)**: Configurações → Conectores → Adicionar conector
  personalizado → URL `https://leaf.exemplo.org/api/mcp`. O Claude registra o
  client e abre a tela de login e consentimento do Leaf.
- **Claude Code**: `claude mcp add --transport http leaf https://leaf.exemplo.org/api/mcp`
  e depois `/mcp` dentro do Claude Code para autenticar (o callback é em
  `http://localhost`, por isso o loopback fica liberado no registro).
- **Cursor**: em `.cursor/mcp.json` (ou nas configurações de MCP),
  `{ "mcpServers": { "leaf": { "url": "https://leaf.exemplo.org/api/mcp" } } }`;
  o Cursor abre o fluxo OAuth na primeira chamada.
- **Inspector**: `npx @modelcontextprotocol/inspector` → transporte Streamable
  HTTP → URL acima → Connect. Para testar localmente use
  `BETTER_AUTH_URL=http://localhost:3000` e o `pnpm dev`.

O modo antigo do pacote `@arvoretech/leaf-mcp` (stdio falando direto com o
MySQL) fica só para desenvolvimento contra um banco de dev; em produção o
caminho é este endpoint.

**Banco**: o database `leaf` está provisionado no cluster Aurora MySQL da Árvore (`arvore-cluster`, MySQL 8.0.42), com usuário dedicado no Secrets Manager (`prd/leaf/database`). As migrações de `drizzle/mysql` rodam no boot do app; o `next build` **não** toca no banco. As sete migrações antigas de SQLite ficaram arquivadas em `drizzle/sqlite-legacy/` e não são mais executadas.

## Qualidade

Construído em 12 ondas com fechamento validado, mais o port para MySQL, a onda de autenticação restrita e a do login pelo SSO da Árvore: **274 testes unitários**, **52 cenários E2E** (desktop, mobile, colaboração em dois navegadores, domínio restrito e SSO), build de produção verde e design review do Bonsai com bloqueantes zerados nos dois temas.

---

Feito com o [Bonsai Design System](https://designsystem.arvore.dev) · Árvore Educação
