export const sidebarPreferencesCookie = 'leaf-sidebar'
export const sidebarPreferencesCookieMaxAge = 60 * 60 * 24 * 365

export const defaultSidebarWidth = 240
export const minSidebarWidth = 180
export const sidebarMaxWidthRatio = 0.25

const maxCollapsedSections = 60

export type SidebarPreferences = Readonly<{
  collapsed: boolean
  collapsedSections: Array<string>
  width: number
}>

export const defaultSidebarPreferences: SidebarPreferences = {
  collapsed: false,
  collapsedSections: [],
  width: defaultSidebarWidth,
}

export function limitCollapsedSections(ids: Array<string>) {
  return ids.slice(-maxCollapsedSections)
}

export function parseSidebarPreferences(
  raw: string | undefined,
): SidebarPreferences {
  if (raw === undefined || raw === '') {
    return defaultSidebarPreferences
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SidebarPreferences>

    return {
      collapsed: parsed.collapsed === true,
      collapsedSections: Array.isArray(parsed.collapsedSections)
        ? limitCollapsedSections(
            parsed.collapsedSections.filter(
              (item) => typeof item === 'string',
            ),
          )
        : [],
      width:
        typeof parsed.width === 'number' && Number.isFinite(parsed.width)
          ? Math.max(minSidebarWidth, Math.round(parsed.width))
          : defaultSidebarWidth,
    }
  } catch {
    return defaultSidebarPreferences
  }
}

export function serializeSidebarPreferences(preferences: SidebarPreferences) {
  return JSON.stringify(preferences)
}
