const minPrefixLength = 12

export function normalizeRowTitle(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export type RowMatcher = Readonly<{
  take: (title: string) => string | null
}>

export function createRowMatcher(
  children: ReadonlyArray<{ id: string; title: string }>,
): RowMatcher {
  const byNormalized = new Map<string, string | null>()
  const prefixes: Array<{ id: string; normalized: string }> = []
  const taken = new Set<string>()

  for (const child of children) {
    const normalized = normalizeRowTitle(child.title)

    if (normalized.length === 0) {
      continue
    }

    byNormalized.set(
      normalized,
      byNormalized.has(normalized) ? null : child.id,
    )

    if (normalized.length >= minPrefixLength) {
      prefixes.push({ id: child.id, normalized })
    }
  }

  return {
    take(title) {
      const normalized = normalizeRowTitle(title)

      if (normalized.length === 0) {
        return null
      }

      const exact = byNormalized.get(normalized)

      if (exact && !taken.has(exact)) {
        taken.add(exact)

        return exact
      }

      const candidates = prefixes
        .filter(
          (candidate) =>
            !taken.has(candidate.id) &&
            normalized.startsWith(candidate.normalized),
        )
        .sort((a, b) => b.normalized.length - a.normalized.length)

      if (
        candidates.length === 0 ||
        (candidates.length > 1 &&
          candidates[0].normalized.length === candidates[1].normalized.length)
      ) {
        return null
      }

      taken.add(candidates[0].id)

      return candidates[0].id
    },
  }
}
