import { afterEach, describe, expect, it } from 'vitest'

import {
  MAX_GITHUB_REPOS,
  githubConfig,
  githubSyncOwnerEmail,
  githubSyncSecret,
  parseRepoList,
} from '@/lib/github/config'

const touched = [
  'GITHUB_TOKEN',
  'LEAF_GITHUB_ORG',
  'LEAF_GITHUB_REPOS',
  'LEAF_GITHUB_SYNC_SECRET',
  'LEAF_GITHUB_SYNC_OWNER',
]

afterEach(() => {
  for (const name of touched) {
    delete process.env[name]
  }
})

describe('repository list parsing', () => {
  it('qualifies bare names with the org and keeps explicit owners', () => {
    expect(parseRepoList('leaf, other/thing', 'acme')).toEqual([
      'acme/leaf',
      'other/thing',
    ])
  })

  it('drops blanks, duplicates and malformed entries', () => {
    expect(
      parseRepoList(' leaf , , leaf, a/b/c, bad name, ', 'acme'),
    ).toEqual(['acme/leaf'])
  })

  it('caps the list', () => {
    const raw = Array.from({ length: MAX_GITHUB_REPOS + 10 }, (_, i) => `r${i}`)

    expect(parseRepoList(raw.join(','), 'org')).toHaveLength(MAX_GITHUB_REPOS)
  })
})

describe('github configuration', () => {
  it('stays off without a token', () => {
    process.env.LEAF_GITHUB_REPOS = 'leaf'

    expect(githubConfig()).toBeNull()
  })

  it('stays off without repositories', () => {
    process.env.GITHUB_TOKEN = 'ghp_token'

    expect(githubConfig()).toBeNull()
  })

  it('stays off when bare names have no org to qualify them', () => {
    process.env.GITHUB_TOKEN = 'ghp_token'
    process.env.LEAF_GITHUB_REPOS = 'leaf,docs'

    expect(githubConfig()).toBeNull()
  })

  it('qualifies the repositories with the configured org', () => {
    process.env.GITHUB_TOKEN = 'ghp_token'
    process.env.LEAF_GITHUB_ORG = 'acme'
    process.env.LEAF_GITHUB_REPOS = 'leaf,docs'

    expect(githubConfig()).toEqual({
      org: 'acme',
      repos: ['acme/leaf', 'acme/docs'],
      token: 'ghp_token',
    })
  })
})

describe('service trigger credentials', () => {
  it('refuses a short secret', () => {
    process.env.LEAF_GITHUB_SYNC_SECRET = 'tiny'

    expect(githubSyncSecret()).toBeNull()
  })

  it('accepts a long secret and lowercases the owner email', () => {
    process.env.LEAF_GITHUB_SYNC_SECRET = 'a-secret-long-enough'
    process.env.LEAF_GITHUB_SYNC_OWNER = 'Bot@Example.COM'

    expect(githubSyncSecret()).toBe('a-secret-long-enough')
    expect(githubSyncOwnerEmail()).toBe('bot@example.com')
  })
})
