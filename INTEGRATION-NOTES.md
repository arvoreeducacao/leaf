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

## Onda 3 — Integração e QA (entregue)

- `next.config.ts` ganhou `serverExternalPackages: ['@blocknote/server-util',
  'jsdom']`. Sem isso o `next build` morre em
  `Failed to collect configuration for /api/documents/[id]/export` com
  `TypeError: v4.createContext is not a function`. Confirmado nos dois sentidos.
- Deps: `yjs`, `y-prosemirror` e `y-protocols` já estavam em `dependencies`.
  `@blocknote/{core,react,shadcn,server-util}` resolvem para **uma única**
  instância de `core` (a `..._y-prosemirror@1.3.7_...df1f0992`). Sobraram
  diretórios órfãos de instalações antigas em `node_modules/.pnpm` (uma segunda
  cópia `@blocknote+core@0.54.0_@types+hast@3.0.5_yjs@13.6.32`) que **não** estão
  no lockfile nem linkados; somem num `pnpm install --force`.
- **Callout ⇄ markdown resolvido com dois schemas.** O `leafSchema` (React, via
  `createReactBlockSpec`) continua no cliente. Passá-lo ao
  `ServerBlockNoteEditor` reproduzia o erro de teardown que a onda do editor
  tinha registrado: `_withJSDOM` do `server-util` põe `globalThis.window` só
  durante a chamada e o `createRoot` do `@blocknote/react` agenda um callback de
  passive effects que roda depois, quando `window` já voltou a ser `undefined`
  (`schedulerEvent = window.event` → `TypeError: Cannot read properties of
  undefined (reading 'event')`). Isso é **uncaught exception no processo do
  servidor**, não só ruído de teste.
  Solução: `src/components/editor/callout-config.ts` guarda o config
  compartilhado (type/content/propSchema) e existe uma segunda implementação
  **sem React** em `src/components/editor/server-schema.ts` (`leafServerSchema`,
  via `createBlockSpec` com DOM puro). `src/lib/markdown/convert.ts` usa o schema
  do servidor. Resultado medido: `vitest run` sem nenhum unhandled error e
  export real pela rota devolvendo `> Leia com atenção` no markdown e
  `<blockquote>` no HTML. `schema.test.ts` tem um teste que trava a paridade de
  tipos entre os dois schemas.
- **Color picker: botão removido, não remapeado.** A `FormattingToolbar` virou
  custom em `src/components/editor/formatting-toolbar.tsx` (tudo do default menos
  o `ColorStyleButton`). Motivo: as cores aplicadas do BlockNote **não** vêm das
  `--bn-colors-highlights-*` (essas só pintam os swatches do menu); os valores
  reais são ~18 regras com hex cru dentro do `style.css` do pacote
  (`[data-text-color=red]{color:#e03e3e}` etc.). Um mapeamento fiel precisaria
  sobrescrever picker + texto + fundo num arquivo onde `var(--color-*)` não
  resolve, e ainda assim entregaria os slots `brown` e `pink`, que não existem no
  Bonsai. Os blocos e o schema seguem aceitando cor vinda de import; só não dá
  mais para autorar.
- **Conteúdo corrompido não é mais sobrescrito.** `content.ts` agora expõe
  `readDocumentContent` com `{ status: 'ok' | 'unreadable' }`;
  `block-note-editor.tsx` renderiza estado de erro (`role="alert"`) e nem monta o
  editor quando o JSON não parseia. Validado gravando `{isto nao e json valido`
  direto no SQLite: a tela mostra o erro, zero `[contenteditable]` e o conteúdo
  original continua no banco.
- **Desativar link público pede confirmação.** `confirm-disable-public-link.tsx`
  usa `AlertDialog` no desktop e `Sheet` com `role="alertdialog"` no mobile; o
  Switch só desliga depois do confirm. Entrou
  `src/components/ui/alert-dialog.tsx` (cópia do DS adaptada aos tokens Bonsai) e
  a dep `@radix-ui/react-alert-dialog`. O CTA destrutivo usa
  `bg-error-700 hover:bg-error-800` porque o `--destructive` (`error-500`) com
  texto branco dá 3,21:1 e reprova AA. Label do switch: "Ativar link público" →
  "Link público", e o campo do link virou "Endereço do link" (dois controles com
  o mesmo nome acessível).
- **Token de largura de leitura:** `--container-prose-leaf: 720px` no `@theme` e
  `max-w-prose-leaf` nas três telas. `--container-prose` **não** funciona: o
  `max-w-prose` do Tailwind v4 é utility estática (65ch) e ignora o tema.
  `--editor-shadow: var(--color-alpha-50)` foi declarado no `:root` do
  `globals.css` porque o `editor.css` usa `@reference` e lá `var(--color-*)` não
  resolve (o `@theme inline` inlina e faz tree-shaking).
- **Contraste e a11y:** `save-indicator` foi para `text-gray-700`/`text-error-700`
  (`gray-600` dava 3,44:1 em 14px), a live region virou um `<span role="status"
  aria-live="polite">` permanente preenchido só em `saved`/`error` (trocar
  `aria-live` junto com o texto perde o anúncio), e o erro ganhou "Tentar de
  novo" chamando o `flush`. O `aria-readonly` que a spec pedia no wrapper foi
  **descartado**: é ARIA inválida num `div` de role genérica. No lugar, o
  elemento do editor recebe `aria-describedby` (via `domAttributes.editor`)
  apontando para o texto "Somente leitura".
- **Placeholder do BlockNote 0.54:** o seletor certo é
  `.bn-block-content:has(.ProseMirror-trailingBreak:only-child)::after`;
  `[data-placeholder]::before` é morto (só existe no popup de código-fonte).

## Onda 4 — Hierarquia de páginas e import do Notion (entregue)

- Schema: `documents.parent_id` (self-reference, nullable) + índice, migração
  `drizzle/0001_loving_zeigeist.sql`. **O drizzle-kit gerou o `ALTER TABLE ... ADD
  parent_id text REFERENCES documents(id)` sem `ON DELETE SET NULL`**, então com
  `foreign_keys = ON` apagar um pai com filhos daria erro de FK. Por isso
  `deleteForever` zera o `parent_id` da subárvore antes de apagar. Se um dia a
  tabela for recriada, o `onDelete: 'set null'` do `schema.ts` volta a valer.
- `src/lib/documents.ts` ganhou `parentId` no `DocumentSummary`, mais
  `buildDocumentTree`, `listAncestors` e `listSubtreeIds`. A lista
  "Compartilhados comigo" continua **plana** de propósito (o pai pode não ser
  acessível para quem recebeu o compartilhamento).
- `src/lib/document-actions.ts`: `moveDocument(id, parentId)` (bloqueia mover
  para si mesmo ou para descendente, e exige `owner` na origem **e** no destino),
  `listMoveTargets(id)` para alimentar o dialog, e cascata na lixeira
  (`moveToTrash`/`restoreDocument`/`deleteForever` operam na subárvore inteira).
  Restaurar um filho com o pai ainda na lixeira o devolve para a raiz.
- **Autorização continua por documento.** Compartilhar um pai NÃO compartilha os
  filhos, e o link público de um pai não expõe a subárvore. Herança de permissão
  ficou fora do MVP de propósito.
- UI nova: `document-tree.tsx` (sidebar em árvore, expand/collapse por item,
  indentação até 4 níveis e tooltip com o caminho a partir do 5º),
  `document-breadcrumb.tsx` (ancestrais acima do título),
  `move-document-dialog.tsx` (Dialog no desktop, Sheet no mobile, busca +
  radiogroup de destinos) e `notion-import-dialog.tsx` (progresso e resumo).
  O item do menu ⋯ se chama **"Mover para outra página"** para não colidir com
  "Mover para a lixeira" (dois itens com nome parecido confundiam leitor de tela
  e o próprio teste).
- Import do Notion: `POST /api/import/notion` (multipart, campo `file`) responde
  **NDJSON em streaming** com eventos `progress` / `done` / `error`; o cliente lê
  com `response.body.getReader()`. Rota em vez de server action por causa do
  limite de corpo das server actions.
- `src/lib/notion/`: `zip.ts` (fflate `unzipSync` com filtro que rejeita
  zip-slip e caminho absoluto, e corta por número de arquivos e tamanho
  declarado), `paths.ts`, `plan.ts` (monta a hierarquia), `markdown.ts`
  (transformações), `csv.ts`, `import.ts` (orquestra) e `fixture.ts` (export
  sintético usado nos testes). Limites em `limits.ts`: 100 MB de zip, 300 MB
  descompactado, 2000 arquivos, 20 MB por anexo.
- Decisões do mapeamento (defaults seguros, usuário estava ausente):
  - **Database `.csv` vira uma página própria** com a tabela dentro, e as linhas
    que têm `.md` viram subpáginas dela. A spec falava em "tabela no doc pai",
    mas a pasta da database precisa de um documento para pendurar as linhas, e
    esse documento é o natural. Tabela cortada em 12 colunas e 200 linhas, com
    aviso no fim do documento.
  - Pasta sem `.md` nem `.csv` correspondente vira **documento de agrupamento**
    vazio. A pasta raiz do zip é achatada só quando o nome **não** tem hash de 32
    hex (isto é, quando é um wrapper tipo `Export-8f3a/`); pasta com hash é
    página de verdade e continua na árvore.
  - `<aside>` do Notion e citação começando com emoji viram bloco `callout`; o
    emoji é removido do texto. O `<aside>` é marcado com um separador invisível
    (`⁣`) antes da conversão para o markdown, e o marcador é retirado ao
    promover o bloco.
  - **Toggle list degrada**: `<summary>` vira parágrafo em negrito e o conteúdo
    fica sempre aberto (o BlockNote tem `toggleListItem`, mas não há sintaxe
    markdown que o gere). O import avisa quantos toggles foram degradados.
  - Anexo que não é imagem vira link para `/api/uploads/...`; imagem vira bloco
    de imagem. Link interno para `.md`/`.csv` é reescrito para `/doc/{id}` numa
    segunda passada (as linhas são criadas antes do conteúdo). Link sem destino
    no zip vira texto puro e entra na contagem de avisos.
  - Erro em uma página não aborta o zip: vira aviso e o import continua.
- Sanitização: o import passa pelo `markdownToBlocks` (novo export de
  `src/lib/markdown/convert.ts`), que é `sanitizeMarkdown` + `sanitizeBlocks`
  como antes. `promoteCallouts` só troca `type` e texto, não introduz URL.
- **Bug de CSS que existia desde a onda 2 e foi corrigido aqui:** o
  `editor.css` importava as utilities do Tailwind na layer `utilities`, e como
  esse arquivo entra depois do `globals.css`, o `.hidden` gerado para o
  `@blocknote/shadcn` vencia o `.tablet:block` do app. Resultado: **a sidebar do
  desktop sumia em toda página que carrega o editor** (`/doc/[id]` e
  `/share/[token]`). Correção: `globals.css` declara
  `@layer theme, base, components, blocknote, utilities;` na primeira linha e o
  `editor.css` importa as utilities do BlockNote em `layer(blocknote)`. Validado
  no navegador (sidebar volta, menu de barra do BlockNote continua estilizado) e
  no bundle de produção (`@layer components,blocknote;@layer utilities{`).
- **Hardening do proxy de uploads** (`/api/uploads/[...key]`), porque o import
  passou a ingerir arquivo arbitrário de dentro de um zip: `X-Content-Type-Options:
  nosniff`, `Content-Security-Policy: default-src 'none'; ...; sandbox` (mata SVG
  com script servido do nosso domínio) e `Content-Disposition: attachment` para
  tudo que não é `image/*`.
- Testes: `src/lib/notion/import.test.ts` (21 casos: hierarquia de 3 níveis,
  título sem hash, csv como página, imagem no storage, link interno reescrito,
  callout, título não duplicado, zip-slip, caminho absoluto, limite de tamanho e
  de arquivos, lixo de sistema operacional) e `src/lib/documents.test.ts` (5
  casos de árvore/ancestrais/subárvore). Suíte: 6 arquivos, 88 testes verdes.
- Ajustes vindos do `design-review` (todos os 🔴 e a maior parte dos 🟡):
  `src/components/ui/radio-group.tsx` foi copiado do `arvore-design-system` (com
  `border-gray-600` no repouso, como o `border-strong` corrigido do DS) e a dep
  `@radix-ui/react-radio-group` entrou; o dialog de mover usa o rádio de verdade
  em vez de `input` `sr-only`. O chevron da árvore virou `ButtonIcon size="medium"`
  (área de toque de 44px pelo `before:-inset`), a indentação voltou para a escala
  (`pl-3 / pl-6 / pl-10 / pl-14`), a barra de progresso usa `bg-primary-800`
  (3,32:1 contra `gray-200`; `primary-500` dava 1,48:1) e o item do menu passou a
  ser gateado por `isOwner` (o `DocumentMenu` trocou a prop `canDelete` por
  `isOwner`, que é a permissão real da ação no servidor).
- O import agora aceita cancelamento de verdade: o cliente aborta o `fetch` e a
  rota repassa `request.signal` para o gerador, que para entre páginas. As
  páginas já criadas ficam (a mensagem diz isso). No erro há "Tentar de novo".
- Nos níveis achatados (5º em diante) a árvore mostra o caminho **também** como
  segunda linha, além do tooltip que a spec pedia: tooltip não abre em toque e
  metade do tráfego da Árvore é mobile.
- Label da sidebar mudou de "Importar markdown" para "Importar arquivo" porque o
  botão passou a aceitar zip. Mudança de label de navegação registrada aqui
  porque o protocolo de redesign do Bonsai pede confirmação de produto.
- E2E manual com Playwright (fora do repo, scratchpad): 14 checagens do fluxo de
  import (modal, resumo, avisos, árvore, breadcrumb, imagem renderizada, callout,
  terceiro nível, mover para a raiz, mobile sem overflow) e 6 de hierarquia
  (slash menu do editor ainda estilizado, lixeira em cascata, restaurar filho vai
  para a raiz, restaurar pai reconstrói a árvore). 20/20.

## Onda 5 — Polimento das core features (entregue)

### Editor
- `Cmd/Ctrl+B/I/U` já eram nativos (vêm do `@tiptap/extension-bold|italic|underline`)
  e `Cmd/Ctrl+K` também: o `CreateLinkButton` do `@blocknote/react` registra o
  listener no elemento do editor, mas **só enquanto a formatting toolbar está
  montada**, ou seja, com texto selecionado. Nada foi implementado à mão; o E2E
  `editor.spec.ts` prova os dois caminhos.
- Título ⇄ editor via `src/components/editor/focus-bridge.ts`: o input do título
  passou a ter o id fixo `leaf-document-title` (no lugar do `useId`, que impedia
  o editor de achá-lo) e `Enter` dispara um evento de janela que o editor escuta
  para posicionar o cursor no primeiro bloco. O caminho de volta é um listener de
  `keydown` em **fase de captura no container do editor** (`containerRef`), não
  no `editor.domElement`: no primeiro efeito o `domElement` ainda pode ser
  `undefined` e o listener nunca era registrado (bug real, pego no E2E).
- Contadores de palavras/caracteres em `text-stats.ts` + `document-stats.tsx`,
  recalculados no `onChange` do editor. A extração de texto entende conteúdo
  inline, filhos e células de tabela (separadas por quebra de linha para não
  colar duas palavras).
- **Bug corrigido no `document-header.tsx`:** o `useEffect([title])` ressetava o
  valor do input a cada re-render vindo de `revalidatePath`, então um
  `router.refresh` no meio da digitação apagava o que a pessoa tinha escrito.
  Agora o reset só acontece quando o `documentId` muda.
- O renderer público (`/share/[token]`) usa `leafReadOnlyDictionary`, um clone do
  dicionário com todos os placeholders vazios: quem abre o link não via mais
  "Digite / para comandos" num bloco vazio.

### Sidebar
- Busca client-side com o `Search` do design system (cópia nova em
  `src/components/ui/search.tsx`). Decisão de produto tomada sem o usuário: com
  termo ativo a árvore é **substituída** por uma lista plana de resultados
  (`document-search-results.tsx`) com o caminho dos ancestrais em cada item, em
  vez de uma árvore parcialmente filtrada. A busca ignora acento e caixa
  (`src/lib/document-search.ts`, testado).
- `Cmd/Ctrl+P` foca o campo (expandindo a sidebar recolhida no desktop e abrindo
  o Sheet no mobile). O atalho sequestra o "imprimir" do navegador; foi mantido
  porque é a convenção do Notion e é o que a spec pediu. Se um dia incomodar, o
  caminho é `Cmd/Ctrl+K`.
- Estado de recolhido da sidebar e de expandido da árvore persistem em
  `localStorage` (`leaf:sidebar-collapsed`, `leaf:tree-expanded`) via
  `src/shared/storage.ts`, que engole exceção de navegador com storage bloqueado.
  A leitura é feita em `useEffect` (não no `useState` inicial) para não quebrar a
  hidratação; isso custa um flash da sidebar expandida no primeiro paint.
- "Mover para a lixeira" ganhou "Desfazer" no toast (10s de duração, em vez dos
  4s default do Sonner, por ser saída de emergência de ação destrutiva) e o menu
  ⋯ ganhou "Duplicar documento" (`duplicateDocument`: copia título + conteúdo +
  pai, **não** copia shares nem link público).

### Robustez
- `updateDocumentContent` lê o conteúdo atual e **não grava** quando o JSON é
  idêntico, evitando `updated_at` fantasma mexendo na ordenação da sidebar.
- Export de markdown/HTML reescreve URL interna (`/api/uploads/...`, `/doc/...`)
  para absoluta usando a origem da requisição (`absolutizeBlocks`). A limitação
  continua: o arquivo exportado só mostra a imagem em quem consegue alcançar
  aquele host; com S3 real e URL pública o problema some.
- `blocksToHTMLLossy` emite `classname=` (minúsculo, atributo inválido) nos
  links; `fixExportedHTML` pós-processa o HTML corrigindo para `class=`.
- O export não repete mais o título quando o conteúdo já começa com um `h1`
  igual (`documentToMarkdownFile` / `contentToHTML`), coisa que acontecia em todo
  round-trip de import de markdown.
- Import de `.md`: mensagens de erro específicas para arquivo grande, arquivo
  binário disfarçado de `.md` (`looksBinary`, em `src/lib/markdown/text.ts`) e
  markdown que não produz nenhum bloco. Em todos os casos **nada é criado**.
  `next.config.ts` ganhou `experimental.serverActions.bodySizeLimit: '4mb'`
  porque o limite default de 1 MB rejeitava markdown perto do teto de 2 MB com
  erro opaco.

### Dívidas da onda 3/4 resolvidas
- **Passe de sincronização de `src/components/ui/*` contra o
  `arvore-design-system`:** o diff arquivo a arquivo mostrou que as cópias já
  estavam idênticas ao canônico (inclusive `select.tsx`). A dívida registrada era
  imprecisa: o DS corrigiu o **token** `--input` para `gray-600` (e o
  `globals.css` do Leaf já tinha isso), mas os componentes continuam com
  `border-gray-400` **literal** no canônico. `gray-400` (#B8CDD2) dá 1,9:1 contra
  branco e reprova WCAG 1.4.11. Trocado para `border-gray-600` **só na cópia
  local** de `button.tsx`, `button-icon.tsx`, `badge.tsx`, `select.tsx`,
  `switch.tsx` e `tabs.tsx`. **Merece PR upstream no `arvore-design-system`** —
  é divergência local até lá.
- Valores `[NNNpx]` fora da escala trocados pela escala do Tailwind v4
  (`max-w-[440px]` → `max-w-110`, `w-[280px]`/`w-[300px]` → `w-70`,
  `max-w-[360px]` → `max-w-90`, `max-w-[520px]` → `max-w-130`,
  `max-w-[540px]` → `max-w-135`, `w-[180px]` → `w-45`, `w-[160px]` → `w-40`).
  A sidebar mobile passou a ter os mesmos 280px do aside do desktop.
- Painel de conteúdo ilegível agora usa `Alert`/`AlertTitle`/`AlertDescription`
  (`src/components/ui/alert.tsx`, cópia do DS). Divergência assumida: as cores
  `success-medium`/`warning-medium`/`error-medium` do canônico não existem na
  paleta do frontmatter do Bonsai, então viraram `success-200`/`warning-200`/
  `error-200` (mesmos degraus que o `sonner.tsx` já usa). O `role` também passou
  a ser derivado do variant (`alert` só em erro, `status` no resto).
- Suíte E2E versionada: `e2e/` com Playwright, `pnpm test:e2e`.

### Dialog vira bottom sheet no mobile
- `src/components/ui/dialog.tsx` foi alterado **na cópia local**: até `tablet`
  o `DialogContent` é folha ancorada na base (topo arredondado, grabber visual,
  `max-h-[85dvh]`, `env(safe-area-inset-bottom)`, animação vindo de baixo) e a
  partir de `tablet` volta ao modal centralizado. O `DialogFooter` stacka
  vertical no mobile.
- Consequência: a virada de breakpoint passou a ser `tablet:` (768px) e **não**
  `sm:` (640px). Todos os consumidores do Leaf foram migrados de `sm:max-w-*`
  para `tablet:max-w-*`. Um componente colado do showcase com `sm:max-w-lg` vai
  aplicar largura num elemento `inset-x-0 bottom-0` entre 640 e 767px e colar na
  esquerda. **Isto merece PR upstream no `arvore-design-system`**, junto com o
  `border-gray-600`.
- O `alert-dialog.tsx` **não** foi convertido: `confirm-disable-public-link.tsx`
  já renderiza um Sheet próprio no mobile e o AlertDialog só aparece no desktop.
  Se algum dia o AlertDialog for usado direto numa tela mobile, ele precisa do
  mesmo tratamento.
- O modal de "Excluir de vez" deixou de ser dismissível por `Esc` e clique fora
  (regra do `components/modal.md` para confirmação destrutiva).

### Ambiente de teste isolado (importante)
- `next.config.ts` lê `distDir` de `LEAF_DIST_DIR` (default `.next`). Serve para
  rodar `next build` sem derrubar o `next dev` que o usuário deixa de pé na 3000.
- `scripts/e2e-server.mjs` cria a sandbox `.e2e/` (com `data/` e uma cópia de
  `drizzle/`), sobe o `s3rver` na 4569 com bucket `leaf-e2e` e roda
  `next start <projeto>` na 3100 **com `cwd` na sandbox**. Como o caminho do
  SQLite é `join(process.cwd(), 'data', 'leaf.db')`, trocar o `cwd` isola o banco
  do E2E sem reintroduzir `DATABASE_PATH` (que a onda 1 proibiu). O `.env.local`
  do projeto continua sendo lido, mas as variáveis passadas explicitamente pelo
  script (auth, S3) vencem, porque o `@next/env` não sobrescreve o que já está no
  `process.env`.
- `pnpm test:e2e` = `LEAF_DIST_DIR=.next-e2e next build && playwright test`.
  O `next build` reescreve o `tsconfig.json` acrescentando `.next-e2e/types` ao
  `include`; é ruído do Next, dá para reverter com `git checkout tsconfig.json`.
- `.gitignore` ganhou `/.next-e2e/`, `/.e2e/`, `/test-results/` e
  `/playwright-report/`.
- Cobertura: 20 casos (18 desktop + 2 mobile em 375px) cobrindo o roteiro da
  onda 3 (atalhos de markdown, slash menu pt-BR, negrito, link por Ctrl+K,
  autosave + reload, upload de imagem ponta a ponta com s3rver, import/export de
  markdown, convite viewer→editor com duas sessões, link público em contexto
  anônimo e 404 depois de desativar, mobile sem overflow), o import do Notion
  (zip da fixture virando árvore, e zip corrompido) e os fluxos novos desta onda.

### Outros ajustes de design
- Favicon: `src/app/favicon.ico` (default do Next) saiu, entrou
  `src/app/icon.svg` com o `LeafIcon` em `primary-700` sobre branco. O
  `<title>` por documento (`Título | Leaf`) já existia desde a onda 4.
- `DialogDescription` foi de 14px para 16px. Continua como `text-[16px]` (e não
  `text-body-medium`) de propósito: o `cn` do repo é `twMerge` sem
  `extendTailwindMerge`, então `text-body-medium` briga com o `text-gray-700` que
  os consumidores passam via `className` e perde o tamanho.
- Signup: label "Nome" virou "Nome (opcional)" — o campo de fato não é
  obrigatório. **Mudança de label de formulário registrada aqui** porque o
  protocolo de redesign do Bonsai pede confirmação de produto.
- Slash menu: "Envie uma imagem do seu computador" → "do seu dispositivo".
- `nenhum leading-tight` sobrou no código; o item da dívida já estava resolvido.
- Live region da busca fica **sempre montada** (fora do ternário), senão o leitor
  de tela não anuncia o resultado.

## Onda 6 — Tema escuro/claro e i18n pt-BR/en-US (entregue)

### Camada de tokens semânticos (o que mudou no `globals.css`)

- O `.dark` só funciona se a UI consumir **vars semânticas**, e a UI do Leaf usava
  classe de paleta literal (`text-gray-900`, `bg-white`, `border-alpha-200`,
  `bg-error-50`...) em ~380 lugares. Por isso o `globals.css` ganhou uma camada
  semântica declarada no `:root` e **remapeada inteira no bloco `.dark`**, e
  todas as classes literais de `src/components/**` e `src/app/**` foram trocadas
  pelas utilities dessa camada. Nenhum valor novo foi inventado: cada var aponta
  para um degrau das escalas do frontmatter do Bonsai.
- Grupos: `content-strong | content | content-muted | content-subtle |
  content-disabled | content-inverse`; `surface-app | surface-nav |
  surface-card | surface-sunken | surface-subtle | surface-hover |
  surface-grabber | overlay`; `line | line-subtle | line-divider | line-soft |
  line-muted | line-strong | line-stronger | line-contrast | focus`;
  `brand | brand-strong | brand-surface | brand-surface-strong | link |
  link-hover`; `danger | danger-surface | danger-surface-strong | danger-solid |
  danger-solid-hover | warn | warn-surface | warn-surface-strong | positive |
  positive-surface-strong`; `tooltip | tooltip-foreground`;
  `code-surface | code-content`.
- **Os nomes do shadcn viraram alias dessa camada** (`--background:
  var(--surface-app)`, `--card: var(--surface-card)`, `--muted:
  var(--surface-subtle)`, `--border: var(--line)`, `--input: var(--line-strong)`,
  `--sidebar: var(--surface-nav)`...). Consequência prática: o `.dark` **não**
  redefine os nomes shadcn, só a camada base — e o BlockNote, que consome
  `--popover`/`--muted`/`--border`/`--accent`, acompanha de graça.
  `--primary` continua `primary-500` e `--primary-foreground` continua
  `gray-900` nos **dois** temas (texto claro sobre o teal reprova AA: 1,55:1).
- **Token novo proposto para o design system:** `alpha-inverse-50/100/200/300`
  (`rgba(255,255,255,0.06/0.08/0.12/0.16)`). A escala `alpha` do Bonsai é ink
  `#053B4B` com opacidade e some por completo sobre `gray-950`, então não existe
  equivalente para borda decorativa no escuro. Está declarada só no
  `globals.css` do Leaf e **merece PR no `arvore-design-system`** junto com as
  outras divergências já listadas.
- Sombras: os tokens de elevation (ink alpha) ficaram como estão. No escuro eles
  praticamente somem, e quem separa as superfícies é a escada
  `surface-app (gray-950) < surface-card/nav (gray-900) < surface-subtle/hover
  (gray-800)` mais as bordas (`line` = alpha-inverse-200, `line-muted` =
  gray-600 no escuro).

### Tema

- `next-themes` reinstalado. Provider em
  `src/components/app/theme-provider.tsx` (`attribute="class"`,
  `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`,
  `storageKey="leaf:theme"`), montado no `src/app/layout.tsx` com
  `suppressHydrationWarning` no `<html>`. Sem flash: o script inline é o padrão
  da lib.
- Seletor no menu do usuário (`user-menu.tsx`) como `DropdownMenuRadioGroup`
  (Claro / Escuro / Sistema, ícones `Sun3Icon`, `MoonIcon`,
  `MoonFirstQuarterIcon`). O valor só é lido depois do `mounted` para não
  quebrar a hidratação.
- `sonner.tsx` passou a receber `theme={resolvedTheme}` e as cores dele agora
  vêm das vars semânticas (antes era `theme="light"` fixo com
  `var(--color-gray-100)`).
- `BlockNoteView` (editor e renderer) recebe `theme={resolvedTheme}`, que só
  controla o `data-color-scheme` usado pelas cores do shiki; o resto do visual
  já vem das vars.
- **`editor.css`:** as regras passaram todas para utilities semânticas. Duas
  correções específicas do BlockNote: as bordas de tabela do pacote são `#ddd`
  cru (agora `border-line-soft` com cabeçalho em `surface-subtle`), e no `.dark`
  um bloco com `data-background-color` (pastel claro escolhido pelo usuário)
  força `text-gray-900`, senão o texto claro do tema some no pastel.
- **Bug antigo corrigido de quebra:** o bloco de código estava ilegível no tema
  claro desde a onda 2. O `style.css` do `@blocknote/core` define
  `codeBlock { color: #fff; background: #161616 }` e o shiki pinta os tokens com
  `var(--shiki-dark)` (cores claras); a onda 2 trocou só o fundo por
  `bg-gray-100` e deixou o texto branco sobre cinza claro. Agora o bloco usa
  `code-surface`/`code-content` (gray-900 + gray-50) nos **dois** temas, que é o
  pareamento que o shiki-dark espera.
- `src/components/ui/input.tsx` perdeu o `dark:bg-input/30` que vinha da base do
  shadcn: o frontmatter do Bonsai diz `input-default.backgroundColor:
  transparent`, e o preenchimento deixava a borda com 2,43:1 contra o próprio
  interior. Divergência a menos em relação ao canônico.

### i18n

- `next-intl@4` **sem roteamento por URL**. `src/i18n/config.ts` (lista de
  locales, `matchLocale` de `Accept-Language`), `src/i18n/request.ts`
  (`getRequestConfig` lendo o cookie `locale` e caindo no `Accept-Language`) e
  `src/i18n/locale-action.ts` (server action que grava o cookie, `maxAge` de um
  ano, `sameSite: 'lax'`). O plugin entra em `next.config.ts` via
  `createNextIntlPlugin('./src/i18n/request.ts')`.
- Isso faz a página pública `/share/[token]` seguir o locale do **visitante**
  (cookie dele ou `Accept-Language`), não o do dono, que era o pedido da spec.
- `<html lang>` é dinâmico (`getLocale()`), a `metadata` virou
  `generateMetadata` em `layout.tsx`, `/login`, `/signup`, `/doc/[id]` e
  `/share/[token]`.
- Catálogos em `messages/pt-BR.json` e `messages/en-US.json`, por namespace:
  `common, metadata, auth, settings, nav, home, document, move, trash, share,
  publicShare, editor, blocknote, importFile, notionImport, uploads, errors`.
  Plurais em ICU. **Atenção ao pt-BR:** o CLDR classifica `0` como `one` em
  português, então as mensagens contáveis têm `=0` explícito para não sair
  "0 palavra".
- Server actions e route handlers usam `getTranslations()` (rodam em contexto de
  request): `document-actions.ts`, `share-actions.ts`,
  `markdown/import-action.ts`, `/api/uploads`, `/api/uploads/[...key]`,
  `/api/documents/[id]/export`, `/api/import/notion`.
- **Bibliotecas puras não importam next-intl.** `src/lib/notion/import.ts` e
  `zip.ts` recebem um objeto `NotionImportMessages`
  (`src/lib/notion/messages.ts`), montado pela rota a partir do
  `getTranslations('notionImport')`. `import.test.ts` monta o mesmo objeto com
  `createTranslator` da própria lib sobre `messages/pt-BR.json`, então os testes
  continuam conferindo as strings pt de verdade. Assinaturas que mudaram:
  `readZipEntries(data, messages, limits?)`, `buildImportPlan(entries,
  fallbackTitle)`, `notionTitle(path, fallbackTitle)` e
  `titleFromFileName(fileName, fallbackTitle)`.
- **Título default é conteúdo, não UI:** "Sem título" / "Untitled" é gravado no
  banco no idioma de quem criou o documento. Documento antigo mantém o título
  que já tinha; trocar de idioma não renomeia nada.
- **Dicionário do BlockNote acompanha o locale.** `dictionary.ts` virou
  `createLeafDictionary(locale, texts)`: em pt continua o `pt` da lib com o
  polimento de sentence case da onda 2; em en usa o `en` **nativo da lib** (que
  é Title Case, divergente do Bonsai, decisão consciente por ser copy de
  terceiro), com só os placeholders e o item "Destaque"/"Callout" vindos das
  nossas mensagens. `slash-menu-items.tsx` deixou de comparar strings fixas
  ("Mídia", "Outros", "Imagem", "Citação") e passou a derivar tudo de
  `editor.dictionary.slash_menu`.
- `DocumentEditor`/`DocumentRenderer` usam `key={locale}`, então trocar de
  idioma remonta o editor com o dicionário novo (o `useCreateBlockNote` não
  recria a instância sozinho). O autosave já gravou antes da troca.
- `src/components/ui/{dialog,sheet,search,step-progress}.tsx` passaram a usar
  `useTranslations('common')` para "Fechar", "Limpar busca" e "Etapa X de Y",
  que eram literais pt dentro de cópias do design system. **Mais uma divergência
  local em relação ao `arvore-design-system`.**

### Ajustes vindos do `design-review`

Todos os 🔴 foram corrigidos, mais a maior parte dos 🟡. O que mudou depois da
auditoria:

- **Contraste de foco:** `--ring` deixou de ser `primary-500` (1,60:1 sobre
  branco) e passou a apontar para `--focus` (gray-900 no claro, gray-50 no
  escuro), que já era o valor usado nos `outline-focus` espalhados pelo app.
  Isso **diverge do `border-focus: primary-500` do frontmatter do Bonsai**, que
  reprova WCAG 2.4.11; entra na lista de PR upstream.
- **Hierarquia de texto no claro colapsou de propósito:** `--content-muted`
  (gray-600, 3,43:1) e `--content-subtle` (gray-500, 2,12:1) reprovavam AA em
  texto pequeno (label do menu, placeholder do select, descrição do Sheet).
  Os dois viraram `gray-700` no `:root`. A escala gray do Bonsai não tem degrau
  que passe 4,5:1 entre gray-700 e branco, então no tema claro os três níveis de
  texto ficam iguais. No escuro a hierarquia continua (gray-300 / gray-400 /
  gray-500).
- **Botão destrutivo:** a variante `destructive` do `button`/`button-icon` usava
  `bg-destructive` (error-500, 3,21:1 com branco) e `hover:bg-error-600`. Agora
  usa `bg-danger-solid` + `hover:bg-danger-solid-hover` (error-700 → 6,07:1),
  e o `--destructive` virou `--danger-solid` no claro e `--danger` no escuro,
  ficando só como cor de borda/anel de `aria-invalid`. O `className` redundante
  do `trash-section` saiu; o do `confirm-disable-public-link` ficou porque o
  `AlertDialogAction` usa `buttonVariants()` default.
- **Item destrutivo do dropdown** ("Mover para a lixeira") passou de
  `text-destructive` (3,21:1 claro / 3,03:1 escuro) para `text-danger`
  (6,07:1 / 5,89:1).
- **Indicador de seleção** do `DropdownMenuRadioItem`/`CheckboxItem` e do
  `SelectItem` foi de `brand` (primary-700, 2,69:1) para `brand-strong`
  (primary-800, 3,72:1). No menu de tema/idioma o ponto é o **único** sinal de
  estado, então precisava dos 3:1.
- **Campo de busca** (`search.tsx`) tinha `border-transparent` nas variantes
  `secondary-desktop` e `mobile`: o campo não tinha limite visível (1,05:1 no
  claro, 1,26:1 no escuro). Agora usa `border-line-strong`, como manda
  `input-default.borderColor` do frontmatter.
- **Formulário de auth:** os inputs de email e senha ganharam `aria-invalid` e
  `aria-describedby` apontando para a mensagem de erro (WCAG 3.3.1), a dica de
  senha ganhou `id` + `aria-describedby` e subiu de 12px para 14px (mínimo de
  corpo do Bonsai).
- **String que tinha escapado:** "Resultados da busca" continuava hardcoded no
  `app-shell.tsx` (não tem acento, então o grep por literal pt não pegou). Agora
  usa `nav.searchResults`, que já existia nos dois catálogos.
- `--content-subtle` no escuro voltou para gray-500 (5,70:1 sobre o card) para
  não colapsar com `--content-muted`; `--brand-surface` no escuro subiu de
  primary-950 para primary-900, senão o item ativo da árvore sumia.
- Outros: separador do dropdown com `bg-line` em vez de `bg-surface-hover`,
  `DialogTitle` com `text-content-strong` (igual ao `SheetTitle`), trilho da
  barra de progresso do import com `bg-line-muted`, borda do toast com
  `--line-muted`, `input.tsx` sem o `shadow-xs` (sombra preta pura do shadcn) e
  com `rounded-large` (o frontmatter pede 8px, não os 6px do `rounded-md`),
  borda de repouso do título do documento em `border-line-muted`, variante
  `link` do botão com `text-link`, `viewport.colorScheme: 'light dark'`.
- **Dicionário en-US do BlockNote virou custom** (`enSlashMenu`), em sentence
  case, espelhando o polimento que o pt já tinha ("Code block", "Numbered list",
  "Task list"...). O `en` cru da lib é Title Case e reprovava o gate de copy.
- **Copy en-US revisada:** "canceled" no lugar de "cancelled", "Back home",
  "Read-only", vírgula de série, e contrações ("Don't", "We couldn't", "You
  don't") para o inglês ter o mesmo tom conversacional do pt-BR.
- O override do escuro para bloco com cor de fundo ficou mais estreito
  (`:not([data-text-color])`), para não matar a cor de texto escolhida pelo
  autor.
- **Não corrigido de propósito:** `--surface-subtle` e `--surface-hover` são o
  mesmo gray-800 no escuro; subir o hover para gray-700 derruba o texto para
  4,11:1, e não existe nenhum elemento no app que combine `bg-surface-subtle`
  com `hover:bg-surface-hover`.
- **Não corrigido, fica para o PR do design system:** as 12 sombras de elevation
  continuam com ink `rgba(5,59,75,0.06)` e somem no escuro. Quem separa as
  camadas hoje é a escada de superfícies mais as bordas. Um `--shadow-*` escuro
  é spec nova e precisa entrar no `foundations/elevation.md`.

### Verificação

- `pnpm build` verde, `vitest run` 113 testes verdes,
  `pnpm test:e2e` 25 testes verdes (23 desktop + 2 mobile), incluindo o novo
  `e2e/preferences.spec.ts`: troca de tema com persistência depois do reload,
  `system` seguindo `prefers-color-scheme`, editor legível no escuro, troca de
  idioma persistida com `<html lang>` correto e slash menu do editor mudando
  junto.
- `e2e/helpers.ts`: `waitForEditorReady` agora aceita o contador em pt **ou** en.

## Pendências conhecidas

- Export de markdown/HTML não passa pela rota pública `/share/[token]`, só pelo
  app autenticado.
- O rate limit do link público é por processo e sem persistência; em produção
  com mais de uma instância precisa migrar para um store compartilhado.
- Não há e-mail de convite: convidar só grava a linha em `document_shares`, e o
  acesso resolve quando a pessoa loga com aquele email.
- O import do Notion lê o zip inteiro em memória (`unzipSync`), então um zip de
  100 MB usa memória proporcional no servidor. Para arquivo maior seria preciso
  extração em streaming por entrada.
- Colunas de database do Notion que passam de 12, linhas que passam de 200 e
  toggles do Notion (que perdem o abrir/fechar) são perdas assumidas, sinalizadas
  no resumo da importação.
- Import não deduplica: importar o mesmo zip duas vezes cria duas árvores.
- A lixeira continua sendo uma lista plana: ao mandar um pai para a lixeira, os
  filhos aparecem lá como itens soltos (restaurar o pai traz todos de volta com a
  hierarquia intacta).
- O atalho `Cmd/Ctrl+P` da busca sobrescreve o "imprimir" do navegador dentro do
  app. Foi decisão consciente (convenção do Notion e pedido da spec).
- `src/components/ui/*` divergiu do `arvore-design-system` em dois pontos que
  precisam de PR upstream: `border-gray-600` no lugar de `border-gray-400` nas
  bordas de repouso e o `DialogContent` virando bottom sheet até `tablet`.
- O `Search` do DS especifica 40px de altura; a cópia do Leaf usa `h-11` até
  `tablet` para respeitar a área de toque de 44px em mobile. Divergência local.
- `contentToHTML`/`contentToMarkdown` recebem a origem da requisição; se o app
  rodar atrás de proxy sem `X-Forwarded-*` correto, a URL absoluta do export sai
  com o host interno.
- A leitura do `localStorage` acontece depois da hidratação, então a sidebar
  aparece expandida por um frame antes de recolher.
- O E2E não cobre: conflito de edição em duas abas, export pela rota pública e
  o cancelamento do import do Notion no meio.
- **PR pendente no design system (nenhum foi aberto nesta onda, o push está
  proibido):** a escala `alpha-inverse-*`, o mapeamento semântico do tema escuro,
  as sombras de elevation para fundo escuro e o `border-focus` (o `primary-500`
  do frontmatter dá 1,60:1 sobre branco e o Leaf usa `--focus` no lugar).
- `src/components/ui/{dialog,sheet,search,step-progress}.tsx` agora dependem de
  `next-intl`. Sincronizar essas cópias com o registry `@bonsai` vai desfazer
  isso; a divergência é intencional enquanto o DS não tiver i18n.
- O dicionário do BlockNote em en-US é o nativo da lib, em Title Case
  ("Code Block", "Bulleted List"), fora do sentence case do Bonsai. Traduzir
  esse dicionário à mão fica para depois.
- As cores de conteúdo do BlockNote (`[data-text-color=red]` etc.) continuam com
  os hex do pacote. No escuro elas ficam entre 3:1 e 4:1 contra o fundo; como o
  color picker foi removido na onda 3, isso só aparece em conteúdo importado.
- `text-content-muted` (gray-600) sobre fundo claro dá 3,43:1: serve para ícone
  e texto grande, não para corpo de 14px. É o valor do `text-muted` do
  frontmatter, então a limitação é do design system, não do Leaf.
- O logo (`text-brand`, primary-700) dá 2,69:1 sobre branco. É gráfico
  decorativo com `aria-hidden` ao lado do wordmark, mas se algum dia virar
  elemento informativo precisa de outro degrau.
- `--line` (borda decorativa) é alpha-200 no claro e alpha-inverse-200 no
  escuro, os dois abaixo de 3:1 de propósito, como manda o `border-default` do
  Bonsai. Onde a borda delimita controle interativo o token é `line-strong`.

## Onda 7 — Organizações e importação no slash menu (entregue)

### Modelo de dados

- Migração `drizzle/0002_simple_shinko_yamashiro.sql`: tabelas `organizations`,
  `organization_members` (unique `org_id,user_id`) e `organization_invites`
  (unique `org_id,email`), mais `documents.org_id` e `documents.org_access` com
  índice em `org_id`.
- O `ALTER TABLE ... ADD org_id` gerado pelo drizzle-kit veio **sem** o
  `ON DELETE SET NULL` (mesmo defeito que a onda 4 pegou no `parent_id`). O `.sql`
  foi editado à mão para incluir a cláusula. Se a migração for regerada, confira
  isso de novo.
- **Um usuário pertence a no máximo uma organização.** Não há constraint no banco
  para isso: quem garante é `getMembership` (pega a participação mais antiga) e a
  checagem em `createOrganization` / `acceptPendingInvites`.
- Documento criado por membro de org nasce com `org_id` preenchido e
  `org_access` **null** (privado, como no Notion). Vale para as quatro portas de
  criação: `createDocument`, `duplicateDocument` (copia o `org_id` da origem e
  força `org_access` null), o import de markdown e o import de zip.

### Autorização

- `getDocumentAccess` implementa a precedência da spec, nesta ordem:
  dono → share explícito em `document_shares` → `org_access` (se quem pede é
  membro da MESMA org do doc) → nada. O link público continua num caminho
  separado (`lookupPublicDocument`).
- **Share explícito vence `org_access` nos dois sentidos.** Um share `viewer`
  rebaixa quem teria `editor` pela organização. É o que a spec pede ("share
  explícito > org_access") e tem teste.
- **Admin e dona da org não enxergam documento privado de membro.** Não existe
  nenhum caminho de escalação por papel de organização: o papel da org só decide
  quem administra a org, nunca quem lê documento.
- O limitador in-memory do link público virou uma fábrica
  (`createRateLimiter(windowMs, maxAttempts)`) em `authz.ts`. O lookup público
  segue com 30/60s e os convites de organização ganharam um limitador próprio de
  20/60s por chave `orgId:userId`. Continua por processo, sem persistência.

### Entrar e sair da organização

- Não há email de convite (mesma limitação do compartilhamento por email): o
  convite é uma linha em `organization_invites` e resolve quando a pessoa acessa
  o app logada com aquele email. A resolução acontece em
  `acceptPendingInvites`, chamada no `src/app/(app)/layout.tsx` antes de listar
  os documentos. Rodar isso no layout é idempotente (só age quando a pessoa não
  tem org e existe convite) e cobre login, signup e qualquer navegação.
- Ao virar membro, os documentos que a pessoa já tinha recebem o `org_id`
  (`attachOwnerDocuments`), mantendo `org_access` null. Sem isso, documento
  criado antes de entrar na org nunca poderia ser compartilhado com ela.
- Ao sair ou ser removida, `detachMemberDocuments` zera `org_id` e `org_access`
  dos documentos daquela pessoa: eles voltam a ser privados em vez de continuarem
  visíveis para a org que ela deixou. Shares explícitos que ela já tinha dado
  **não** são tocados.
- A pessoa dona não pode sair enquanto for a única dona, e o papel `owner` não é
  atribuível pela UI (o select só oferece Admin e Membro). Transferência de
  propriedade e exclusão de organização ficaram fora do MVP.

### UI

- Sidebar em três seções: "Organização" (só quando existe org; lista
  `listOrganizationDocuments`, ou seja, docs da org com `org_access` não nulo),
  "Compartilhados comigo" (shares diretos, lista plana como antes) e "Privado"
  (`listPrivateDocuments`, os meus com `org_access` null). A seção
  "Meus documentos" deixou de existir; as chaves `nav.myDocuments` e
  `nav.emptyOwned` foram removidas dos catálogos.
- Cada seção monta a própria árvore. Se um documento privado tem pai
  compartilhado com a org (ou o contrário), ele aparece como raiz na seção dele.
  É consequência de `buildDocumentTree` receber listas já particionadas, e é o
  comportamento desejado: a seção diz o nível de acesso, não a hierarquia.
- `/org` (`src/app/(app)/org/page.tsx`): sem org renderiza
  `CreateOrganizationForm`; com org renderiza `OrganizationManager` (nome,
  membros, convites, sair). Confirmação de saída em
  `leave-organization-dialog.tsx`, AlertDialog no desktop e Sheet no mobile,
  igual ao padrão do `confirm-disable-public-link`.
- O `OrganizationManager` **não** tem live region própria: todo retorno de ação
  passa por `toast`, e o Sonner já mantém a própria região ARIA. Ter as duas
  coisas fazia o leitor de tela anunciar duas vezes (e quebrava o E2E por strict
  mode).
- Modal Compartilhar na ordem da spec: "Organização" (select Sem acesso / Pode
  ver / Pode editar, com o nome da org) → "Pessoas" (convite individual, lista de
  quem tem acesso, badge `warning` "Convidado externo" para email fora da org) →
  link público. Quem não é dono vê o acesso da org como Badge, não como select.
- `org_access` só o dono do documento muda. A ação vive em
  `setOrganizationAccess` (`share-actions.ts`, atrás do mesmo `requireOwner` das
  outras ações do painel) e ainda confere que o doc pertence à org de quem pede.
- Header do documento ganhou o Badge "Organização"
  (`data-testid="document-org-tag"`) quando `org_access` não é null.
- A seção do link público **não** ganhou um `h3` "Link público": a `Label` do
  switch já tem esse nome acessível, e duplicar criaria dois elementos com o
  mesmo nome (foi o que a onda 3 corrigiu ali).

### Importação saiu da sidebar e foi para o slash menu

Decisão de produto do usuário durante a onda 7: **o produto é agnóstico de
origem, a marca Notion não aparece na interface.** Isso supersede o botão na
sidebar que a spec 06 previa.

- `src/components/app/import-button.tsx` foi **removido** e o `NewDocumentButton`
  ficou sozinho no topo da sidebar.
- `notion-import-dialog.tsx` virou
  `src/components/editor/archive-import-dialog.tsx` (`ArchiveImportDialog`), com
  a prop nova `parentId`.
- `src/components/editor/document-import.tsx` é o dono dos dois inputs de arquivo
  escondidos (`data-testid="import-markdown-input"` e `"import-archive-input"`) e
  do modal de progresso. O `BlockNoteEditor` fala com ele por `ref`
  (`DocumentImportHandle`) e só o monta quando o editor é editável.
- Dois itens novos no slash menu, em grupo próprio "Importar":
  - "Importar arquivo .md" insere o markdown convertido **no ponto do cursor**
    (`editor.insertBlocks(blocks, cursor, 'after')`), no documento atual.
  - "Importar exportação .zip" mantém o fluxo de migração: cria as páginas do zip
    como **subpáginas do documento atual** e mostra o modal de progresso.
- `importMarkdown` (que criava um documento novo a partir do .md) foi substituída
  por `importMarkdownBlocks(documentId, mdText)`, que exige `canEdit` no
  documento e **devolve os blocos já sanitizados** em vez de gravar. A gravação
  fica com o autosave do editor. A conversão e a sanitização continuam 100% no
  servidor.
- `POST /api/import/notion` aceita o campo `parentId` no multipart e valida que
  quem pede é `owner` do documento destino (403 caso contrário). O caminho da
  rota continua `/api/import/notion` (não vale quebrar URL por causa de nome);
  o que mudou foi só o rótulo na interface.
- Namespace i18n `notionImport` renomeado para `archiveImport`, e as strings
  visíveis perderam a marca ("Importar exportação", "Escolha um arquivo .zip de
  exportação", "Não encontramos páginas nesse arquivo"). As heurísticas do
  formato do Notion (hash de 32 hex, `<aside>` virando callout, database em csv)
  continuam idênticas em `src/lib/notion/**`.
- Chaves mortas removidas do catálogo: `importFile.button`, `.hint`,
  `.dragging`, `.importing`, `.markdownImported`. O drag and drop de arquivo em
  cima do botão da sidebar morreu junto com o botão; hoje só o file picker.

### Verificação

- `pnpm exec tsc --noEmit` limpo, `pnpm exec vitest run` 136 testes verdes
  (9 arquivos), `next build` verde com a rota `/org` no manifesto,
  `pnpm test:e2e` 28 testes verdes (26 desktop + 2 mobile).
- `e2e/organizations.spec.ts` cobre o roteiro da spec: criar org, convidar,
  documento privado invisível para o membro, "Pode ver" abrindo leitura na seção
  Organização, "Pode editar" liberando a edição, e a terceira conta sem org
  vendo só o documento compartilhado com ela; mais gestão de papel, remoção e
  saída da org.
- `e2e/import-export.spec.ts` e `e2e/notion-import.spec.ts` foram reescritos para
  o fluxo novo (importação dentro de um documento aberto) e há um caso que prova
  que os dois itens estão no slash menu, que a sidebar não tem mais o botão e que
  a palavra "Notion" não aparece na tela.

### Pendências desta onda

- **`notFound()` em `/doc/[id]` responde 200, não 404.** O layout do app já
  começou a streamar quando o `notFound()` acontece, então o status não muda mais
  (em `/share/[token]` o layout é leve e o 404 sai certo). A tela de "Documento
  não encontrado" aparece normalmente e o acesso continua barrado; é só o código
  HTTP. Por isso o E2E de organização confere o conteúdo, não o status.
- Sem transferência de propriedade da org, sem exclusão de organização e sem
  segunda organização por pessoa. (A segunda organização passou a existir na
  onda 11; o resto continua de fora.)
- O convite não valida se o email existe (de propósito, para não vazar a
  existência de conta), então convite para email errado fica pendente para
  sempre até alguém cancelar.
- A rota de import continua se chamando `/api/import/notion` e o módulo
  `src/lib/notion/**` mantém o nome. Só a interface é agnóstica.
- O painel de compartilhamento só devolve `orgName`/`orgAccess` para o dono do
  documento ou para quem é membro daquela organização. Convidado externo não
  descobre o nome da org nem quem faz parte dela (o badge "Convidado externo"
  também não aparece para ele, só para o dono).
- Quando alguém aceita um convite, os convites pendentes para **aquele email em
  qualquer organização** são apagados junto. Como só dá para pertencer a uma org,
  os outros nunca resolveriam e ficariam pendentes para sempre. O efeito
  colateral é que o admin da outra organização vê o convite sumir sem aviso.

### Ajustes do design-review da onda 7

- **🔴 corrigido:** o Badge "Organização" somado a "Compartilhar" e ao menu ⋯
  dava ~341px de conteúdo que não encolhe no header do documento. Em telas de
  320 a 430px isso esmagava o input do título (5px de largura em 390px) e
  chegava a estourar a linha em 320px. O container do título ganhou
  `basis-full tablet:basis-0` e o cluster de ações ganhou `shrink-0`: até
  767px o título ocupa a linha inteira e as ações caem para a segunda.
- Confirmações destrutivas de organização (remover membro, sair) deixaram de ser
  dismissíveis por `Esc` e clique fora, como manda o `components/modal.md`. O
  `confirm-disable-public-link` da onda 3 continua dismissível; é a mesma dívida
  e ficou registrada aqui.
- `text-body-small`/`text-heading-medium` foram removidos dos `SheetTitle`/
  `SheetDescription` dos dois dialogs novos: o `cn` é `twMerge` sem
  `extendTailwindMerge` e essas classes eram silenciosamente descartadas pela cor
  passada no mesmo `className`. O tamanho correto já vem da base do componente.
- Cancelar convite ganhou "Desfazer" no toast (10s), igual a remover acesso e à
  lixeira.
- O nome no dialog de remoção passou a viver num estado próprio
  (`removingName`), senão o título ficava "Remover  da organização?" durante os
  200ms da animação de saída.
- Linha de membro: nome e email quebram para a linha inteira até `tablet` (o
  select de papel mais o remover comiam 216px dos 343px do mobile) e ganharam
  `title`, como no painel de compartilhar.
- O cartão de "Criar organização" era `bg-surface-nav` sobre `bg-surface-app`
  (1,02:1 no tema claro, invisível). Virou `bg-surface-card` com
  `shadow-down-small`, que é o que o `card-standard` do frontmatter pede.
- Fechar o modal de progresso da importação durante a execução agora **aborta** o
  fetch em vez de deixar a importação rodando sem nenhum indicador na tela.
- O contador "N de M" do progresso subiu de `text-caption` (12px) para
  `text-body-small` (14px), o mínimo de corpo do Bonsai.
- O cabeçalho "Organização" da sidebar virou link para `/org`. Antes o único
  caminho para a gestão era o menu do usuário atrás do avatar.
- **Mudança de label de navegação (pendente de confirmação de produto):** a seção
  "Meus documentos" virou "Privado" e a seção "Organização" foi criada acima
  dela. O protocolo de redesign do Bonsai pede confirmação para label de
  navegação; fica registrado aqui como as ondas 4 e 5 fizeram. A remoção do botão
  "Importar arquivo" da sidebar já é decisão explícita do usuário.
- **Não corrigido (fora do escopo, dono é `src/components/ui/**`):** o
  `input.tsx` ainda tem `rounded-md` (6px onde o frontmatter pede 8px),
  `shadow-xs` (sombra preta pura do shadcn) e `md:text-sm` (14px em desktop
  contra os 16px de `input-default`). A nota da onda 6 dizia que isso tinha sido
  corrigido, mas o `git log` mostra que o arquivo não mudou desde `a36b70b`: a
  nota estava errada. Afeta todos os formulários de `/org` e do compartilhar.
- Também ficaram para depois, sem impacto funcional: devolver o foco a um heading
  depois de remover membro/cancelar convite (hoje o foco cai no `body` quando o
  `router.refresh` desmonta o botão) e a entrada de importação na tela vazia de
  quem ainda não tem nenhum documento.

## Onda 8 — Histórico de versões (entregue)

### Modelo de dados

- Migração `drizzle/0003_wet_frank_castle.sql`: tabela `document_versions`
  (`id`, `document_id`, `title`, `content`, `author_id`, `created_at`) com
  índices `(document_id, created_at)` e `(author_id)`.
- **Aqui o drizzle-kit acertou o `ON DELETE`**: o defeito das ondas 4 e 7 é
  específico de `ALTER TABLE ... ADD COLUMN`; num `CREATE TABLE` as cláusulas
  saem completas (`document_id` cascade, `author_id` set null). Nada foi editado
  à mão no `.sql`. Se um dia entrar uma coluna nova por ALTER, confira de novo.
- `author_id` é **nullable com `set null`** de propósito: uma versão escrita por
  um editor convidado sobrevive à exclusão da conta dele (o documento é de outra
  pessoa e não cascateia). A UI mostra "Autor removido" nesse caso.
- `created_at` é o único timestamp do schema em `timestamp_ms` (os outros são
  `unixepoch()` em segundos). Motivo: com resolução de segundo, várias versões
  do mesmo segundo ficam sem ordenação estável. A ordenação é
  `desc(created_at), desc(id)`.

### Regras de gravação (`src/lib/document-versions.ts`)

- `recordDocumentVersion(documentId, authorId, { force?, now? })` grava o estado
  **já persistido** do documento (título + conteúdo), então é chamada **depois**
  do `update`. Cada linha de versão é um estado que existiu de verdade.
- Throttle de 5 min **por autor por documento** (`VERSION_THROTTLE_MS`): olha a
  última versão daquele autor naquele documento. Autores diferentes não se
  bloqueiam.
- Guarda de duplicata: se a versão mais recente do documento já tem o mesmo
  `content` **e** o mesmo `title`, nada é gravado (vale inclusive no `force`).
  Isso é o que impede lixo quando duas pessoas salvam o mesmo estado e quando
  alguém restaura a mesma versão duas vezes seguidas.
- Retenção: `MAX_VERSIONS_PER_DOCUMENT = 50`, podadas **no insert**
  (`pruneDocumentVersions`). A poda lê os ids do documento e apaga o excedente;
  com teto de 50 linhas isso é barato e evita `LIMIT/OFFSET` no SQLite.
- Os dois números vivem em `src/lib/version-limits.ts`, **não** em
  `document-versions.ts`. Motivo concreto: o dialog é client component e importar
  a constante do módulo de dados arrastaria `@/db` (better-sqlite3) para o bundle
  do cliente. `document-versions.ts` só re-exporta.

### Onde a versão nasce

- `updateDocumentContent` (`document-actions.ts`): chama
  `recordDocumentVersion` depois do update, sem `force`. O guard de no-op que a
  onda 5 introduziu continua vindo **antes**, então salvar conteúdo idêntico não
  gera versão nem `updated_at` fantasma.
- `importMarkdownBlocks` (`markdown/import-action.ts`): grava com `force: true`
  **antes** de devolver os blocos, ou seja, congela o estado *anterior* à
  importação. É o que permite desfazer um import pelo histórico.
- `applyDocumentVersion`: grava o estado atual com `force: true` antes de
  aplicar a versão escolhida.
- O import de `.zip` **não** gera versão: ele cria subpáginas novas e não toca o
  conteúdo do documento aberto.

### Autorização

- `src/lib/version-actions.ts` (`'use server'`) é a única porta da UI:
  `loadDocumentVersions`, `loadDocumentVersion` e `restoreDocumentVersion`, todas
  atrás do mesmo `requireEditor` (`canEdit(getDocumentAccess(...))`). **Viewer
  não lista, não pré-visualiza e não restaura**, e o item do menu nem é
  renderizado para ele.
- `restoreDocumentVersion` também restaura o **título** da versão, não só o
  conteúdo. O `title` está na tabela justamente para o round-trip ficar completo.
- Versão de outro documento devolve `notFound` mesmo que o id exista (o `where`
  casa `id` **e** `document_id`).

### UI

- `src/components/app/document-history-dialog.tsx`. É `Dialog`, não `Sheet`: a
  cópia local de `ui/dialog.tsx` (onda 5) já vira bottom sheet até `tablet` e
  modal centralizado a partir dele, então um `Sheet` manual só duplicaria o
  padrão. Largura `tablet:max-w-4xl` (o `tablet:max-w-lg` da base perde no
  twMerge porque é a mesma variante).
- Desktop: duas colunas (lista `tablet:max-w-72` + pré-visualização). Mobile
  (`useIsMobile`): duas telas alternadas, com "Voltar para a lista" e foco
  reposicionado nos dois sentidos (`backRef` na ida, `[data-version-id]` na
  volta).
- Data relativa vem do `useFormatter().relativeTime` do next-intl com um `now`
  congelado no carregamento da lista; a data absoluta vai no `title` do item e no
  cabeçalho da pré-visualização.
- A pré-visualização usa o `DocumentRenderer` existente (read-only). O container
  tem `role="region"` + `aria-label` + `tabIndex={0}` para o scroll ser
  alcançável por teclado dentro do modal.
- Restaurar tem confirmação **inline** (pergunta + Cancelar/Restaurar no lugar do
  botão), não um AlertDialog: dialog dentro de dialog é ruim em mobile e a ação é
  reversível pelo próprio histórico. Os labels dos botões são fixos.
- **Depois de restaurar a página recarrega (`window.location.reload()`).** O
  `useCreateBlockNote` não recria a instância quando `initialContent` muda, e
  keyar o `DocumentEditor` pelo conteúdo faria o editor remontar no meio da
  digitação a cada `revalidatePath` (risco real de perder texto). O reload é
  seguro porque abrir o menu ⋯ tira o foco do editor e dispara o flush do
  autosave antes. Como o toast morre no reload, a confirmação viaja num flag de
  `sessionStorage` (`leaf:version-restored`, guardando o `documentId`) lido no
  mount do dialog — `takeSessionFlag`/`writeSessionFlag` novos em
  `src/shared/storage.ts`.
- `DocumentMenu` ganhou a prop `canEdit` (além de `isOwner`) e devolve o foco ao
  botão ⋯ ao fechar o dialog de histórico **e** o de mover (o Radix deixava o
  foco no `body` porque o item de menu que abriu o dialog já tinha sido
  desmontado). Há assert de foco no E2E.
- i18n: namespace novo `versions` (17 chaves) com paridade pt-BR/en-US. A
  retenção de 50 aparece na descrição do dialog via parâmetro `{max}`, ligado à
  constante.

### Ajustes vindos do design-review

Todos os 🔴 corrigidos e a maior parte dos 🟡:

- `tabIndex` + anel de foco no container de scroll da pré-visualização.
- Gestão de foco na troca lista ⇄ pré-visualização no mobile.
- `gap-0.5` (2px, fora da escala) virou `gap-1`.
- Item selecionado ganhou `border-l-2 border-brand-strong` além do
  `bg-brand-surface`: `brand-surface` sozinho dá 1,06:1 contra o card no claro,
  ou seja, seleção invisível para quem não lê o negrito.
- Live region com "Carregando" enquanto a restauração está no ar.
- Itens da lista ficam `disabled` durante a restauração (evita trocar de versão
  no meio da ação).
- `selectPrompt` deixou de aparecer junto com o estado vazio e com o de erro.
- Título da versão foi de `heading-medium` (20px, empatava com o `DialogTitle`)
  para `body-medium` + `font-bold`.
- `overflow-y-hidden` no `DialogContent` foi **tentado e revertido**: ele mata o
  scroll de emergência da base em telefone deitado (~320px de altura útil), onde
  a caixa de confirmação estoura. Hoje o `DialogContent` é só
  `flex flex-col tablet:max-w-4xl` e o `max-h-[85dvh]`/`overflow-y-auto` vêm da
  base.

### Verificação

- `pnpm exec tsc --noEmit` limpo, `pnpm exec vitest run` **151 testes verdes**
  (10 arquivos; 15 novos em `src/lib/document-versions.test.ts` cobrindo
  throttle, janela por autor, `force`, guarda de duplicata, poda em 50, poda no
  insert, isolamento entre documentos, round-trip de restauração, versão de outro
  documento, autor removido e cascade do documento).
- `LEAF_DIST_DIR=.next-build pnpm build` verde.
- `pnpm test:e2e` **32 testes verdes** (29 desktop + 3 mobile), com
  `e2e/versions.spec.ts` (throttle segurando a segunda edição, pré-visualização
  sem o texto novo, restauração mudando o editor, segunda versão aparecendo
  depois, foco voltando ao ⋯ no fechamento; e leitor sem o item de menu contra
  editor convidado com o histórico) e o caso mobile novo em `e2e/mobile.spec.ts`.

### Pendências desta onda

- **A versão não guarda diff, só o snapshot inteiro.** Um documento grande com 50
  versões multiplica o `content` por 50 no SQLite. Para o MVP local isso é
  aceitável; em produção seria caso de compressão ou de guardar delta.
- Não há "nomear versão" nem marcação manual de ponto de restauração.
- A lista não mostra o que mudou entre versões (sem diff visual). Escolher a
  versão certa depende de abrir a pré-visualização.
- Restaurar recarrega a página inteira. Some quando o editor souber trocar de
  conteúdo sem remontar (provavelmente na onda 12, com Yjs).
- O throttle é por autor, então N autores editando ao mesmo tempo podem gerar N
  versões em 5 minutos. É intencional (cada um tem direito ao próprio ponto de
  volta), mas acelera a poda dos 50.
- Quem restaura vira o autor da versão de segurança gerada nesse momento, ainda
  que o conteúdo congelado seja de outra pessoa. A UI não distingue "autor do
  texto" de "quem disparou o snapshot".
- Documento na lixeira não expõe histórico (a tela do documento nem abre); as
  versões só somem de vez no "Excluir de vez", pelo cascade.

## Onda 9 — Comentários e papel "Pode comentar" (entregue)

### Modelo de dados

- Migração `drizzle/0004_amused_daredevil.sql`: tabela `comments` (`id`,
  `document_id`, `parent_id`, `block_id`, `author_id`, `body`, `resolved_at`,
  `created_at`, `updated_at`) com índices `(document_id, created_at)`,
  `(parent_id)` e `(author_id)`.
- **O `CREATE TABLE` emitiu os três `ON DELETE` certos** (`document_id` cascade,
  `parent_id` cascade, `author_id` set null), confirmando a regra da onda 8: o
  defeito do drizzle-kit é específico de `ALTER TABLE ... ADD COLUMN`. Nada foi
  editado à mão; conferido também no `data/leaf.db` real com
  `pragma foreign_key_list(comments)`.
- **Widening de enum não gera DDL.** `document_shares.role` e
  `documents.org_access` passaram a aceitar `commenter`, mas no SQLite o
  `text('...', { enum: [...] })` do drizzle é só `TEXT` sem `CHECK`, então a
  migração não tem nenhum `ALTER`. Quem valida o valor é `isShareRole` em
  `share-actions.ts`.
- `author_id` é **nullable com `set null`**, mesma decisão da onda 8: o
  comentário de um convidado sobrevive à exclusão da conta dele e a UI mostra
  "Autor removido". Consequência intencional: comentário sem autor não pode mais
  ser editado nem excluído por ninguém (a checagem é `authorId === viewerId`, e
  `null` nunca casa), e só editor+ consegue resolvê-lo.
- `created_at`/`updated_at`/`resolved_at` são `timestamp_ms` (como
  `document_versions.created_at`), para a ordenação ser estável entre comentários
  do mesmo segundo.
- `updated_at` **não** é tocado por resolver/reabrir, só por edição do corpo. É o
  que faz o marcador "editado" (`updatedAt > createdAt`) significar edição de
  verdade.

### Autorização

- `AccessLevel` virou `owner | editor | commenter | viewer` e o `levelRank` de
  `authz.ts` passou a `viewer 1 < commenter 2 < editor 3 < owner 4`. `canEdit`
  continua exigindo `editor`, então **commenter não edita o documento**; entrou
  `canComment` (exige `commenter`).
- A precedência de `getDocumentAccess` não mudou de forma (dono → share
  explícito → `org_access` → nada); só passou a poder devolver `commenter` por
  qualquer um dos dois caminhos. `authz.test.ts` ganhou os casos dos dois
  sentidos: share `commenter` no lugar de `viewer`, e share `editor` subindo
  sobre um `org_access` `commenter`.
- `src/lib/comment-actions.ts` (`'use server'`) é a única porta da UI. Regras:
  **ler** exige qualquer acesso ao documento (decisão registrada: leitura de
  comentário acompanha leitura do doc, então viewer vê as conversas);
  **comentar** exige `canComment`; **editar/excluir** só o autor; **resolver ou
  reabrir** o autor da conversa ou `canEdit`. Toda ação devolve o estado inteiro
  (`threads`, `viewerId`, `canComment`, `canResolveAny`, `openCount`), como o
  `ShareState` da onda 2 — o painel nunca faz merge otimista.
- Rate limit de criação: `registerCommentAttempt`, 30 por 60s na chave
  `documentId:userId`, criado com a mesma fábrica `createRateLimiter` que a onda
  7 extraiu. Continua in-memory por processo.
- **A página pública `/share/[token]` não mostra comentários** e não tem como
  chegar neles: o `CommentsPanel` só é montado pelo `document-header.tsx`, que é
  exclusivo de `/doc/[id]`, e todas as actions passam por `getDocumentAccess`,
  que ignora o caminho do `public_token`.

### Âncora em bloco

- A âncora é o **id de bloco do BlockNote** (`block_id`), que é estável no JSON e
  é renderizado no DOM como `data-id` (confirmado no `addGlobalAttributes` do
  core). Resposta não tem âncora própria: `createComment` zera o `blockId` quando
  há `parentId`, porque a conversa inteira pendura no bloco da raiz.
- Só um nível de resposta: `createComment` recusa `parentId` que aponte para um
  comentário que já tem pai, e recusa pai de outro documento.
- `src/components/comments/comments-bridge.ts` liga editor e painel sem prop
  drilling entre árvores React separadas (o painel vive no header, o editor no
  corpo da página): um store de módulo com `useSyncExternalStore` para os ids de
  bloco vivos, mais dois CustomEvents de janela (`leaf:comment-request` da
  toolbar para o painel, `leaf:comment-focus-block` do painel para o editor). É a
  mesma família de solução do `focus-bridge.ts` da onda 5.
- **"Sem âncora" nunca é chute:** o store guarda um flag `ready` e
  `isAnchorMissing` só devolve `true` depois que o editor publicou os ids pelo
  menos uma vez. Sem isso, todo comentário apareceria como órfão no primeiro
  paint, antes de o editor montar.
- Clicar em "Ir para o trecho comentado" fecha o painel, espera os 320ms da
  animação de saída do Sheet e então rola até o bloco com destaque temporário de
  2,2s (`.leaf-comment-target`). **O painel fecha nos dois breakpoints, não só no
  mobile**: o Sheet é Radix Dialog modal, então no desktop o bloco ficaria atrás
  do overlay `alpha-800` e fora do trap de foco (🔴 do design-review).
- Se o bloco não existe mais no DOM, o clique cai num `toast.error` e a conversa
  segue viva com o badge "Sem âncora". Nenhum caminho apaga comentário por causa
  de bloco removido.

### UI

- `CommentsPanel` (`src/components/comments/comments-panel.tsx`) renderiza o
  gatilho **e** o painel. O gatilho fica no cluster de ações do
  `document-header.tsx` com o contador de conversas abertas; o número inicial vem
  do servidor (`countOpenComments` em `doc/[id]/page.tsx`), e depois é o estado
  devolvido pelas actions que manda.
- É `Sheet`, não `Dialog`: `side="right"` no desktop (`sm:max-w-md`, casando a
  variante `sm:` da base para o twMerge deduplicar) e `side="bottom"` com
  `h-[85dvh]` no mobile, onde usa o `SheetHeader type="close"` (fechar de 48px).
  A cópia local de `ui/dialog.tsx` já vira bottom sheet sozinha, mas aqui o
  painel precisa conviver com o editor, e Sheet é o componente do padrão.
- `CommentThreadItem` cuida de uma conversa: meta do autor, corpo, âncora,
  respostas, e confirmação **inline** de exclusão (não AlertDialog: dialog dentro
  de dialog é ruim no mobile, mesma decisão da onda 8 para restaurar versão).
- Conversas resolvidas somem por padrão e voltam pelo switch "Mostrar
  resolvidos", que só aparece quando existe alguma resolvida. O estado vazio
  distingue "ainda não há comentários" de "todos foram resolvidos".
- Botão "Comentar" na `formatting-toolbar.tsx` custom, via
  `Components.FormattingToolbar.Button` do `useComponentsContext()` (o `label`
  vira `aria-label` e o `mainTooltip` vira tooltip, conferido no bundle do
  `@blocknote/shadcn`). Ele é renderizado só quando `canComment`.
- Feedback é só `toast`, sem live region própria — a região ARIA do Sonner já
  cobre, e ter as duas coisas fazia o leitor de tela anunciar duas vezes (o
  mesmo que a onda 7 corrigiu no `OrganizationManager`).
- i18n: namespace novo `comments` (46 chaves) com paridade pt-BR/en-US, mais
  `share.roleCommenter` e três chaves em `errors`. Os selects de papel do modal
  Compartilhar (pessoas **e** organização) passaram a ser gerados de um array
  `roleOptions`, então a terceira opção entrou nos três lugares de uma vez.

### Verificação

- `pnpm exec tsc --noEmit` limpo e `pnpm exec vitest run` **174 testes verdes**
  (11 arquivos; 23 novos: 19 em `src/lib/comments.test.ts` cobrindo criação
  ancorada, corpo vazio, corte no limite, resposta de um nível, recusa de
  resposta de resposta e de pai em outro documento, ordenação, contagem de
  abertas, resolver/reabrir sem mexer no `updated_at`, resposta que não resolve,
  edição, exclusão em cascata da conversa, cascade do documento, `set null` do
  autor e isolamento entre documentos; mais 4 em `authz.test.ts` para a
  precedência nova).
- Design-review rodado nos 10 arquivos de UI, nos dois temas: os quatro 🔴 e a
  maior parte dos 🟡 foram corrigidos no commit `fix(comments)`.

### Ajustes vindos do design-review

- **🔴 destaque invisível:** `.leaf-comment-target` era só `bg-warn-surface`,
  que dá 1,03:1 no claro e 1,04:1 no escuro contra o fundo do editor. Ganhou
  `ring-2 ring-warn` (`warning-800` no claro = 5,27:1, `warning-300` no escuro).
- **🔴 área de toque:** o `size="lg"` do `ui/button.tsx` deste repo é **40px**,
  não 44. Saiu dos nove CTAs do painel (o default é h-12) e as quatro ações da
  conversa, que são `size="sm"` (32px), ganharam
  `h-auto min-h-11 px-2 py-1 tablet:min-h-0`.
- **🔴 header estourando em 375px:** o cluster de ações era `shrink-0` sem
  `flex-wrap`; com o Badge "Organização" mais o botão novo passava de 400px numa
  linha de 343px. Virou `flex-wrap justify-end`.
- **🔴 rolar até o bloco atrás do overlay** (descrito na seção da âncora).
- 🟡 corrigidos: o painel afirmava "você não pode comentar" durante o
  carregamento; estado vazio mentia quando tudo estava resolvido; a legenda do
  rascunho ancorado reusava o texto do botão "Ir para o trecho"; dois CTAs
  "Responder" com o mesmo nome acessível no mesmo card (o de envio virou "Enviar
  resposta"); âncora antiga sobrevivia ao reabrir o painel pelo header; alvo de
  toque do switch "Mostrar resolvidos"; e a validação morta do rascunho, que
  mostrava o placeholder como mensagem de erro num caminho inalcançável.

### Pendências desta onda

- **O botão "Comentar" da toolbar depende de a formatting toolbar do BlockNote
  aparecer, e no modo somente-leitura isso não foi verificado em navegador.** No
  bundle, cada botão default do pacote começa com `if (!editor.isEditable) return
  null`, mas nem a `FormattingToolbar` nem o `FormattingToolbarController` têm
  essa guarda, então o botão custom deveria aparecer sozinho para quem só
  comenta. Enquanto isso não for confirmado, o caminho garantido para o
  `commenter` é o composer do painel, que cria comentário **sem âncora**. Se a
  toolbar não aparecer, a correção é dar ao commenter outro jeito de escolher o
  bloco.
- O comentário não tem menção a pessoa, notificação, nem anexo.
- A âncora é o bloco inteiro, não o intervalo de texto selecionado. A copy fala
  em "trecho"; alinhar o vocabulário (ou ancorar no range) ficou para depois.
- `maxLength` corta o texto sem contador visível.
- O painel não faz polling: comentário criado por outra pessoa só aparece ao
  reabrir o painel, e o contador do header só no reload da página.
- O select de papel não explica o que cada opção libera (heurística 10).
- Sem paginação: documento com muitas conversas carrega todas de uma vez.

## Onda 10 — Busca full-text e command palette (entregue)

### Índice FTS5

- Migração `drizzle/0005_search_index.sql`, gerada com
  `drizzle-kit generate --custom --name search_index` (o drizzle-kit não modela
  tabela virtual). Ela cria `documents_fts` como FTS5 comum, colunas
  `document_id UNINDEXED, title, body, indexed_at UNINDEXED` e
  `tokenize = 'unicode61 remove_diacritics 2'` (é o que faz "relatorio" achar
  "relatório", mesma tolerância a acento do filtro client-side da onda 5).
- **A tabela não entra no `src/db/schema.ts`.** O drizzle-kit compara o schema
  com o snapshot em `drizzle/meta/*.json`, e o `0005_snapshot.json` é uma cópia
  do 0004, então uma `pnpm db:generate` futura não tenta dropar `documents_fts`.
  Todo acesso ao índice é `sql` cru em `src/lib/search-index.ts`.
- O texto indexado vem de `blocksToPlainText` (`src/components/editor/text-stats.ts`,
  da onda 5) — o arquivo é server-safe (sem `'use client'`, sem React), então foi
  reusado em vez de duplicar a extração. Conteúdo ilegível vira string vazia em
  vez de estourar. Corpo cortado em 200 mil caracteres.
- **Duas rotas de sincronização, de propósito:**
  - `indexDocument(id)` no save: `renameDocument` e `updateDocumentContent`;
    `removeDocumentFromIndex` no `deleteForever`.
  - `reconcileSearchIndex()` roda **antes de cada busca**: apaga linhas de
    documento que não existe mais e reindexa todo documento cujo `indexed_at`
    difere do `updated_at`. É o que cobre backfill do banco que já existia,
    `createDocument`, `duplicateDocument`, restauração de versão e os imports,
    sem espalhar chamada de índice por seis arquivos. O diff é um LEFT JOIN e no
    caso normal devolve zero linhas.
- Lixeira **não** mexe no índice: quem filtra `deleted_at` é a consulta.

### Autorização da busca (no servidor, sempre)

- `searchAccessibleDocuments(viewer, query)` e
  `listRecentAccessibleDocuments(viewer)` embutem no `where` a mesma precedência
  de leitura do `getDocumentAccess`: dono, ou share explícito por email, ou
  `org_access` não nulo com participação na org do documento. Nada é filtrado no
  cliente, e a server action `searchWorkspace` (`src/lib/search-actions.ts`) só
  passa o `userId`/`email` da sessão — a query nunca vem do cliente.
- `src/lib/search-index.test.ts` (24 casos) trava isso: documento privado de
  terceiro não aparece nem por título nem por corpo, documento compartilhado
  aparece só para quem recebeu, `org_access` aparece só para membro da org,
  lixeira não aparece.
- A consulta do usuário nunca vira sintaxe FTS: `buildMatchExpression` quebra em
  tokens de letra/número, joga fora o resto (`NEAR`, `OR`, `-`, aspas viram
  tokens comuns) e monta `"tok"* "tok2"*`, ou seja, AND implícito com prefixo.
  Sem isso, um `"` solto derruba a query com erro de sintaxe do FTS5.
- Ranking: `bm25(documents_fts, 0.0, 10.0, 1.0, 0.0)` — título pesa 10x o corpo.

### Trecho destacado sem HTML

- O `snippet()` do FTS5 marca o termo com `char(2)`/`char(3)` (STX/ETX), e
  `parseSnippet` transforma isso em `[{ text, highlight }]`. O destaque é
  renderizado como `<span>` a partir desse array, então **nada de
  `dangerouslySetInnerHTML`** e conteúdo do documento nunca vira markup.

### Command palette

- `src/components/app/command-palette.tsx` monta uma vez, no `AppShell`;
  `command-palette-trigger.tsx` é o botão "Buscar em tudo" e vive dentro do
  `NavContent`, que renderiza **duas vezes** (aside do desktop e Sheet do
  mobile). Por isso a palette e o gatilho são componentes separados: dois
  listeners globais de teclado dariam toggle duplo. O gatilho fala com a palette
  pelo evento `leaf:palette-open` (`palette-bridge.ts`).
- Não existe componente `command` na cópia local do design system e o repo não
  tem `cmdk`. A palette é `@radix-ui/react-dialog` cru (Portal + `DialogOverlay`
  do `ui/dialog`) com `DialogPrimitive.Content` próprio: o `DialogContent` da
  cópia local é bottom sheet até `tablet` com posicionamento fixo, e brigar com
  aquelas classes no twMerge sairia pior. Padrão ARIA: input
  `role="combobox"` + `aria-activedescendant`, lista `role="listbox"`, seções
  `role="group"`, itens `role="option"` — o foco fica no input o tempo todo,
  que é o que faz setas e Enter funcionarem sem roubar foco.
- Seções: **Recentes** com a query vazia (7 itens, `updated_at desc`),
  **Documentos** com os hits do FTS (8 itens) e **Ações rápidas**
  (Novo documento, Ir para Organização quando existe org, Importar arquivo),
  que também são filtradas pelo texto digitado.
- Debounce de 200 ms na busca; a lista de recentes carrega sem espera. Resposta
  fora de ordem é descartada por um contador de requisição.

### Precedência do Cmd/Ctrl+K com o link do BlockNote

- O `CreateLinkButton` do `@blocknote/react` registra o listener **no elemento do
  editor** e chama `preventDefault()` (confirmado no bundle:
  `(e.ctrlKey || e.metaKey) && e.key === "k" && (l(!0), e.preventDefault())`).
  Ele só existe enquanto a formatting toolbar está montada, ou seja, com texto
  selecionado.
- `shouldTogglePalette` (`palette-shortcut.ts`, testado em vitest) decide no
  listener de janela, em fase de bolha: com Meta/Ctrl+K ignora quando
  `event.defaultPrevented` (o BlockNote já tratou) **ou** quando há seleção não
  colapsada dentro de `.bn-editor`; **Alt/Option+K abre sempre**, mesmo com
  seleção. Os dois sinais são redundantes de propósito — `defaultPrevented` é o
  preciso, a checagem de seleção é a rede de segurança.
- **Alt+K precisa do `event.code`:** no macOS Option+K produz `key === '˚'`.
  Por isso o sinal carrega `key` e `code` e casa `KeyK` em qualquer um dos dois.
- `Cmd/Ctrl+P` da sidebar continua sendo o filtro rápido da árvore, como o
  roadmap pediu. São dois campos de busca com propósitos diferentes: o da
  sidebar filtra títulos da árvore no cliente, a palette busca o conteúdo no
  servidor. Os rótulos separam ("Buscar documento" x "Buscar em tudo").

### Ação "Importar arquivo"

- Com um editor editável na tela, a ação dispara `leaf:palette-import` e o
  `BlockNoteEditor` abre o seletor de arquivo do `DocumentImport` (o mesmo do
  slash menu). Fora de um documento, grava o flag de sessão
  `leaf:palette-import-pending` e cria um documento novo; o editor consome o
  flag no mount e abre o seletor. **O caminho do documento novo foi verificado no
  E2E?** Não: o E2E cobre o caminho do documento aberto (com
  `page.waitForEvent('filechooser')`). No documento novo o `input.click()`
  acontece depois da navegação, e navegador que exija ativação transitória do
  usuário pode engolir o clique. Se isso aparecer, a correção é trocar a abertura
  automática por um toast com ação.
- `setImportAvailability` é um store de módulo com `useSyncExternalStore`, mesma
  família do `comments-bridge.ts` da onda 9.

### Destaque do bloco comentado (bug da onda 9 corrigido aqui)

- **`e2e/comments.spec.ts` já estava vermelho antes desta onda.** Confirmado
  rodando o teste em `bfc3338` (commit anterior à onda 10): falha igual.
- Causa raiz medida com sonda no navegador: `target.classList.add(...)` era
  aplicado num nó **dentro do contenteditable**, e o `DOMObserver` do ProseMirror
  reverte mudança de atributo em nó que ele gerencia. A classe existia
  sincronamente durante o evento e sumia antes do próximo macrotask — ou seja, o
  destaque nunca apareceu para ninguém, nem em teste nem em uso real.
- Correção: o realce virou uma regra de estilo gerada fora da árvore do editor
  (`<style>` com `.leaf-editor .bn-block-outer[data-id="..."]`), guardada por
  `blockIdPattern` para o id nunca virar injeção de CSS. As regras
  `.leaf-comment-target` saíram do `editor.css`. Perdeu-se a transição de
  300 ms na saída (regra que aparece e some não transiciona); o realce continua
  2,2 s com `bg-warn-surface` + anel `warn`.
- O teste passou a conferir o `box-shadow` computado do bloco ancorado (e a
  ausência dele no outro bloco), que é a prova de que o destaque está visível,
  não só de que uma classe existe.

### Verificação

- `pnpm exec tsc --noEmit` limpo, `pnpm exec vitest run` **207 testes verdes**
  (13 arquivos; 33 novos: 24 em `src/lib/search-index.test.ts` e 9 em
  `src/components/app/palette-shortcut.test.ts`).
- `LEAF_DIST_DIR=.next-e2e next build` verde.
- `pnpm test:e2e` **47 testes verdes** (41 desktop + 6 mobile), com
  `e2e/search.spec.ts` (6 casos) e um caso novo em `e2e/mobile.spec.ts`.

### Pendências desta onda

- `reconcileSearchIndex` roda a cada busca e faz um LEFT JOIN na tabela inteira
  de documentos mais um scan do FTS (coluna `UNINDEXED` não tem índice). Para o
  MVP local, com dezenas ou centenas de documentos, é barato; num banco grande
  isso vira caso de sincronizar só no save e mover o backfill para um script.
- O índice guarda o texto plano inteiro do documento, ou seja, duplica o
  conteúdo no SQLite.
- A busca não cobre comentários, títulos de versão, nem o nome de quem escreveu.
  Também não busca documento na lixeira.
- O item de resultado mostra título e trecho, **não** o caminho dos ancestrais
  (o filtro da sidebar mostra). Faltou espaço e a consulta pediria CTE recursiva.
- Sem paginação e sem "ver todos os resultados": o teto é 8 documentos.
- A palette não tem histórico de buscas recentes nem ações de documento
  (renomear, mover, compartilhar) — só as três ações do roadmap.
- `e2e/comments.spec.ts:280` ("bloco apagado ... sem âncora") falhou uma vez
  numa rodada e passou em `--repeat-each=2` isolado e na rodada completa
  seguinte: é flake de timing de teclado (`Control+a` + `Backspace`), não
  regressão. Fica registrado para não assustar quem pegar a próxima onda.
- Esta onda **não passou pelo design-review**, conforme a decisão registrada no
  topo do `docs/ROADMAP.md`: o review consolidado roda ao final da onda 12. O
  que foi medido no navegador, para adiantar caminho: a palette resolve os dois
  temas (fundo branco / gray-900 no escuro) e o texto do item selecionado dá
  4,83:1 no claro (gray-700 sobre gray-200) e 7,44:1 no escuro (gray-300 sobre
  gray-800). O resto da tela não foi auditado.

## Onda 11 — Teamspaces + múltiplas organizações (entregue)

### Modelo de dados

- Migração `drizzle/0006_green_mother_askani.sql`: `teamspaces` (`id`, `org_id`
  cascade, `name`, `access` `open|closed` default `open`, `created_at`),
  `teamspace_members` (`id`, `teamspace_id` cascade, `user_id` cascade, `role`
  `owner|member`, unique `(teamspace_id,user_id)`) e
  `documents.teamspace_id`.
- **O defeito das ondas 4 e 7 se repetiu:** o `ALTER TABLE documents ADD
  teamspace_id` saiu do drizzle-kit sem `ON DELETE`. O `.sql` foi editado à mão
  para `... REFERENCES teamspaces(id) ON DELETE SET NULL`. Se a migração for
  regerada, confira de novo.
- No `.sql` gerado, `CREATE TABLE teamspace_members` vem **antes** de
  `CREATE TABLE teamspaces`. O SQLite aceita FK apontando para tabela que ainda
  não existe, então tanto o migrator do boot quanto o harness dos testes
  (que executa os `.sql` em ordem) passam.
- `documents.teamspace_id` é a única fonte da verdade sobre "o documento vive
  num teamspace". `org_id` continua existindo em paralelo (o move para teamspace
  grava os dois).

### Autorização (o coração desta onda)

- `getDocumentAccess` agora é: **dono → share explícito → teamspace → org_access
  → nada**, com o link público seguindo no caminho separado
  (`lookupPublicDocument`). O passo novo é `getTeamspaceGrant(document, session)`,
  exportado de `authz.ts` para dar para testar isolado.
- Regra do teamspace: quem está em `teamspace_members` recebe **`editor`**
  (papel dentro do teamspace só distingue quem administra, não quem edita);
  quem não está, mas é membro da organização e o teamspace é `open`, recebe
  **`viewer`**; teamspace `closed` não concede nada para não-membro.
- **A precedência é literal, primeiro nível que casa vence.** Consequências
  medidas e cobertas por teste: um share `viewer` rebaixa quem seria editor pelo
  teamspace (mesma regra que já valia para `org_access`), e um documento em
  teamspace **aberto** com `org_access: editor` entrega `viewer` para quem é da
  org mas não é do teamspace. Já um teamspace **fechado** não concede nada, então
  o `org_access` do documento continua valendo para quem é da org — é o
  fallthrough esperado da cadeia.
- `src/lib/teamspace-authz.test.ts` (13 casos) trava tudo isso, mais a
  visibilidade das listas e a entrada em várias organizações. `authz.test.ts`
  teve três testes de convite reescritos (a regra "uma org por pessoa" morreu).
- `search-index.ts`: o `accessCondition` do FTS ganhou os dois ramos de
  teamspace (membro e aberto+membro da org). Sem isso o documento de teamspace
  ficaria invisível na busca mesmo com acesso — a paridade entre `authz.ts` e o
  SQL da busca é obrigatória e é o primeiro lugar para olhar em qualquer
  mudança futura de permissão.

### Múltiplas organizações

- O limite de uma organização por pessoa era garantido em código (`getMembership`
  + guardas), não no banco. Saiu: `listMemberships(userId)` devolve todas e
  `resolveMembership(userId, preferredOrgId)` escolhe a ativa.
- **Organização ativa vive num cookie** `leaf-active-org` (`httpOnly`,
  `sameSite: lax`, 1 ano), em `src/lib/active-org.ts` (`readActiveOrgId`,
  `getActiveMembership`, `writeActiveOrgId`, `clearActiveOrgId`). O módulo é
  separado de `organizations.ts` de propósito: `organizations.ts` é puro e é
  importado pelos testes, `active-org.ts` importa `next/headers`.
- Regra de resolução: cookie válido vence; senão a participação mais antiga.
  Cookie apontando para org da qual a pessoa saiu cai no fallback sem erro.
- `acceptPendingInvites` mudou de assinatura: devolve **`Array<Membership>`** e
  aceita **todos** os convites pendentes daquele email, pulando as orgs em que a
  pessoa já está. Isso conserta a pendência da onda 7 (convite de outra org
  sumia sem aviso). `attachOwnerDocuments` só roda quando a pessoa não tinha
  nenhuma organização — na segunda org em diante os documentos antigos ficam
  onde estão.
- As ações de organização (`renameOrganization`, `inviteToOrganization`,
  `cancelOrganizationInvite`, `updateMemberRole`, `removeMember`,
  `leaveOrganization`) agem sobre a **org ativa**. `setActiveOrganization(orgId)`
  é a ação nova do switcher e valida a participação antes de gravar o cookie.
- `createOrganization` deixou de recusar quem já tem org; grava o cookie da nova
  org no fim. A chave `org.errorAlreadyMember` foi removida dos dois catálogos e
  o `org.createHelp` foi reescrito.
- Sair ou ser removida de uma org agora também apaga as participações em
  teamspaces daquela org (`removeTeamspaceMemberships`) e o
  `detachMemberDocuments` zera `teamspace_id` junto com `org_id`/`org_access`.
  Ao sair, o cookie passa para a org restante ou é apagado.
- `setOrganizationAccess` (share-actions) parou de comparar com a org ativa e
  passou a exigir participação na org **do documento** (`isMemberOf`) — com N
  orgs, comparar com a ativa bloquearia o dono legítimo.
- `createDocument`, o import de `.zip` e o duplicar usam a org **ativa**.

### Onde um documento passa a morar

- `moveDocumentToTeamspace(documentId, teamspaceId | null)` exige `owner` no
  documento e move **a subárvore inteira** (`listSubtreeIds`), não só o
  documento: página e subpáginas vivem no mesmo teamspace. Mover para "Privado"
  é o mesmo caminho com `null`.
- `moveDocument` (mover para outra página) passou a propagar `teamspace_id` e
  `org_id` do destino para a subárvore movida, senão um filho ficaria numa seção
  e o pai em outra.
- O import de `.zip` herda `teamspace_id` e `org_id` do documento pai
  (`ImportOwner.teamspaceId`), e `duplicateDocument` copia o `teamspace_id`.
- `listPrivateDocuments` e `listOrganizationDocuments` passaram a excluir
  documentos com `teamspace_id`, senão o mesmo documento aparecia em duas seções
  da sidebar.

### UI

- `OrgSwitcher` (`src/components/app/org-switcher.tsx`) no topo da sidebar:
  DropdownMenu com radiogroup das organizações + "Gerenciar organização" e
  "Criar organização" (`/org?new=1`). Sem organização nenhuma, vira só um link
  "Criar organização".
- `TeamspaceSections` (`src/components/app/teamspace-sections.tsx`): seção
  "Teamspaces" **acima** de "Organização", um bloco por teamspace com ícone de
  cadeado (fechado) ou pessoas (aberto), botão "Entrar" quando a pessoa ainda
  não é membro, e `DocumentTree` própria. O botão "+" abre o
  `TeamspaceFormDialog` (nome + acesso), que também é usado no `/org` para
  editar.
- `/org` virou duas seções: `OrganizationManager` (como antes, agora sobre a org
  ativa) e `TeamspaceManager` novo (lista, membros, adicionar pessoa a partir do
  select de membros da org, entrar/sair, editar, excluir vazio). O `?new=1`
  mostra o formulário de criar organização acima de tudo.
- **Quem pode o quê:** qualquer membro da organização cria teamspace (e vira
  `owner` dele); administrar (renomear, trocar acesso, membros, excluir) exige
  ser `owner` do teamspace **ou** `owner`/`admin` da organização
  (`canManageTeamspace`). Admin da org enxerga também os teamspaces fechados em
  `/org` — mas isso **não** dá acesso a documento nenhum: continua valendo que
  papel de organização nunca escala para leitura de documento.
- Excluir teamspace só com zero documentos, com confirmação inline (não abriu
  mais um AlertDialog).
- Adicionar membro é um `Select` de membros da organização, não um campo de
  email: sem enumeração de conta, sem rate limit novo.
- Header do documento ganhou o Badge do teamspace
  (`data-testid="document-teamspace-tag"`) e o menu ⋯ ganhou "Mover para
  teamspace" (só para dono de documento que pertence a uma organização).
- i18n: namespace novo `teamspace` (58 chaves) com paridade pt-BR/en-US
  (439 chaves em cada catálogo), mais `org.switcherLabel`, `org.switching` e
  `org.manageLink`.

### Verificação (modo ultra-rápido)

- `pnpm exec tsc --noEmit` limpo.
- `vitest run` **só dos arquivos tocados**: `teamspace-authz.test.ts` (13),
  `authz.test.ts` (49), `documents.test.ts` + `search-index.test.ts` (28) —
  todos verdes. A suíte inteira, o `pnpm test:e2e`, o `pnpm build` e o
  design-review **não** rodaram, conforme a decisão registrada no topo do
  `docs/ROADMAP.md`.
- Servidor de desenvolvimento reiniciado (o migrator só roda no boot, e o `db`
  fica cacheado em `globalThis` no dev): `/login` 200, `/` e `/org` 307 para
  quem não está logado, migração 0006 aplicada no `data/leaf.db`.

### O que a onda final de validação precisa olhar aqui

- **Nada desta onda foi aberto no navegador logado.** Não foram vistos: o
  switcher trocando de organização, a seção de teamspace na sidebar (desktop e
  mobile), o `/org` com o `TeamspaceManager`, o "Mover para teamspace" e o Badge
  do teamspace no header. Contraste e responsividade dos componentes novos
  (`org-switcher`, `teamspace-sections`, `teamspace-form-dialog`,
  `move-to-teamspace-dialog`, `teamspace-manager`) estão **sem design-review**.
- O `Select` de adicionar pessoa usa `key={people.length}` para voltar ao
  placeholder depois de cada adição (Radix não aceita `value=""` em item). Vale
  conferir no navegador que ele não fica preso no nome escolhido.
- `e2e/organizations.spec.ts` foi escrito na regra antiga ("uma org por
  pessoa") e **não foi executado**. É o primeiro E2E a rodar na onda final; se
  quebrar, o suspeito é o texto de `org.createHelp` e o fluxo de convite, que
  agora aceita várias orgs.
- O header do documento já era apertado em 320-430px (ajuste da onda 7) e ganhou
  mais um Badge. Merece uma medida em mobile.
- Não há transferência de propriedade de teamspace nem lixeira própria dele:
  excluir exige mover os documentos antes.

## Onda 12 — Colaboração em tempo real (entregue)

### Peças novas

- `scripts/dev-realtime.mjs`: servidor WebSocket próprio (`ws` + `y-protocols` +
  `lib0`), porta 1234, sobe junto no `pnpm dev` (`concurrently -n next,s3,ws`).
  `y-websocket@3` só publica o **cliente** (não tem mais `bin/utils`), então o
  servidor foi escrito à mão falando o mesmo protocolo do provider: sync (0),
  awareness (1) e queryAwareness (3).
- `src/lib/realtime.ts` (constantes puras: sala `doc:{id}`, fragmento
  `prosemirror`, timeout de 2,5 s, códigos de fechamento), `realtime-config.ts`
  (flag, porta, url, segredo interno), `realtime-user.ts` (paleta/iniciais/leitura
  do awareness), `realtime-document.ts` (Y.Doc ⇄ blocos do BlockNote).
- Rotas internas `POST /api/realtime/{authz,seed,persist}`.
- Cliente: `use-realtime-session.ts` (provider + fases), `presence-bridge.ts`
  (store no padrão do `comments-bridge`), `realtime-cursor.ts` (renderCursor
  próprio), `realtime-indicator.tsx` e `app/presence-indicator.tsx`.

### Decisões

- **Authz no handshake, no servidor ws.** O navegador manda o cookie de sessão
  automaticamente no upgrade (cookie não é isolado por porta), e o servidor ws
  repassa esse cookie para `/api/realtime/authz`, que responde com o nível do
  `authz.ts` — o mesmo do app, sem authz paralelo. Escolhido em vez de importar
  o `authz.ts` direto porque o script é `.mjs` puro (sem alias de TS, sem
  bundler). O upgrade só é concluído **depois** do authz e da sala pronta, então
  nenhuma mensagem se perde; a recusa vira `close(4403)` (faixa 4400-4499 =
  permanente no `y-websocket`, o cliente não fica reconectando à toa).
- **Read-only é enforçado no servidor**: para conexão sem `editor` o servidor lê
  o subtipo da mensagem de sync e só atende `syncStep1` (leitura), descartando
  `syncStep2`/`update`. Verificado com um cliente Node cru usando o cookie de um
  viewer: ele muda o Y.Doc local, o servidor ignora, e nem o dono nem o banco
  veem a alteração.
- **Quem escreve `documents.content` é o servidor ws**, nunca um cliente líder:
  throttle de 3 s a partir do primeiro update, save final quando a sala esvazia
  (5 s de carência) e 3 tentativas com 1 s entre elas. O `useAutosave` fica
  desligado quando o editor está em modo colaborativo — é isso que garante um
  escritor só.
- O snapshot entra pelo **mesmo fluxo do autosave**: `updateDocumentContent` foi
  fatiado e o miolo virou `src/lib/document-content.ts#persistDocumentContent`,
  usado pela server action e pela rota `/api/realtime/persist`. Guard de no-op,
  `recordDocumentVersion` (onda 8) e `indexDocument` (onda 10) continuam
  valendo de graça. A rota valida o `authorId` contra a tabela `user` antes de
  gravar (evita FK quebrada); id desconhecido vira versão sem autor.
- **A semente é decisão do servidor.** Na criação da sala ele pede
  `/api/realtime/seed`, que converte `documents.content` em update do Yjs com o
  `ServerBlockNoteEditor`. O `Map` de salas guarda a **promise** da criação, então
  duas conexões simultâneas esperam a mesma semente. Isso importa: aplicar duas
  sementes no mesmo Y.Doc duplica o `<blockgroup>` (teste
  `realtime-document.test.ts` documenta), e o `yDocToBlocks` esconde a corrupção
  lendo só o primeiro grupo.
- Conteúdo ilegível (JSON quebrado) faz a sala ser recusada com `close(4409)`; o
  cliente cai no modo offline e mostra o alerta de "documento ilegível" que já
  existia. Nunca sobrescreve o original.
- Segredo interno `LEAF_REALTIME_SECRET` protege as três rotas. Em dev o default
  é `leaf-dev-realtime`; **em produção, sem a env as rotas respondem 404** (não
  existe credencial default em produção).
- O servidor ws escuta em todas as interfaces (`LEAF_REALTIME_HOST` sobrescreve)
  porque o cliente monta a URL a partir do `window.location.hostname`: quem abre
  em `localhost:3000` precisa do cookie de `localhost`, e amarrar em `127.0.0.1`
  quebrava o handshake.
- Cor do cursor/avatar é derivada **localmente** do id da pessoa + tema local,
  com paleta clara e escura da Bonsai (`renderCursor` próprio no lugar do
  default do BlockNote). Assim o contraste do rótulo é garantido nos dois temas
  em vez de depender do tema de quem está do outro lado.
- Fase da sessão: `connecting` (mostra o `EditorSkeleton`) → `ready` (editor
  colaborativo) ou `offline` (editor atual + autosave). O editor colaborativo só
  monta **depois do sync**, senão a pessoa veria um documento vazio.

### `serverExternalPackages: ["yjs"]` — não remova

`next.config.ts` já marcava `@blocknote/server-util` como externo. Ao importar
`yjs` direto no `realtime-document.ts` o Next passou a carregar **duas cópias**
do Yjs no servidor (o aviso "Yjs was already imported" aparecia no log), e a
conversão do estado quebrava com `TypeError: text.toDelta is not a function`
dentro do `y-prosemirror` — checagem de construtor entre cópias diferentes. Todo
persist respondia 422 e nada era gravado (o reload parecia funcionar porque o
cliente rebaixava da sala viva, não do banco). Marcar `yjs` como externo resolve.
`contentFromRealtimeState` também instancia o fragmento (`doc.getXmlFragment`)
**antes** do `applyUpdate`.

### Verificação (modo ultra-rápido)

- `tsc --noEmit` limpo.
- `src/lib/realtime.test.ts` (13) e `src/lib/realtime-document.test.ts` (6)
  verdes, mais os testes das áreas tocadas (`documents`, `authz`,
  `document-versions`, `search-index`, `teamspace-authz`): 105 verdes.
- Prova de vida no navegador (dois contextos Playwright no dev server, scripts
  descartáveis, não versionados): texto converge nos dois lados, cursor remoto
  com nome, "2 pessoas neste documento" nos dois headers, conteúdo conferido
  **direto no `data/leaf.db`**, viewer bloqueado no servidor, e com o ws
  inacessível o editor aparece em ~3,2 s e salva pelo autosave normal.
- Sem `pnpm build`, sem suíte completa, sem `pnpm test:e2e` e sem design-review —
  tudo isso é a onda final de validação.

### O que a onda final de validação precisa olhar aqui

- **Nada de colaboração foi visto por olho humano**: o indicador de presença no
  header (avatares sobrepostos), o `RealtimeIndicator` e o cursor remoto não
  passaram por design-review. O header do documento ganhou mais um elemento e já
  era apertado em 320-430px.
- **Não existe E2E de colaboração versionado.** Os três roteiros usados
  (convergência, read-only, fallback) foram scripts descartáveis; virar
  `e2e/realtime.spec.ts` exige subir o ws no `webServer` do Playwright.
- O tema do cursor é capturado quando o editor monta; trocar de tema no meio da
  sessão só recolore cursores redesenhados depois. Presença e avatares reagem na
  hora.
- Se o ws cair **depois** da sessão começar, o editor continua em modo
  colaborativo (o provider reconecta) e o autosave **não** volta a ligar: o que
  a pessoa escrever fica só no Y.Doc local até a reconexão. Aceito nesta onda;
  se incomodar, o caminho é religar o autosave após N segundos desconectado.
- Um documento com uma sala viva e outra aba em modo offline (ws parcialmente
  fora) teria dois escritores. Só acontece em falha parcial de rede; não foi
  tratado.
- Deploy real precisa de: `LEAF_REALTIME_SECRET`, `LEAF_REALTIME_URL` (wss no
  mesmo domínio) e o servidor ws como processo próprio — o `dev-realtime.mjs` é
  o desenho de dev, sem persistência de sala entre reinícios (o estado vive em
  memória e volta do `documents.content`).
- Sem GC extra além do default do Yjs (`new Y.Doc({ gc: true })` nos dois lados)
  e sem histórico de undo compartilhado além do que o BlockNote já traz.
