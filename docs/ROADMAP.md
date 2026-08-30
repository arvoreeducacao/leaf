# Leaf — Roadmap das ondas restantes

Estado: ondas 1-7 entregues (fundação, editor BlockNote, sharing, markdown, QA, import do Notion + hierarquia, polimento + E2E versionado, dark/claro + i18n pt-BR/en-US, organizações + import agnóstico via slash menu). Detalhes e decisões acumuladas em `INTEGRATION-NOTES.md`.

Regras de toda onda: i18n pt-BR/en-US com paridade de chaves; dark/claro AA; tokens semânticos (nunca classe de paleta literal); ícones de `@/components/icons`; sem comentários no código; build + vitest + `pnpm test:e2e` + design-review (corrigir bloqueantes) + commit local por onda; feature só entra íntegra.

## Onda 8 — Histórico de versões
- `document_versions` (id, document_id, content, title, author_id, created_at). Snapshot no autosave com throttle (máx. 1 a cada 5 min por autor) + ao importar/restaurar. Retenção: últimas 50 (poda no insert).
- Menu do documento → "Histórico de versões": painel/Sheet com lista (data relativa + autor), preview read-only (DocumentRenderer) e restaurar (gera versão do estado atual antes). Owner/editor veem; viewer não.
- Testes: throttle, poda, restauração round-trip.

## Onda 9 — Comentários + papel "Pode comentar"
- `comments` (id, document_id, block_id nullable, author_id, body, resolved_at, parent_id p/ resposta 1 nível, created_at).
- Papel 'commenter' em document_shares.role e org_access: viewer < commenter < editor; authz + testes; opção nos selects do modal Compartilhar.
- Painel lateral (Sheet mobile): threads, resolver/reabrir, responder; âncora em bloco a partir da seleção (botão na toolbar), clique rola e destaca; bloco apagado vira "sem âncora". Comentar exige commenter+; editar/excluir só autor; resolver: autor ou editor+.

## Onda 10 — Busca full-text
- SQLite FTS5 (title + texto plano do content, sync no save; extração de texto testada).
- Cmd/Ctrl+K abre command palette (componente command do DS) buscando nos docs acessíveis (authz obrigatório no server) com trecho destacado. Busca da sidebar continua como filtro rápido.
- Teste: doc privado de terceiro nunca aparece.

## Onda 11 — Teamspaces + múltiplas orgs por usuário
- `teamspaces` (org_id, name, access open|closed) + `teamspace_members` (role owner|member); `documents.teamspace_id` nullable; membros herdam acesso; open = qualquer membro da org entra/vê, closed = só convidados.
- Sidebar: seção por teamspace; gestão em /org. Remover limite de 1 org por usuário: switcher de org na sidebar (cookie da org ativa).
- Precedência: owner > share > teamspace > org_access > público; testes.

## Onda 12 — Colaboração em tempo real (a mais pesada, por último)
- Yjs + BlockNote collaboration; websocket local (y-websocket, porta 1234) subindo no `pnpm dev`; room = document id com authz no handshake.
- Snapshot do Yjs pro documents.content no autosave (compatível com export/versões). Presença/cursores com cores da paleta Bonsai.
- Flag env LEAF_REALTIME (fallback pro modo atual se o ws não subir). E2E com duas sessões convergindo.

## Fora de escopo (decidido)
Envio real de e-mail (convite resolve no login), apps nativos, API pública.

## Pendências upstream (PRs no arvore-design-system — precisam de aprovação do Guilherme)
Ver seção correspondente do `INTEGRATION-NOTES.md`: escala alpha-inverse + mapeamento dark + sombras de elevation p/ fundo escuro + border-focus/ring (primary-500 reprova 1.4.11); border-strong gray-600 nas cópias; Dialog como bottom sheet até tablet; Search h-11 mobile; contraste do variant destructive.
