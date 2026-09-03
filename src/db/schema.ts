import { sql } from 'drizzle-orm'
import {
  type AnyMySqlColumn,
  boolean,
  customType,
  datetime,
  index,
  int,
  longtext,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core'

const longblob = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType() {
    return 'longblob'
  },
  fromDriver(value) {
    return new Uint8Array(value)
  },
  toDriver(value) {
    return Buffer.from(value)
  },
})

const AUTH_ID = 36
const APP_ID = 21

export const user = mysqlTable('user', {
  id: varchar('id', { length: AUTH_ID }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('email_verified')
    .$defaultFn(() => false)
    .notNull(),
  image: text('image'),
  createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 })
    .$defaultFn(() => new Date())
    .notNull(),
})

export const session = mysqlTable('session', {
  id: varchar('id', { length: AUTH_ID }).primaryKey(),
  expiresAt: datetime('expires_at', { mode: 'date', fsp: 3 }).notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull(),
  updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 }).notNull(),
  ipAddress: varchar('ip_address', { length: 64 }),
  userAgent: varchar('user_agent', { length: 512 }),
  userId: varchar('user_id', { length: AUTH_ID })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = mysqlTable('account', {
  id: varchar('id', { length: AUTH_ID }).primaryKey(),
  issuer: varchar('issuer', { length: 255 }).notNull(),
  accountId: varchar('account_id', { length: 255 }).notNull(),
  providerId: varchar('provider_id', { length: 255 }).notNull(),
  userId: varchar('user_id', { length: AUTH_ID })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: datetime('access_token_expires_at', {
    mode: 'date',
    fsp: 3,
  }),
  refreshTokenExpiresAt: datetime('refresh_token_expires_at', {
    mode: 'date',
    fsp: 3,
  }),
  scope: varchar('scope', { length: 512 }),
  password: varchar('password', { length: 512 }),
  createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull(),
  updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 }).notNull(),
})

export const verification = mysqlTable('verification', {
  id: varchar('id', { length: AUTH_ID }).primaryKey(),
  identifier: varchar('identifier', { length: 255 }).notNull(),
  value: varchar('value', { length: 2048 }).notNull(),
  expiresAt: datetime('expires_at', { mode: 'date', fsp: 3 }).notNull(),
  createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 })
    .$defaultFn(() => new Date())
    .notNull(),
})

export const organizations = mysqlTable('organizations', {
  id: varchar('id', { length: APP_ID }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  inviteToken: varchar('invite_token', { length: 64 }).unique(),
  createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`),
})

export const organizationMembers = mysqlTable(
  'organization_members',
  {
    id: varchar('id', { length: APP_ID }).primaryKey(),
    orgId: varchar('org_id', { length: APP_ID })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: AUTH_ID })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: mysqlEnum('role', ['owner', 'admin', 'member'])
      .notNull()
      .default('member'),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    uniqueIndex('organization_members_org_user_unq').on(
      table.orgId,
      table.userId,
    ),
    index('organization_members_user_id_idx').on(table.userId),
  ],
)

export const organizationInvites = mysqlTable(
  'organization_invites',
  {
    id: varchar('id', { length: APP_ID }).primaryKey(),
    orgId: varchar('org_id', { length: APP_ID })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    role: mysqlEnum('role', ['admin', 'member']).notNull().default('member'),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    uniqueIndex('organization_invites_org_email_unq').on(
      table.orgId,
      table.email,
    ),
    index('organization_invites_email_idx').on(table.email),
  ],
)

export const teamspaces = mysqlTable(
  'teamspaces',
  {
    id: varchar('id', { length: APP_ID }).primaryKey(),
    orgId: varchar('org_id', { length: APP_ID })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    access: mysqlEnum('access', ['open', 'closed']).notNull().default('open'),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [index('teamspaces_org_id_idx').on(table.orgId)],
)

export const teamspaceMembers = mysqlTable(
  'teamspace_members',
  {
    id: varchar('id', { length: APP_ID }).primaryKey(),
    teamspaceId: varchar('teamspace_id', { length: APP_ID })
      .notNull()
      .references(() => teamspaces.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: AUTH_ID })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: mysqlEnum('role', ['owner', 'member']).notNull().default('member'),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    uniqueIndex('teamspace_members_teamspace_user_unq').on(
      table.teamspaceId,
      table.userId,
    ),
    index('teamspace_members_user_id_idx').on(table.userId),
  ],
)

export const documents = mysqlTable(
  'documents',
  {
    id: varchar('id', { length: APP_ID }).primaryKey(),
    ownerId: varchar('owner_id', { length: AUTH_ID })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    parentId: varchar('parent_id', { length: APP_ID }).references(
      (): AnyMySqlColumn => documents.id,
      { onDelete: 'set null' },
    ),
    orgId: varchar('org_id', { length: APP_ID }).references(
      () => organizations.id,
      { onDelete: 'set null' },
    ),
    teamspaceId: varchar('teamspace_id', { length: APP_ID }).references(
      () => teamspaces.id,
      { onDelete: 'set null' },
    ),
    orgAccess: mysqlEnum('org_access', ['viewer', 'commenter', 'editor']),
    kind: mysqlEnum('kind', ['page', 'database', 'row'])
      .notNull()
      .default('page'),
    title: varchar('title', { length: 500 }).notNull().default('Sem título'),
    icon: varchar('icon', { length: 1024 }),
    cover: varchar('cover', { length: 2048 }),
    coverPosition: int('cover_position').notNull().default(50),
    coverCredit: varchar('cover_credit', { length: 1024 }),
    content: longtext('content'),
    properties: longtext('properties'),
    publicToken: varchar('public_token', { length: 64 }).unique(),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    deletedAt: datetime('deleted_at', { mode: 'date', fsp: 3 }),
  },
  (table) => [
    index('documents_owner_id_idx').on(table.ownerId),
    index('documents_parent_id_idx').on(table.parentId),
    index('documents_org_id_idx').on(table.orgId),
    index('documents_teamspace_id_idx').on(table.teamspaceId),
    index('documents_kind_parent_id_idx').on(table.kind, table.parentId),
  ],
)

export const databaseProperties = mysqlTable(
  'database_properties',
  {
    id: varchar('id', { length: APP_ID }).primaryKey(),
    databaseId: varchar('database_id', { length: APP_ID })
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    type: mysqlEnum('type', [
      'text',
      'number',
      'select',
      'multiSelect',
      'date',
      'checkbox',
      'url',
      'person',
      'status',
    ])
      .notNull()
      .default('text'),
    options: longtext('options'),
    position: int('position').notNull().default(0),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    index('database_properties_database_id_position_idx').on(
      table.databaseId,
      table.position,
    ),
  ],
)

export const databaseViews = mysqlTable(
  'database_views',
  {
    id: varchar('id', { length: APP_ID }).primaryKey(),
    databaseId: varchar('database_id', { length: APP_ID })
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    type: mysqlEnum('type', ['table', 'board']).notNull().default('table'),
    config: longtext('config'),
    position: int('position').notNull().default(0),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    index('database_views_database_id_position_idx').on(
      table.databaseId,
      table.position,
    ),
  ],
)

export const documentRealtimeState = mysqlTable(
  'document_realtime_state',
  {
    documentId: varchar('document_id', { length: APP_ID })
      .primaryKey()
      .references(() => documents.id, { onDelete: 'cascade' }),
    identity: varchar('identity', { length: 24 }).notNull(),
    state: longblob('state').notNull(),
    updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
)

export const documentShares = mysqlTable(
  'document_shares',
  {
    id: varchar('id', { length: APP_ID }).primaryKey(),
    documentId: varchar('document_id', { length: APP_ID })
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    granteeEmail: varchar('grantee_email', { length: 255 }).notNull(),
    role: mysqlEnum('role', ['viewer', 'commenter', 'editor'])
      .notNull()
      .default('viewer'),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    uniqueIndex('document_shares_doc_email_unq').on(
      table.documentId,
      table.granteeEmail,
    ),
    index('document_shares_grantee_email_idx').on(table.granteeEmail),
  ],
)

export const documentVersions = mysqlTable(
  'document_versions',
  {
    id: varchar('id', { length: APP_ID }).primaryKey(),
    documentId: varchar('document_id', { length: APP_ID })
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 500 }).notNull(),
    content: longtext('content'),
    authorId: varchar('author_id', { length: AUTH_ID }).references(
      () => user.id,
      { onDelete: 'set null' },
    ),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull(),
  },
  (table) => [
    index('document_versions_document_id_created_at_idx').on(
      table.documentId,
      table.createdAt,
    ),
    index('document_versions_author_id_idx').on(table.authorId),
  ],
)

export const comments = mysqlTable(
  'comments',
  {
    id: varchar('id', { length: APP_ID }).primaryKey(),
    documentId: varchar('document_id', { length: APP_ID })
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    parentId: varchar('parent_id', { length: APP_ID }).references(
      (): AnyMySqlColumn => comments.id,
      { onDelete: 'cascade' },
    ),
    blockId: varchar('block_id', { length: 64 }),
    authorId: varchar('author_id', { length: AUTH_ID }).references(
      () => user.id,
      { onDelete: 'set null' },
    ),
    body: varchar('body', { length: 2000 }).notNull(),
    resolvedAt: datetime('resolved_at', { mode: 'date', fsp: 3 }),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull(),
    updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 }).notNull(),
  },
  (table) => [
    index('comments_document_id_created_at_idx').on(
      table.documentId,
      table.createdAt,
    ),
    index('comments_parent_id_idx').on(table.parentId),
    index('comments_author_id_idx').on(table.authorId),
  ],
)

export const notionDocuments = mysqlTable(
  'notion_documents',
  {
    userId: varchar('user_id', { length: AUTH_ID })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    notionId: varchar('notion_id', { length: 64 }).notNull(),
    documentId: varchar('document_id', { length: APP_ID })
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    parentNotionId: varchar('parent_notion_id', { length: 64 }),
    kind: mysqlEnum('kind', ['page', 'database', 'row'])
      .notNull()
      .default('page'),
    lastEditedAt: datetime('last_edited_at', { mode: 'date', fsp: 3 }),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.notionId] }),
    index('notion_documents_document_id_idx').on(table.documentId),
    index('notion_documents_user_parent_idx').on(
      table.userId,
      table.parentNotionId,
    ),
  ],
)

export const githubDocuments = mysqlTable(
  'github_documents',
  {
    userId: varchar('user_id', { length: AUTH_ID })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    githubId: varchar('github_id', { length: 191 }).notNull(),
    documentId: varchar('document_id', { length: APP_ID })
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    kind: mysqlEnum('kind', ['database', 'row', 'repo'])
      .notNull()
      .default('row'),
    updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 }),
    syncedAt: datetime('synced_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.githubId] }),
    index('github_documents_document_id_idx').on(table.documentId),
  ],
)

export const notionConnections = mysqlTable('notion_connections', {
  userId: varchar('user_id', { length: AUTH_ID })
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token').notNull(),
  workspaceId: varchar('workspace_id', { length: 64 }),
  workspaceName: varchar('workspace_name', { length: 255 }),
  botId: varchar('bot_id', { length: 64 }),
  createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`),
  updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`),
})

export type Document = typeof documents.$inferSelect
export type DocumentKind = Document['kind']
export type DatabaseProperty = typeof databaseProperties.$inferSelect
export type DatabasePropertyType = DatabaseProperty['type']
export type DatabaseView = typeof databaseViews.$inferSelect
export type DatabaseViewType = DatabaseView['type']
export type DocumentShare = typeof documentShares.$inferSelect
export type ShareRole = DocumentShare['role']
export type Organization = typeof organizations.$inferSelect
export type OrganizationMember = typeof organizationMembers.$inferSelect
export type OrganizationRole = OrganizationMember['role']
export type OrganizationInvite = typeof organizationInvites.$inferSelect
export type InviteRole = OrganizationInvite['role']
export type OrgAccess = NonNullable<Document['orgAccess']>
export type Teamspace = typeof teamspaces.$inferSelect
export type TeamspaceAccess = Teamspace['access']
export type TeamspaceMember = typeof teamspaceMembers.$inferSelect
export type TeamspaceRole = TeamspaceMember['role']
export type DocumentVersion = typeof documentVersions.$inferSelect
export type Comment = typeof comments.$inferSelect
export type NotionConnection = typeof notionConnections.$inferSelect
export type GithubDocument = typeof githubDocuments.$inferSelect
export type GithubDocumentKind = GithubDocument['kind']
