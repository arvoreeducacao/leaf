export const sidebarSectionIds = [
  'favorites',
  'recents',
  'private',
  'teamspaces',
  'organization',
  'shared',
] as const

export type SidebarSectionId = (typeof sidebarSectionIds)[number]

export type SidebarLayout = Readonly<{
  order: ReadonlyArray<SidebarSectionId>
  hidden: ReadonlyArray<SidebarSectionId>
}>

export const defaultSidebarLayout: SidebarLayout = {
  hidden: [],
  order: sidebarSectionIds,
}

function isSectionId(value: unknown): value is SidebarSectionId {
  return (
    typeof value === 'string' &&
    (sidebarSectionIds as ReadonlyArray<string>).includes(value)
  )
}

function knownSections(value: unknown): Array<SidebarSectionId> {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<SidebarSectionId>()

  for (const item of value) {
    if (isSectionId(item)) {
      seen.add(item)
    }
  }

  return [...seen]
}

export function normalizeSidebarLayout(value: unknown): SidebarLayout {
  const source =
    typeof value === 'object' && value !== null
      ? (value as { order?: unknown; hidden?: unknown })
      : {}
  const order = knownSections(source.order)

  for (const id of sidebarSectionIds) {
    if (order.includes(id)) {
      continue
    }

    order.splice(Math.min(sidebarSectionIds.indexOf(id), order.length), 0, id)
  }

  return { hidden: knownSections(source.hidden), order }
}

export function parseSidebarLayout(raw: string | null | undefined) {
  if (raw === null || raw === undefined || raw.length === 0) {
    return defaultSidebarLayout
  }

  try {
    return normalizeSidebarLayout(JSON.parse(raw))
  } catch {
    return defaultSidebarLayout
  }
}

export function serializeSidebarLayout(layout: SidebarLayout) {
  return JSON.stringify(normalizeSidebarLayout(layout))
}

export function isSectionHidden(layout: SidebarLayout, id: SidebarSectionId) {
  return layout.hidden.includes(id)
}

export function visibleSectionIds(layout: SidebarLayout) {
  return layout.order.filter((id) => !isSectionHidden(layout, id))
}

export function moveSection(
  layout: SidebarLayout,
  id: SidebarSectionId,
  toIndex: number,
): SidebarLayout {
  const from = layout.order.indexOf(id)

  if (from < 0) {
    return layout
  }

  const to = Math.min(Math.max(toIndex, 0), layout.order.length - 1)

  if (to === from) {
    return layout
  }

  const order = [...layout.order]

  order.splice(from, 1)
  order.splice(to, 0, id)

  return { ...layout, order }
}

export function toggleSectionVisibility(
  layout: SidebarLayout,
  id: SidebarSectionId,
): SidebarLayout {
  return {
    ...layout,
    hidden: isSectionHidden(layout, id)
      ? layout.hidden.filter((item) => item !== id)
      : [...layout.hidden, id],
  }
}
