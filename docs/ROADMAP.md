# Leaf — Roadmap das ondas restantes

Estado: ondas 1-12 entregues (fundação, editor BlockNote, sharing, markdown, QA, import do Notion + hierarquia, polimento + E2E versionado, dark/claro + i18n pt-BR/en-US, organizações + import agnóstico via slash menu, histórico de versões, comentários + papel "Pode comentar", busca full-text + command palette, teamspaces + múltiplas organizações por pessoa, colaboração em tempo real). Detalhes e decisões acumuladas em `INTEGRATION-NOTES.md`.

**Onda final de validação + fix: ENTREGUE em 2026-08-31.** Ver a seção "Validação consolidada" no fim deste arquivo e a seção correspondente do `INTEGRATION-NOTES.md`.

Regras de toda onda: i18n pt-BR/en-US com paridade de chaves; dark/claro AA; tokens semânticos (nunca classe de paleta literal); ícones de `@/components/icons`; sem comentários no código; build + vitest + `pnpm test:e2e` (cap de 15 min) + commit local por onda; feature só entra íntegra.

DECISÃO DO GUILHERME (2026-08-31): design-review POR ONDA está suspenso a partir da onda 10 — as ondas fecham sem review para ganhar velocidade, e UM ÚNICO design-review consolidado roda ao final da onda 12 cobrindo tudo que mudou desde então, com os bloqueantes corrigidos numa onda de fix dedicada.

DECISÃO DO GUILHERME (2026-08-31, ampliada): a partir da onda 11, TAMBÉM ficam fora do fechamento por onda a suíte vitest, o `pnpm test:e2e` e o `pnpm build` — a onda fecha só com `tsc --noEmit` limpo + commit. Toda a validação (vitest + E2E + build de produção + design-review consolidado) roda de uma vez na ONDA FINAL DE VALIDAÇÃO após a 12, seguida da onda de fix.

## Onda 8 — Histórico de versões (entregue)
- `document_versions` (id, document_id, content, title, author_id, created_at). Snapshot no autosave com throttle (máx. 1 a cada 5 min por autor) + ao importar/restaurar. Retenção: últimas 50 (poda no insert).
- Menu do documento → "Histórico de versões": painel/Sheet com lista (data relativa + autor), preview read-only (DocumentRenderer) e restaurar (gera versão do estado atual antes). Owner/editor veem; viewer não.
- Testes: throttle, poda, restauração round-trip.

## Onda 9 — Comentários + papel "Pode comentar" (entregue)
- `comments` (id, document_id, block_id nullable, author_id, body, resolved_at, parent_id p/ resposta 1 nível, created_at).
- Papel 'commenter' em document_shares.role e org_access: viewer < commenter < editor; authz + testes; opção nos selects do modal Compartilhar.
- Painel lateral (Sheet mobile): threads, resolver/reabrir, responder; âncora em bloco a partir da seleção (botão na toolbar), clique rola e destaca; bloco apagado vira "sem âncora". Comentar exige commenter+; editar/excluir só autor; resolver: autor ou editor+.

## Onda 10 — Busca full-text (entregue)
- SQLite FTS5 (title + texto plano do content, sync no save; extração de texto testada). *Portado para `FULLTEXT` do MySQL no port de banco de 2026-08-31.*
- **Atalhos: Cmd/Ctrl+K E Alt/Option+K** abrem a command palette (toggle; Esc fecha). Cmd+P da sidebar continua como filtro rápido.
- UX de referência (pedido do usuário): a barra de comando estilo Arc/Notion e a busca do backoffice — LER `frontend-arvore-nextjs/src/app/[locale]/(authenticated)/backoffice-v2/_components/command-palette.tsx` como referência de estrutura (overlay centrado no topo, input grande, resultados em seções, itens com ícone + título + trecho/caminho, navegação por setas + Enter, detecção de Mac pra exibir ⌘K vs Ctrl+K, documentos recentes quando a query está vazia). Reimplementar com componente command do DS e tokens semânticos do Leaf — sem copiar lucide/estilos de lá.
- Seções da palette do Leaf: Recentes (query vazia), Documentos (FTS com trecho destacado), Ações rápidas (Novo documento, Ir para Organização, Importar).
- Busca só nos docs acessíveis (authz obrigatório no SERVER). Teste: doc privado de terceiro nunca aparece.

## Onda 11 — Teamspaces + múltiplas orgs por usuário (entregue)
- Migração `0006`: `teamspaces` (org_id, name, access open|closed) + `teamspace_members` (role owner|member) + `documents.teamspace_id`. Membro do teamspace herda **editor**; teamspace aberto dá **viewer** para qualquer membro da org (que também pode entrar); fechado não dá nada para quem não foi convidado.
- Precedência implementada em `authz.ts`: dono > share explícito > teamspace > org_access > público, com 13 testes novos em `src/lib/teamspace-authz.test.ts`.
- Sidebar: switcher de organização no topo (cookie `leaf-active-org`) + seção "Teamspaces" acima de "Organização", com entrar em teamspace aberto e criar. Gestão completa em `/org` (criar, renomear, trocar acesso, membros, excluir vazio). Menu do documento ganhou "Mover para teamspace".
- Limite de 1 org por pessoa removido: convites de várias orgs resolvem todos; ações de org agem sobre a org ativa.
- **Decisão registrada:** a busca FTS/command palette **não** filtra pela org ativa — devolve tudo que a pessoa acessa (inclusive docs de teamspace), que é o caminho mais simples e o que o Cmd+K de fato promete.
- Modo ultra-rápido: fechou com `tsc --noEmit` limpo + os arquivos de teste tocados (authz, teamspace-authz, documents, search-index) verdes. Sem vitest completo, E2E, build ou design-review — tudo isso na onda final de validação.

## Onda 12 — Colaboração em tempo real (entregue)
- Yjs + `withCollaboration` do BlockNote 0.54; provider `y-websocket`; servidor ws próprio em `scripts/dev-realtime.mjs` (porta 1234) subindo junto no `pnpm dev`. Room = `doc:{id}`.
- **Authz no handshake**: o servidor ws repassa o cookie de sessão do navegador para `POST /api/realtime/authz`; sem acesso a conexão é fechada com 4403 (código permanente, o cliente não fica reconectando). Read-only (viewer/commenter) conecta mas o servidor **descarta** os updates dele — não é só a UI.
- **Um único escritor**: o servidor ws é o dono do `documents.content` enquanto a sala está aberta (throttle de 3 s + save final ao esvaziar a sala, com retentativas). O autosave do cliente fica desligado em modo colaborativo. O snapshot passa pelo mesmo `persistDocumentContent` do autosave, então o guard de no-op, as versões da onda 8 e o índice FTS continuam valendo.
- **Semente**: o servidor decide — na primeira conexão da sala ele pede `POST /api/realtime/seed`, que converte `documents.content` em update do Yjs. Cliente nenhum semeia (duas sementes duplicariam o `blockgroup`, coberto por teste).
- Presença/cursores com paleta Bonsai derivada do id da pessoa e do tema local (`renderCursor` próprio), indicador de presença no header do documento.
- Flag `LEAF_REALTIME` (ligada por padrão fora de produção; em produção exige opt-in). Com o ws fora do ar o editor cai no modo atual em ~2,5 s, com autosave normal.
- Verificação manual (dois contextos Playwright): convergência do texto, cursores com nome, "2 pessoas neste documento", persistência conferida direto no banco, viewer bloqueado no servidor e fallback com o ws inacessível. Detalhes e pendências em `INTEGRATION-NOTES.md`.

## Fora de escopo (decidido)
Envio real de e-mail (convite resolve no login), apps nativos, API pública.

## ~~Pendências upstream (PRs no arvore-design-system — precisam de aprovação do Guilherme)~~ — CANCELADO
~~Ver seção correspondente do `INTEGRATION-NOTES.md`: escala alpha-inverse + mapeamento dark + sombras de elevation p/ fundo escuro + border-focus/ring (primary-500 reprova 1.4.11); border-strong gray-600 nas cópias; Dialog como bottom sheet até tablet; Search h-11 mobile; contraste do variant destructive.~~

**Decisão do usuário 2026-08-31: sem PRs upstream.** As divergências do Leaf em relação ao `arvore-design-system` continuam registradas no `INTEGRATION-NOTES.md` como divergências locais assumidas, e nenhum PR será aberto no design system.

## Port de banco SQLite → MySQL — ENTREGUE em 2026-08-31
Produção é MySQL: o database `leaf` do cluster Aurora (`arvore-cluster`, MySQL 8.0.42) com usuário dedicado no Secrets Manager (`prd/leaf/database`). O app trocou `drizzle-orm/sqlite-core` + `better-sqlite3` por `mysql-core` + `mysql2` (pool, `DATABASE_URL`), ganhou um baseline novo em `drizzle/mysql/` (as sete migrações antigas foram arquivadas em `drizzle/sqlite-legacy/`) e a busca saiu do FTS5 para índices `FULLTEXT` em BOOLEAN MODE, com o trecho destacado extraído em JS. Números e decisões de mapeamento de tipos no `INTEGRATION-NOTES.md`.

- `tsc --noEmit` **limpo**; `vitest run` **242 verdes em 16 arquivos** (eram 239; +3 do `buildSnippet`); `LEAF_DIST_DIR=.next-build pnpm build` **verde**; `pnpm test:e2e` **50 verdes / 1 vermelho (51)**; passe de fumaça manual **8/8** contra o dev server no `leaf_dev`.
- Dois bugs reais de corrida apareceram só com o banco remoto e foram corrigidos: adesão duplicada em `organization_members` quando duas renderizações do layout resolvem o mesmo convite, e o `router.push('/')` da lixeira ainda no ar quando o teste mobile abre a navegação.
- **Vermelho que sobra:** a asserção final de `versions.spec.ts` — o foco não volta para o botão "Ações do documento" depois do `Escape` que fecha o histórico. É devolução de foco do Radix (o diálogo é aberto por um item de menu que sai do DOM no mesmo tick), não o banco; três tentativas de estabilizar pelo teste não resolveram. **Fica para o Guilherme decidir** se corrige na UI.
- **Também para o Guilherme:** com o dev server frio, o handshake do ws estoura o fallback de ~2,5 s, o editor vai para o modo solo e a sala fica aberta e **vazia**; quem entrar depois nessa sala sobrescreve o que o solo gravou. Detalhe no `INTEGRATION-NOTES.md`.

## Autenticação restrita ao domínio da Árvore — ENTREGUE em 2026-08-31

Decisão do Guilherme: **login apenas com a conta da Árvore**. Tudo ligado por
env, para o dev na 3000 e a suíte inteira continuarem como estavam sem a
variável.

- `LEAF_ALLOWED_EMAIL_DOMAINS` (lista por vírgula). Setada: só esses domínios
  criam conta, entram e podem ser convidados. Ausente: comportamento atual.
- Validação **sempre no servidor**, em quatro pontos: hook `before` do
  better-auth em `/sign-up/email` e `/sign-in/email`, `user.create.before`
  (qualquer criação de conta, inclusive OAuth), `session.create.before`
  (qualquer login, inclusive conta de fora criada antes da restrição) e os dois
  pontos de convite (`inviteToDocument` e `inviteToOrganization`).
- **Decisão sobre convites:** com a restrição ativa **não** dá para convidar
  email de fora do domínio — o convite do Leaf é promessa de acesso futuro e um
  convite que o login nunca honraria seria convite morto. O "convidado externo"
  continua existindo como a conta `@arvore.com.br` que não é da organização.
- Google OAuth **preparado e inativo**: `GOOGLE_CLIENT_ID` +
  `GOOGLE_CLIENT_SECRET` registram o provider (com `hd` quando há um único
  domínio) e mostram "Entrar com Google" no login/signup. Sem as envs a UI não
  muda. O `hd` não é tratado como segurança: o email volta a passar pelos hooks.
  Sem client OAuth criado, o fluxo real com o Google **não foi validado**.
- UI: dica do domínio abaixo do campo de email quando a restrição está ativa (só
  o domínio principal, nunca a lista crua), mensagem de erro dedicada, paridade
  pt-BR/en-US. Botão do Google sem ícone — não existe `google` nos 968 ícones e
  lucide/emoji é proibido.
- Testes: `email-domain.test.ts` (14), `auth-domain.test.ts` (7, contra o
  better-auth de verdade + MySQL de teste), `invite-domain.test.ts` (7) e um
  cenário E2E novo no projeto `restricted` (porta 3300, env ativa).
- Detalhes, limites e o que sobra para o Guilherme (entre eles: `.env.example`
  não foi atualizado porque este ambiente bloqueia arquivos `.env*`) no
  `INTEGRATION-NOTES.md`.

## Validação consolidada (2026-08-31) — números finais

Onda final de validação + fix, pagando a dívida das ondas 10-12.

- `pnpm exec tsc --noEmit`: **limpo**, antes e depois dos fixes.
- `pnpm exec vitest run`: **239 testes em 16 arquivos, verdes**, antes e depois.
- `LEAF_DIST_DIR=.next-build pnpm build`: **verde**.
- `pnpm test:e2e`: **45 verdes / 2 vermelhos (47)** no começo → **51 verdes (51)**
  no fim. Os 2 vermelhos eram teste desatualizado e teste frágil, não regressão
  de app; os 4 casos novos são 3 de colaboração em tempo real e 1 de header em
  320px.
- Design-review consolidado das ondas 10-12: veredito **AJUSTES NECESSÁRIOS**,
  com 5 🔴 e 10 🟡. Todos os 🔴 corrigidos, mais 8 dos 🟡.
- Passe de fumaça manual em navegador: **21/21** contra o dev server, incluindo
  colaboração em duas abas, os dois temas, os dois idiomas e 375px/320px.

Bugs reais achados (detalhe no `INTEGRATION-NOTES.md`): `.next-build/` fora do
`.gitignore` derrubando o `next dev` com erro de CSS; header do documento com
683px de scroll horizontal em todo mobile; ring de seleção do editor em 1,65:1;
chip "+N" da presença invisível no escuro; `aria-live` do switcher de
organização desmontado antes de anunciar; `Select` de membro do teamspace preso
depois de erro.

**Fica para o Guilherme decidir:** densidade do header do documento em mobile
(colapsar Badges e ações secundárias no menu ⋯ abaixo de `tablet`) e a devolução
de foco no `Select` de membros do teamspace.
