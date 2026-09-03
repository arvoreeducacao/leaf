import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

import { and, asc, eq } from 'drizzle-orm'

import { db } from '@/db'
import {
  databaseProperties,
  databaseViews,
  documents,
  githubDocuments,
  user,
} from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import { parseOptions, parseValues } from '@/lib/database/values'
import type { GithubClient, GithubPullRequest } from '@/lib/github/api'
import type { GithubSyncMessages } from '@/lib/github/messages'
import type { GithubSyncSummary } from '@/lib/github/sync'
import { DATABASE_KEY, cursorKey, syncGithub } from '@/lib/github/sync'

const repo = 'arvoreeducacao/leaf'

const messages: GithubSyncMessages = {
  boardView: 'Board',
  databaseTitle: 'GitHub pull requests',
  propertyAuthor: 'Author',
  propertyNumber: 'Number',
  propertyRepository: 'Repository',
  propertyState: 'State',
  propertyUpdatedAt: 'Updated at',
  propertyUrl: 'URL',
  repoFailed: (name) => `failed ${name}`,
  skippedUnchanged: (count) => `${count} skipped`,
  stateClosed: 'Closed',
  stateMerged: 'Merged',
  stateOpen: 'Open',
  tableView: 'Table',
  untitled: 'Untitled',
}

const owner = { id: 'user-owner', orgAccess: null, orgId: null }

type World = {
  pulls: Array<GithubPullRequest>
  failAfter?: number
  requestedPages: number
}

function makePull(
  number: number,
  updatedAt: string,
  extra: Partial<GithubPullRequest> = {},
): GithubPullRequest {
  return {
    html_url: `https://github.com/${repo}/pull/${number}`,
    id: number,
    number,
    title: `PR ${number}`,
    updated_at: updatedAt,
    user: { login: 'joao' },
    ...extra,
  }
}

function makeWorld(): World {
  return {
    pulls: [
      makePull(3, '2026-09-03T00:00:00Z'),
      makePull(2, '2026-09-02T00:00:00Z', {
        merged_at: '2026-09-02T00:00:00Z',
        state: 'closed',
      }),
      makePull(1, '2026-09-01T00:00:00Z', { state: 'closed' }),
    ],
    requestedPages: 0,
  }
}

function makeClient(world: World): GithubClient {
  return {
    pulls: async function* () {
      world.requestedPages += 1

      let served = 0

      for (const pull of world.pulls) {
        if (world.failAfter !== undefined && served >= world.failAfter) {
          throw new Error('github is down')
        }

        served += 1
        yield pull
      }
    },
  }
}

async function run(
  world: World,
  options: { force?: boolean } = {},
): Promise<GithubSyncSummary> {
  let summary: GithubSyncSummary | null = null

  for await (const event of syncGithub(
    makeClient(world),
    [repo],
    owner,
    messages,
    undefined,
    options,
  )) {
    if (event.type === 'done') {
      summary = event.summary
    }
  }

  if (!summary) {
    throw new Error('sync produced no summary')
  }

  return summary
}

async function rowTitles(): Promise<Array<string>> {
  const rows = await db
    .select({ title: documents.title })
    .from(documents)
    .where(eq(documents.kind, 'row'))
    .orderBy(asc(documents.title))

  return rows.map((row) => row.title)
}

async function propertiesOf(databaseId: string) {
  return db
    .select()
    .from(databaseProperties)
    .where(eq(databaseProperties.databaseId, databaseId))
    .orderBy(asc(databaseProperties.position))
}

beforeEach(async () => {
  await resetDatabase()

  await db.insert(user).values({
    createdAt: new Date(),
    email: 'owner@arvore.com.br',
    emailVerified: false,
    id: owner.id,
    name: 'Owner',
    updatedAt: new Date(),
  })
})

describe('GitHub pull request sync', () => {
  it('creates the database with the fixed schema and one row per pull request', async () => {
    const summary = await run(makeWorld())

    expect(summary.rows).toBe(3)
    expect(summary.skipped).toBe(0)
    expect(summary.repos).toBe(1)

    const database = await db
      .select()
      .from(documents)
      .where(eq(documents.id, summary.databaseId))

    expect(database[0].kind).toBe('database')
    expect(database[0].title).toBe('GitHub pull requests')

    const properties = await propertiesOf(summary.databaseId)

    expect(properties.map((property) => property.type)).toEqual([
      'select',
      'text',
      'select',
      'text',
      'date',
      'url',
    ])
    expect(parseOptions(properties[2].options).map((option) => option.id)).toEqual([
      'open',
      'merged',
      'closed',
    ])

    const views = await db
      .select()
      .from(databaseViews)
      .where(eq(databaseViews.databaseId, summary.databaseId))
      .orderBy(asc(databaseViews.position))

    expect(views.map((view) => view.type)).toEqual(['table', 'board'])

    expect(await rowTitles()).toEqual(['PR 1', 'PR 2', 'PR 3'])
  })

  it('writes every property of a merged pull request', async () => {
    const summary = await run(makeWorld())
    const properties = await propertiesOf(summary.databaseId)
    const [merged] = await db
      .select()
      .from(documents)
      .where(eq(documents.title, 'PR 2'))
    const values = parseValues(merged.properties)

    expect(values[properties[0].id]).toBe(repo)
    expect(values[properties[1].id]).toBe('2')
    expect(values[properties[2].id]).toBe('merged')
    expect(values[properties[3].id]).toBe('joao')
    expect(values[properties[4].id]).toBe('2026-09-02')
    expect(values[properties[5].id]).toBe(
      `https://github.com/${repo}/pull/2`,
    )
  })

  it('is idempotent: a second pass rewrites nothing and creates no duplicates', async () => {
    const world = makeWorld()

    await run(world)

    const before = await db.select().from(documents)
    const second = await run(world)

    expect(second.rows).toBe(0)

    const after = await db.select().from(documents)

    expect(after).toHaveLength(before.length)
    expect(await rowTitles()).toEqual(['PR 1', 'PR 2', 'PR 3'])
  })

  it('stops paging at the cursor once a repository is in sync', async () => {
    const world = makeWorld()

    await run(world)

    const second = await run(world)

    expect(second.skipped).toBe(1)
    expect(second.rows).toBe(0)
  })

  it('picks up only what changed since the last pass', async () => {
    const world = makeWorld()

    await run(world)

    world.pulls = [
      makePull(4, '2026-09-04T00:00:00Z'),
      makePull(3, '2026-09-03T12:00:00Z', { title: 'PR 3 renamed' }),
      ...world.pulls.slice(1),
    ]

    const second = await run(world)

    expect(second.rows).toBe(2)
    expect(await rowTitles()).toEqual([
      'PR 1',
      'PR 2',
      'PR 3 renamed',
      'PR 4',
    ])

    const rows = await db
      .select()
      .from(githubDocuments)
      .where(
        and(
          eq(githubDocuments.userId, owner.id),
          eq(githubDocuments.githubId, `pr:${repo}#3`),
        ),
      )

    expect(rows).toHaveLength(1)
  })

  it('does not advance the cursor when a pass breaks midway', async () => {
    const world = makeWorld()

    world.failAfter = 1

    const first = await run(world)

    expect(first.rows).toBe(1)
    expect(first.warnings).toContain(`failed ${repo}`)

    const cursor = await db
      .select()
      .from(githubDocuments)
      .where(
        and(
          eq(githubDocuments.userId, owner.id),
          eq(githubDocuments.githubId, cursorKey(repo)),
        ),
      )

    expect(cursor).toHaveLength(0)

    world.failAfter = undefined

    const second = await run(world)

    expect(second.rows).toBe(2)
    expect(second.skipped).toBe(1)
    expect(await rowTitles()).toEqual(['PR 1', 'PR 2', 'PR 3'])
  })

  it('leaves the base document alone when a pass changes nothing', async () => {
    const world = makeWorld()
    const first = await run(world)

    await db
      .update(documents)
      .set({ title: 'PRs do time' })
      .where(eq(documents.id, first.databaseId))

    await run(world)

    const [database] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, first.databaseId))

    expect(database.title).toBe('PRs do time')
  })

  it('rewrites every row when forced', async () => {
    const world = makeWorld()

    await run(world)

    const forced = await run(world, { force: true })

    expect(forced.rows).toBe(3)
    expect(forced.skipped).toBe(0)
    expect(await rowTitles()).toEqual(['PR 1', 'PR 2', 'PR 3'])
  })

  it('keeps one mapping row per pull request plus the database and the cursor', async () => {
    await run(makeWorld())
    await run(makeWorld())

    const rows = await db
      .select()
      .from(githubDocuments)
      .where(eq(githubDocuments.userId, owner.id))

    expect(rows).toHaveLength(5)
    expect(rows.filter((row) => row.kind === 'row')).toHaveLength(3)
    expect(rows.filter((row) => row.githubId === DATABASE_KEY)).toHaveLength(1)
    expect(rows.filter((row) => row.kind === 'repo')).toHaveLength(1)
  })
})
