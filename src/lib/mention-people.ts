import { getDocumentAccess } from '@/lib/authz'
import { listOrganizationPeople } from '@/lib/organizations'

export const MENTION_SUGGESTION_LIMIT = 8

export type MentionablePerson = Readonly<{
  id: string
  name: string
  image: string | null
  hasAccess: boolean
}>

type Candidate = Readonly<{
  userId: string
  name: string
  email: string
  image: string | null
}>

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

function rankOf(person: Candidate, needle: string): number | null {
  if (needle.length === 0) {
    return 2
  }

  const name = fold(person.name)
  const handle = fold(person.email.split('@')[0] ?? '')

  if (name.startsWith(needle) || handle.startsWith(needle)) {
    return 0
  }

  if (name.split(/\s+/).some((word) => word.startsWith(needle))) {
    return 1
  }

  return name.includes(needle) || handle.includes(needle) ? 2 : null
}

export function rankMentionCandidates<T extends Candidate>(
  people: ReadonlyArray<T>,
  query: string,
  limit: number = MENTION_SUGGESTION_LIMIT,
): Array<T> {
  const needle = fold(query)

  return people
    .map((person) => ({ person, rank: rankOf(person, needle) }))
    .filter(
      (entry): entry is { person: T; rank: number } => entry.rank !== null,
    )
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        left.person.name.localeCompare(right.person.name),
    )
    .slice(0, limit)
    .map((entry) => entry.person)
}

export async function findMentionablePeople(
  input: Readonly<{
    documentId: string
    orgId: string | null
    query: string
    limit?: number
  }>,
): Promise<Array<MentionablePerson>> {
  if (!input.orgId) {
    return []
  }

  const members = await listOrganizationPeople(input.orgId)
  const picked = rankMentionCandidates(members, input.query, input.limit)

  return Promise.all(
    picked.map(async (person) => ({
      hasAccess:
        (await getDocumentAccess(input.documentId, {
          user: { email: person.email, id: person.userId },
        })) !== null,
      id: person.userId,
      image: person.image,
      name: person.name,
    })),
  )
}
