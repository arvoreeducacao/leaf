# Integration notes

Registro de decisões da fundação e pontos de contato entre as ondas. Conflito de
necessidade entre agents: registre aqui em vez de editar arquivo de outro dono.

## Decisões da onda 1 (fundação)

- Produto renomeado de Folhas para **Leaf** durante a onda 1. Repo em
  `/home/guilherme/dev/arvore-hub/leaf`, DB em `data/leaf.db`, bucket
  `leaf-uploads`.
- `better-auth@1.7.2` exige a coluna `issuer` na tabela `account` (mudança da
  1.7). O CLI público `@better-auth/cli@latest` ainda gera o schema antigo, então
  o `src/db/schema.ts` foi escrito à mão a partir de `getAuthTables()` do runtime.
- O caminho do SQLite é fixo (`<cwd>/data/leaf.db`). Caminho vindo de env fazia o
  Turbopack tracear o projeto inteiro no build (warning de "dynamic filesystem
  access"). Não reintroduza `DATABASE_PATH`.
- As migrações são aplicadas no boot pelo `src/db/index.ts` (drizzle migrator).
  Depois de mexer no schema: `pnpm db:generate` e reinicie o dev server.
- `src/components/ui/sidebar.tsx` do design system **não** foi copiado: ele
  assume um header fixo de 56/70px e usa `100vh`. A sidebar do Leaf é composta à
  mão em `src/components/app/app-shell.tsx` (aside no desktop, Sheet no mobile).
- `globals.css` foi copiado do design system e limpo: fora as cores fora da
  paleta do frontmatter, a escala de sombra em preto puro, os pesos 600, os
  breakpoints divergentes e o CSS morto de outros apps. A escala `warning-50..950`
  foi **adicionada** (o globals.css do DS só tinha os nomes legados).
- `lucide-react` não é dependência. Os dois ícones lucide que vinham no
  `dialog.tsx` e no `sidebar.tsx` do DS foram trocados por ícones de
  `@/components/icons`.

## Contratos entre ondas

### Editor (onda 2)

- Dono de `src/components/editor/**` e da integração em
  `src/app/(app)/doc/[id]/**`.
- `EditorPlaceholder` já recebe as props que o editor precisa:
  `{ documentId: string; initialContent: string | null; readOnly: boolean }`.
  Mantenha a assinatura ou ajuste também a chamada em
  `src/app/(app)/doc/[id]/page.tsx`.
- Persistência: `updateDocumentContent(id, contentJSON)` em
  `src/lib/document-actions.ts` (já passa por `authz.ts`, exige `editor`).
- Upload de imagem: `POST /api/uploads` com `FormData` campo `file`, responde
  `{ url: "/api/uploads/u/<id>.<ext>" }`. Limite 5 MB, só `image/*`.

### Sharing (onda 3)

- Dono de `src/components/sharing/**`, `src/app/share/**`,
  `src/lib/share-actions.ts`; pode estender `src/lib/authz.ts`.
- `ShareButton` recebe `{ documentId: string; canShare: boolean }` e hoje só
  renderiza para o dono. Chamado em `src/components/app/document-header.tsx`.
- `src/lib/authz.ts` já tem `getDocumentAccess`, `getTrashedDocumentAccess`,
  `canEdit`, `atLeast` e `getPublicDocument(token)` para o caminho do
  `public_token`. A rota `/share/[token]` **não** foi criada pela fundação.
- Tabela `document_shares` já existe com unique `(document_id, grantee_email)`.
  A resolução por email é sempre em lowercase.

### Markdown (onda 4)

- Dono de `src/lib/markdown/**`, `src/components/app/document-menu.tsx`,
  `src/components/app/import-button.tsx`,
  `src/app/api/documents/[id]/export/**`.
- `DocumentMenu` recebe `{ documentId: string; canDelete: boolean }`. Já tem o
  item "Exportar" desabilitado e o "Mover para a lixeira" funcionando; ao ligar o
  export, preserve o item da lixeira.
- `ImportButton` hoje é um botão desabilitado com tooltip "Em breve", usado na
  sidebar (`app-shell.tsx`). Não mude o nome do export.
- A rota de export não existe ainda; `getDocumentAccess` deve ser aplicado nela.

## Onda 2 — Sharing (entregue)

- Arquivos criados/alterados: `src/lib/share-actions.ts`,
  `src/components/sharing/share-button.tsx` (placeholder substituído),
  `src/components/sharing/share-panel.tsx`, `src/app/share/layout.tsx`,
  `src/app/share/[token]/page.tsx`, `src/app/share/not-found.tsx`,
  `src/lib/authz.ts` (estendido) e `src/lib/authz.test.ts`.
- `src/app/share/[token]/page.tsx` importa `DocumentRenderer` de
  `@/components/editor/document-renderer` (contrato `{ content: string | null }`).
  O arquivo não existia no meio desta onda e o typecheck acusava TS2307; o agent
  do editor entregou o componente antes do fim e `pnpm exec tsc --noEmit` fecha
  limpo (zero erros).
- `ShareButton` mantém a assinatura `{ documentId, canShare }` e continua sendo
  chamado como está em `src/components/app/document-header.tsx` (nenhuma mudança
  necessária lá). Ele agora renderiza **também** para editor/viewer, que veem o
  modal em modo leitura (só a lista de quem tem acesso). `canShare` deixou de
  esconder o botão: virou só uma dica de layout repassada ao `SharePanel` como
  `canManage` (formato do skeleton de carregamento). Quem manda de verdade é o
  papel devolvido pelo servidor em `loadShareState`.
- Item "convidado vê o doc na sidebar" já estava atendido pela fundação
  (`listSharedDocuments` por `grantee_email` + seção "Compartilhados comigo" no
  `app-shell.tsx`). Nada foi alterado nesses arquivos.
- `authz.ts` ganhou `canManageShares`, `isPublicTokenShaped`,
  `registerPublicLookupAttempt`, `resetPublicLookupLimiter` e
  `lookupPublicDocument`. O rate limit é in-memory (30 lookups por chave a cada
  60s, chave = primeiro IP de `x-forwarded-for` ou `x-real-ip`), por processo:
  não sobrevive a restart nem escala para múltiplas instâncias. `getPublicDocument`
  continua existindo e não mudou de assinatura.
- `enablePublicLink` sempre gera um token novo (`nanoid(24)`); desativar grava
  `null`, ou seja, reativar **revoga** o link anterior de propósito.
- `vitest.config.mts` foi criado na raiz (alias `@` → `src`, `include`
  `src/**/*.test.ts`, `environment: 'node'`). O `vitest` em si já tinha sido
  adicionado ao `package.json` pela onda do markdown. `src/lib/authz.test.ts`
  usa `vi.mock('@/db')` com SQLite `:memory:` migrado a partir dos `.sql` de
  `drizzle/`, então não toca o `data/leaf.db`.
- Ressalvas do design-review que ficaram em aberto de propósito: desativar o
  link público não tem modal de confirmação (o aviso "desativar invalida o link
  atual para sempre" fica visível antes da ação, e remover convidado tem
  "Desfazer" no toast); e o `cn` de `src/shared/utils` é `twMerge` sem
  `extendTailwindMerge`, então classe `text-<token>` passada via `className` para
  componente shadcn é tratada como cor e perde para o `text-sm` da base. O
  segundo item é do dono de `src/shared/utils` resolver; aqui foi contornado não
  combinando tamanho e cor no mesmo `className`.

## Onda 2 — Markdown (entregue)

- Arquivos criados/alterados: `src/lib/markdown/convert.ts`,
  `src/lib/markdown/sanitize.ts`, `src/lib/markdown/filename.ts`,
  `src/lib/markdown/limits.ts`, `src/lib/markdown/import-action.ts`,
  `src/lib/markdown/convert.test.ts`,
  `src/app/api/documents/[id]/export/route.ts`,
  `src/components/app/import-button.tsx` e
  `src/components/app/document-menu.tsx` (placeholders substituídos, assinaturas
  `ImportButton()` e `DocumentMenu({ documentId, canDelete })` preservadas).
- Dependências adicionadas por esta onda: `@blocknote/core`,
  `@blocknote/server-util` (0.54.0) e os peers opcionais `y-prosemirror` e
  `y-protocols`, que o `dist/yjs.js` do core importa de forma incondicional (sem
  eles o import do `ServerBlockNoteEditor` quebra com `ERR_MODULE_NOT_FOUND`).
  **Atenção:** alguma outra onda moveu `y-prosemirror`, `y-protocols` e `yjs`
  para `devDependencies`. Eles são usados em runtime no servidor (rota de export
  e server action de import), então precisam voltar para `dependencies` antes de
  qualquer build de produção.
- A conversão roda toda no servidor via `ServerBlockNoteEditor.create()`
  (`tryParseMarkdownToBlocks`, `blocksToMarkdownLossy`, `blocksToHTMLLossy`), com
  uma instância única em módulo. O `server-util` sobe um JSDOM interno.
  **Pendência que não posso resolver** (não sou dono do arquivo): se o
  `next build` reclamar de `jsdom`, `next.config.ts` precisa de
  `serverExternalPackages: ['@blocknote/server-util', 'jsdom']`. Não rodei build
  nesta onda (proibido durante as ondas paralelas), então isso não foi validado.
- API pública de `src/lib/markdown/convert.ts`: `markdownToContent(md)`,
  `contentToMarkdown(content)`, `contentToHTML(content, title?)` e
  `parseContentBlocks(content)` (esse último devolve blocos já sanitizados e é
  útil para qualquer render server-side).
- Sanitização (XSS) em `src/lib/markdown/sanitize.ts`, aplicada nos **dois**
  sentidos: `sanitizeMarkdown` tira script/style/iframe/object/embed, handlers
  `on*` e URLs de esquema perigoso do markdown cru (preservando o conteúdo de
  code fences e code spans), e `sanitizeBlocks` percorre a árvore de blocos
  zerando `url`/`href`/`src` fora de http/https/mailto/relativo. O BlockNote já
  descarta link com `javascript:`, mas **não** descarta `url` de bloco de imagem:
  esse era o furo real e é o que o `sanitizeBlocks` fecha.
- Export: `GET /api/documents/[id]/export?format=md|html`, com
  `getDocumentAccess` (qualquer papel com acesso serve; link público **não**
  entra, por decisão do escopo) e `Content-Disposition: attachment`. No formato
  `md` o título do documento é prefixado como `# Título`, já que no modelo de
  dados o título vive fora do `content`.
- `DocumentMenu` faz o download por `fetch` + blob em vez de
  `window.location.href` (que a spec sugeria): com navegação direta, um 404 da
  rota jogava o usuário numa página de texto puro fora do app. Agora há
  `toast.promise` com loading e erro. O item "Mover para a lixeira" continua
  intacto.
- `ImportButton` aceita `.md`, `.markdown`, `.mdown` e `.mkd`, por file picker ou
  arrastando o arquivo em cima do botão, com limite de 2 MB checado no cliente e
  de novo no servidor (`MAX_MARKDOWN_BYTES` em `src/lib/markdown/limits.ts`).
- Colar markdown dentro do editor é nativo do BlockNote; nada foi feito no editor
  e nenhuma lacuna foi observada do lado do servidor.
- `package.json` ganhou o script `"test": "vitest run"`. O `vitest.config.ts` que
  eu tinha criado foi removido em favor do `vitest.config.mts` da onda de
  sharing, que é equivalente.

## Onda 2 — Editor (entregue)

- Arquivos criados: `src/components/editor/{editor.css, dictionary.ts,
  callout-block.tsx, schema.ts, types.ts, content.ts, upload-file.ts,
  slash-menu-items.tsx, save-indicator.tsx, editor-skeleton.tsx,
  block-note-editor.tsx, document-editor.tsx, block-note-renderer.tsx,
  document-renderer.tsx, content.test.ts, schema.test.ts}`.
  `editor-placeholder.tsx` foi removido e `src/app/(app)/doc/[id]/page.tsx`
  agora usa `DocumentEditor` com as mesmas props
  (`{ documentId, initialContent, readOnly }`).
- Dependências adicionadas: `@blocknote/react@0.54.0` e
  `@blocknote/shadcn@0.54.0` (mesma linha do `core`/`server-util` que a onda do
  markdown já tinha posto). Nada de `@blocknote/mantine`.
- **Tema Bonsai sem `shadCNComponents`:** o `BlockNoteView` do
  `@blocknote/shadcn` roda com os componentes que vêm no pacote, e não com os de
  `src/components/ui/**`. Motivo concreto: na 0.54 o pacote migrou para
  `@base-ui/react`, então o `Button` dele tem sizes `xs/icon-xs/icon-sm/icon-lg`
  e o `Select` é `SelectRoot` do base-ui; passar nossos componentes Radix não
  typecheca, e a doc do BlockNote ainda exige componentes **sem Portal**
  (o nosso `dropdown-menu`/`popover`/`select`/`tooltip` usa Portal do Radix).
  Isso não custa o visual: os componentes internos consomem `--popover`,
  `--muted`, `--border`, `--primary`, `--accent`, `--radius` etc., que o
  `globals.css` do Leaf já mapeia para tokens Bonsai. Se um dia alguém quiser
  trocar, precisa forkar os componentes sem Portal dentro de
  `src/components/editor/`.
- **`globals.css` não foi tocado.** O `@blocknote/shadcn` precisa que o Tailwind
  gere as utilities usadas dentro do pacote, o que normalmente pede um
  `@source ".../node_modules/@blocknote/shadcn"` no entry do Tailwind. Em vez de
  editar arquivo de outro dono, `src/components/editor/editor.css` é um segundo
  entry do Tailwind:
  `@reference "../../app/globals.css"` (puxa o tema Bonsai sem emitir CSS) +
  `@import "tailwindcss/utilities.css" layer(utilities) source(none)` +
  `@source "../../../node_modules/@blocknote/shadcn"`. Validado rodando o
  `@tailwindcss/postcss` na mão sobre o arquivo (gera ~56 KB, sem preflight
  duplicado, com `bg-popover`/`text-muted-foreground`/`shadow-md` etc.).
  **Não apague essas três linhas do topo do `editor.css`**: sem elas o editor
  perde o estilo dos menus.
  Consequência do `@reference`: nesse arquivo `var(--color-gray-900)` **não**
  funciona (o `@theme` do globals é `inline`, os tokens são inlinados e só os
  tokens efetivamente referenciados chegam ao `:root`). Por isso o `editor.css`
  usa `@apply` para tudo que é utility e só as vars semânticas declaradas
  literalmente no `:root` do globals (`--background`, `--card-foreground`,
  `--popover`, `--muted`, `--accent`, `--border`, `--radius`...) para alimentar
  as `--bn-*` do BlockNote.
- **`leafSchema` (`src/components/editor/schema.ts`) é o schema compartilhado:**
  `defaultBlockSpecs` + bloco custom `callout` (o BlockNote 0.54 não tem callout
  nativo). O arquivo é server-safe de propósito (sem `'use client'`), então a
  onda do markdown pode passar `leafSchema` para o `ServerBlockNoteEditor` e o
  callout sobrevive ao import/export. Hoje `src/lib/markdown/convert.ts` cria o
  `ServerBlockNoteEditor` sem schema, ou seja, **um callout exportado vira
  parágrafo/bloco desconhecido**. `src/components/editor/schema.test.ts` já
  prova que `ServerBlockNoteEditor.create({ schema: leafSchema })` funciona e
  converte `#`, `-`, `1.`, `- [ ]`, `>` e ``` ``` ``` nos blocos certos.
  O `toExternalHTML` do callout emite `<blockquote>`, então o export degrada
  para citação em vez de sumir. **Ressalva medida:** num probe local,
  `blocksToMarkdownLossy`/`blocksToHTMLLossy` de um bloco `callout` devolveu
  conteúdo (o teste passou), mas o `react-dom` soltou erros de teardown no JSDOM
  (`Cannot read properties of undefined (reading 'event')`). Antes de passar
  `leafSchema` para o `ServerBlockNoteEditor` da rota de export, confirme que
  isso não vira ruído/erro no servidor.
- `DocumentRenderer` (`src/components/editor/document-renderer.tsx`) entregue com
  a assinatura combinada `{ content: string | null }`, read-only e com todos os
  menus de edição desligados. É o que `/share/[token]` usa.
- Persistência: autosave com debounce de 1s em
  `src/components/editor/use-autosave.ts`, chamando `updateDocumentContent`.
  Flush no `blur` do editor e no `visibilitychange` para `hidden`; o
  `beforeunload` só avisa quando ainda há alteração não salva (não dá para
  garantir server action no unload). Indicador "Salvando/Salvo/Alterações não
  salvas/Não foi possível salvar" fica dentro do próprio componente do editor,
  acima do conteúdo. O `document-header.tsx` não foi tocado.
- Dicionário: `pt` do `@blocknote/core/locales` com override em
  `src/components/editor/dictionary.ts` (o `pt` do pacote usa Title Case, que o
  Bonsai não aceita, e falta a chave `placeholders.emptyDocument`). Placeholder
  do documento vazio: "Digite / para comandos".
- Slash menu: itens default filtrados (grupos "Mídia" e "Outros" saem, menos
  "Imagem") mais o item "Destaque" do callout. Os blocos `audio`, `video` e
  `file` continuam **no schema** (para não quebrar conteúdo vindo de import),
  só não aparecem no menu.
- Upload de imagem: `uploadFile` do editor chama `POST /api/uploads` e mostra
  `toast.error` em pt-BR no erro (`src/components/editor/upload-file.ts`).
- `@blocknote/shadcn` traz `lucide-react` como dependência própria. Nenhum
  arquivo nosso importa lucide; o gate continua valendo para código do Leaf.
- **Estrago que eu causei e consertei, para ninguém repetir:** duas ondas rodaram
  `pnpm add` ao mesmo tempo e o `package.json` foi sobrescrito, o que deixou
  `@blocknote/react`/`shadcn` fora dele e o pnpm resolveu **duas cópias** de
  `@blocknote/core` (uma com peer `y-prosemirror`, outra só com `yjs`) — o tsc
  acusava "separate declarations of a private property 'opts'". No meio do
  diagnóstico eu removi `y-prosemirror`, `y-protocols` e `yjs` do
  `package.json`; eles **voltaram para `dependencies`**, que é onde a onda do
  markdown precisa deles. Hoje `core`, `react`, `shadcn` e `server-util`
  apontam todos para a mesma instância de `@blocknote/core`. Se alguém tornar a
  mexer em deps, confira com
  `readlink -f node_modules/@blocknote/{core,react,shadcn,server-util}/../core`.
- Não rodei `pnpm build` nem `pnpm dev` (regra das ondas paralelas), então **o
  editor não foi aberto em navegador**. O que foi verificado: `tsc --noEmit`
  limpo, `vitest run` verde e a compilação do `editor.css` pelo
  `@tailwindcss/postcss`. Falta teste manual de: menus flutuantes do BlockNote
  em mobile, drag handle, upload de imagem de ponta a ponta e o autosave real.
- Deixado de propósito com o default da lib: a paleta de "cor de texto/fundo" do
  BlockNote (`--bn-colors-highlights-*`), porque é cor de conteúdo escolhida pelo
  usuário e o Bonsai não tem equivalente para marrom/rosa. Só o cinza foi
  remapeado para `--muted`.

## Pendências conhecidas

- `src/lib/markdown/convert.ts` cria o `ServerBlockNoteEditor` sem
  `schema: leafSchema`; enquanto isso, callout não sobrevive ao import/export
  (ver a seção do editor acima).
- `next.config.ts` pode precisar de `serverExternalPackages` por causa do JSDOM
  do `@blocknote/server-util`; não validado porque `pnpm build` não foi rodado.
- Export de markdown/HTML não passa pela rota pública `/share/[token]`, só pelo
  app autenticado.
- O rate limit do link público é por processo e sem persistência; em produção
  com mais de uma instância precisa migrar para um store compartilhado.
- Não há e-mail de convite: convidar só grava a linha em `document_shares`, e o
  acesso resolve quando a pessoa loga com aquele email.
- Fora `src/lib/authz.test.ts`, o resto do app segue sem testes automatizados.
