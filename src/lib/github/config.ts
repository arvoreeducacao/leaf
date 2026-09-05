export const MAX_GITHUB_REPOS = 40

const repoPattern = /^[A-Za-z0-9._-]+$/

export type GithubConfig = Readonly<{
  token: string
  org: string
  repos: ReadonlyArray<string>
}>

function trimmed(name: string): string {
  return process.env[name]?.trim() ?? ''
}

export function parseRepoList(
  raw: string,
  org: string,
): ReadonlyArray<string> {
  const seen = new Set<string>()

  for (const entry of raw.split(',')) {
    const candidate = entry.trim().replace(/^\/+|\/+$/g, '')

    if (candidate.length === 0) {
      continue
    }

    const parts = candidate.split('/')

    if (parts.length > 2) {
      continue
    }

    const owner = parts.length === 2 ? parts[0] : org
    const name = parts.length === 2 ? parts[1] : parts[0]

    if (!repoPattern.test(owner) || !repoPattern.test(name)) {
      continue
    }

    seen.add(`${owner}/${name}`)

    if (seen.size >= MAX_GITHUB_REPOS) {
      break
    }
  }

  return [...seen]
}

export function githubConfig(): GithubConfig | null {
  const token = trimmed('GITHUB_TOKEN')

  if (token.length === 0) {
    return null
  }

  const org = trimmed('LEAF_GITHUB_ORG')
  const repos = parseRepoList(trimmed('LEAF_GITHUB_REPOS'), org)

  if (repos.length === 0) {
    return null
  }

  return { org, repos, token }
}

export function githubSyncSecret(): string | null {
  const secret = trimmed('LEAF_GITHUB_SYNC_SECRET')

  return secret.length >= 16 ? secret : null
}

export function githubSyncOwnerEmail(): string | null {
  const email = trimmed('LEAF_GITHUB_SYNC_OWNER').toLowerCase()

  return email.length > 0 ? email : null
}
