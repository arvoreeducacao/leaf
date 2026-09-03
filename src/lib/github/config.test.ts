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
    expect(parseRepoList('leaf, other/thing', 'arvoreeducacao')).toEqual([
      'arvoreeducacao/leaf',
      'other/thing',
    ])
  })

  it('drops blanks, duplicates and malformed entries', () => {
    expect(
      parseRepoList(' leaf , , leaf, a/b/c, bad name, ', 'arvoreeducacao'),
    ).toEqual(['arvoreeducacao/leaf'])
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

  it('defaults the org and qualifies the repositories', () => {
    process.env.GITHUB_TOKEN = 'ghp_token'
    process.env.LEAF_GITHUB_REPOS = 'leaf,api-arvore'

    expect(githubConfig()).toEqual({
      org: 'arvoreeducacao',
      repos: ['arvoreeducacao/leaf', 'arvoreeducacao/api-arvore'],
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
    process.env.LEAF_GITHUB_SYNC_OWNER = 'Bot@Arvore.com.BR'

    expect(githubSyncSecret()).toBe('a-secret-long-enough')
    expect(githubSyncOwnerEmail()).toBe('bot@arvore.com.br')
  })
})
