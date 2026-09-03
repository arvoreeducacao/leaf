import { and, asc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

import { db } from '@/db'
import {
  databaseProperties,
  databaseViews,
  documents,
  githubDocuments,
} from '@/db/schema'
import type { DatabasePropertyType, OrgAccess } from '@/db/schema'
import {
  MAX_PROPERTY_NAME,
  MAX_TEXT_VALUE,
  type PropertyValue,
  type SelectOption,
  colorForIndex,
  parseOptions,
  serializeOptions,
  serializeValues,
} from '@/lib/database/values'
import { serializeViewConfig } from '@/lib/database/views'
import type { GithubClient, GithubPullRequest } from '@/lib/github/api'
import { pullState } from '@/lib/github/api'
import type { GithubSyncMessages } from '@/lib/github/messages'

export const DATABASE_KEY = 'database'

const maxWarnings = 20

const maxTitle = 200

type FieldKey =
  | 'repository'
  | 'number'
  | 'state'
  | 'author'
  | 'updatedAt'
  | 'url'

type Field = Readonly<{
  key: FieldKey
  type: DatabasePropertyType
  name: (messages: GithubSyncMessages) => string
}>

const fields: ReadonlyArray<Field> = [
  {
    key: 'repository',
    name: (messages) => messages.propertyRepository,
    type: 'select',
  },
  { key: 'number', name: (messages) => messages.propertyNumber, type: 'text' },
  { key: 'state', name: (messages) => messages.propertyState, type: 'select' },
  { key: 'author', name: (messages) => messages.propertyAuthor, type: 'text' },
  {
    key: 'updatedAt',
    name: (messages) => messages.propertyUpdatedAt,
    type: 'date',
  },
  { key: 'url', name: (messages) => messages.propertyUrl, type: 'url' },
]

export type GithubSyncOwner = Readonly<{
  id: string
  orgId?: string | null
  teamspaceId?: string | null
  orgAccess?: OrgAccess | null
  parentId?: string | null
}>

export type GithubSyncOptions = Readonly<{
  force?: boolean
}>

export type GithubSyncSummary = Readonly<{
  databaseId: string
  repos: number
  rows: number
  skipped: number
  warnings: ReadonlyArray<string>
}>

export type GithubSyncEvent =
  | { type: 'progress'; done: number; label: string }
  | { type: 'done'; summary: GithubSyncSummary }
  | { type: 'error'; error: string }

type Mapping = Readonly<{
  documentId: string
  updatedAt: Date | null
}>

function stamp(value: string | null | undefined): Date | null {
  if (!value) {
    return null
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

export function pullKey(repo: string, pull: GithubPullRequest): string {
  return `pr:${repo}#${pull.number}`
}

export function cursorKey(repo: string): string {
  return `repo:${repo}`
}

function stateOptions(messages: GithubSyncMessages): Array<SelectOption> {
  return [
    { color: 'success', group: 'todo', id: 'open', name: messages.stateOpen },
    {
      color: 'purple',
      group: 'done',
      id: 'merged',
      name: messages.stateMerged,
    },
    { color: 'gray', group: 'done', id: 'closed', name: messages.stateClosed },
  ]
}

function repositoryOptions(
  repos: ReadonlyArray<string>,
  existing: ReadonlyArray<SelectOption>,
): Array<SelectOption> {
  const merged = [...existing]
  const known = new Set(merged.map((option) => option.id))

  for (const repo of repos) {
    if (known.has(repo)) {
      continue
    }

    merged.push({
      color: colorForIndex(merged.length),
      id: repo,
      name: repo.split('/').pop() ?? repo,
    })
    known.add(repo)
  }

  return merged
}

export async function* syncGithub(
  client: GithubClient,
  repos: ReadonlyArray<string>,
  owner: GithubSyncOwner,
  messages: GithubSyncMessages,
  signal?: AbortSignal,
  options?: GithubSyncOptions,
): AsyncGenerator<GithubSyncEvent> {
  const warnings: Array<string> = []

  function warn(message: string) {
    if (warnings.length < maxWarnings) {
      warnings.push(message)
    }
  }

  const mappingRows = await db
    .select()
    .from(githubDocuments)
    .where(eq(githubDocuments.userId, owner.id))

  const mappings = new Map<string, Mapping>()

  for (const row of mappingRows) {
    mappings.set(row.githubId, {
      documentId: row.documentId,
      updatedAt: row.updatedAt,
    })
  }

  async function saveMapping(
    githubId: string,
    documentId: string,
    kind: 'database' | 'row' | 'repo',
    updatedAt: Date | null,
  ) {
    if (mappings.has(githubId)) {
      await db
        .update(githubDocuments)
        .set({ syncedAt: new Date(), updatedAt })
        .where(
          and(
            eq(githubDocuments.userId, owner.id),
            eq(githubDocuments.githubId, githubId),
          ),
        )
    } else {
      await db.insert(githubDocuments).values({
        documentId,
        githubId,
        kind,
        updatedAt,
        userId: owner.id,
      })
    }

    mappings.set(githubId, { documentId, updatedAt })
  }

  async function upsertDocument(
    githubId: string,
    kind: 'database' | 'row',
    title: string,
    updatedAt: Date | null,
    parentDocId: string | null,
    refresh = true,
  ): Promise<{ documentId: string; created: boolean }> {
    const existing = mappings.get(githubId)

    if (existing) {
      if (refresh) {
        await db
          .update(documents)
          .set({
            kind,
            title: title.slice(0, maxTitle),
            updatedAt: updatedAt ?? new Date(),
          })
          .where(eq(documents.id, existing.documentId))
      }

      return { created: false, documentId: existing.documentId }
    }

    const documentId = nanoid(12)
    const now = new Date()

    await db.insert(documents).values({
      createdAt: now,
      id: documentId,
      kind,
      orgAccess: owner.orgAccess ?? null,
      orgId: owner.orgId ?? null,
      ownerId: owner.id,
      parentId: parentDocId ?? owner.parentId ?? null,
      teamspaceId: owner.teamspaceId ?? null,
      title: title.slice(0, maxTitle),
      updatedAt: updatedAt ?? now,
    })

    return { created: true, documentId }
  }

  async function ensureProperties(
    databaseId: string,
  ): Promise<Record<FieldKey, string>> {
    const existing = await db
      .select()
      .from(databaseProperties)
      .where(eq(databaseProperties.databaseId, databaseId))
      .orderBy(asc(databaseProperties.position))

    const ids = {} as Record<FieldKey, string>
    const now = new Date()

    for (const [index, field] of fields.entries()) {
      const current = existing[index]
      const options =
        field.key === 'state'
          ? stateOptions(messages)
          : field.key === 'repository'
            ? repositoryOptions(
                repos,
                current ? parseOptions(current.options) : [],
              )
            : []

      if (current && current.type === field.type) {
        ids[field.key] = current.id

        if (options.length > 0) {
          await db
            .update(databaseProperties)
            .set({ options: serializeOptions(options) })
            .where(eq(databaseProperties.id, current.id))
        }

        continue
      }

      const id = nanoid(12)

      await db.insert(databaseProperties).values({
        createdAt: now,
        databaseId,
        id,
        name: field.name(messages).slice(0, MAX_PROPERTY_NAME),
        options: options.length > 0 ? serializeOptions(options) : null,
        position: index,
        type: field.type,
      })
      ids[field.key] = id
    }

    return ids
  }

  async function ensureViews(
    databaseId: string,
    statePropertyId: string,
  ): Promise<void> {
    const existing = await db
      .select({ id: databaseViews.id })
      .from(databaseViews)
      .where(eq(databaseViews.databaseId, databaseId))

    if (existing.length > 0) {
      return
    }

    const now = new Date()

    await db.insert(databaseViews).values([
      {
        config: serializeViewConfig({
          filters: [],
          groupByPropertyId: null,
          hiddenPropertyIds: [],
          sorts: [],
        }),
        createdAt: now,
        databaseId,
        id: nanoid(12),
        name: messages.tableView,
        position: 0,
        type: 'table',
      },
      {
        config: serializeViewConfig({
          filters: [],
          groupByPropertyId: statePropertyId,
          hiddenPropertyIds: [],
          sorts: [],
        }),
        createdAt: now,
        databaseId,
        id: nanoid(12),
        name: messages.boardView,
        position: 1,
        type: 'board',
      },
    ])
  }

  const database = await upsertDocument(
    DATABASE_KEY,
    'database',
    messages.databaseTitle,
    null,
    null,
    false,
  )

  await saveMapping(DATABASE_KEY, database.documentId, 'database', null)

  const propertyIds = await ensureProperties(database.documentId)

  await ensureViews(database.documentId, propertyIds.state)

  let rows = 0
  let skipped = 0
  let syncedRepos = 0

  for (const repo of repos) {
    if (signal?.aborted) {
      return
    }

    const cursor = mappings.get(cursorKey(repo))?.updatedAt ?? null
    const cutoff = options?.force ? 0 : (cursor?.getTime() ?? 0)
    let newest = cutoff

    try {
      for await (const pull of client.pulls(repo)) {
        if (signal?.aborted) {
          return
        }

        const edited = stamp(pull.updated_at)

        if (cutoff > 0 && edited && edited.getTime() < cutoff) {
          break
        }

        if (edited) {
          newest = Math.max(newest, edited.getTime())
        }

        const key = pullKey(repo, pull)
        const mapping = mappings.get(key)
        const unchanged =
          !options?.force &&
          mapping?.updatedAt &&
          edited &&
          mapping.updatedAt.getTime() >= edited.getTime()

        if (unchanged) {
          skipped += 1
          continue
        }

        const title = (pull.title ?? '').trim() || messages.untitled
        const row = await upsertDocument(
          key,
          'row',
          title,
          edited,
          database.documentId,
        )
        const values: Record<string, PropertyValue> = {
          [propertyIds.author]: (pull.user?.login ?? '').slice(
            0,
            MAX_TEXT_VALUE,
          ),
          [propertyIds.number]: String(pull.number),
          [propertyIds.repository]: repo,
          [propertyIds.state]: pullState(pull),
          [propertyIds.updatedAt]: edited
            ? edited.toISOString().slice(0, 10)
            : null,
          [propertyIds.url]: pull.html_url ?? '',
        }

        await db
          .update(documents)
          .set({ kind: 'row', properties: serializeValues(values) })
          .where(eq(documents.id, row.documentId))

        await saveMapping(key, row.documentId, 'row', edited)
        rows += 1
        yield { done: rows + skipped, label: title, type: 'progress' }
      }

      if (newest > 0) {
        await saveMapping(
          cursorKey(repo),
          database.documentId,
          'repo',
          new Date(newest),
        )
      }

      syncedRepos += 1
    } catch {
      warn(messages.repoFailed(repo))
    }
  }

  if (skipped > 0) {
    warn(messages.skippedUnchanged(skipped))
  }

  yield {
    summary: {
      databaseId: database.documentId,
      repos: syncedRepos,
      rows,
      skipped,
      warnings,
    },
    type: 'done',
  }
}
