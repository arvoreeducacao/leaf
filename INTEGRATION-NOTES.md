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

## Pendências conhecidas

- `/share/[token]` e `/api/documents/[id]/export` ainda não existem (ondas 3 e 4).
- Sem testes automatizados. A onda 1 foi validada com `pnpm build` e um roteiro
  manual em navegador.
