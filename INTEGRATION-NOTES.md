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
