import { readDocumentIcon } from '@/lib/document-icon'

export type IconPackColor = Readonly<{
  id: string
  label: string
  swatch: string | null
}>

export type IconPackIcon = Readonly<{
  name: string
  tags: ReadonlyArray<string>
  files: Readonly<Record<string, string>>
}>

export type IconPack = Readonly<{
  name: string
  colors: ReadonlyArray<IconPackColor>
  icons: ReadonlyArray<IconPackIcon>
}>

export const iconPackMaxIcons = 5000
const maxColors = 32
const maxTags = 32
const maxLabelLength = 64
const colorId = /^[a-z0-9-]{1,32}$/
const iconName = /^[a-z0-9][a-z0-9_-]{0,63}$/
const cssColor = /^#[0-9a-f]{3,8}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function shortText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed.length > 0 && trimmed.length <= maxLabelLength ? trimmed : null
}

function readColor(value: unknown): IconPackColor | null {
  const raw = typeof value === 'string' ? { id: value } : value

  if (!isRecord(raw) || typeof raw.id !== 'string' || !colorId.test(raw.id)) {
    return null
  }

  const swatch =
    typeof raw.swatch === 'string' && cssColor.test(raw.swatch)
      ? raw.swatch
      : null

  return { id: raw.id, label: shortText(raw.label) ?? raw.id, swatch }
}

function isIconImageUrl(value: unknown): value is string {
  return typeof value === 'string' && readDocumentIcon(value)?.kind === 'image'
}

function readIcon(
  value: unknown,
  knownColors: ReadonlySet<string>,
): IconPackIcon | null {
  if (
    !isRecord(value) ||
    typeof value.name !== 'string' ||
    !iconName.test(value.name) ||
    !isRecord(value.files)
  ) {
    return null
  }

  const files: Record<string, string> = {}

  for (const [color, url] of Object.entries(value.files)) {
    if (knownColors.has(color) && isIconImageUrl(url)) {
      files[color] = url.trim()
    }
  }

  if (Object.keys(files).length === 0) {
    return null
  }

  const tags = Array.isArray(value.tags)
    ? value.tags
        .map(shortText)
        .filter((tag): tag is string => tag !== null)
        .slice(0, maxTags)
    : []

  return { name: value.name, tags, files }
}

export function parseIconPack(value: unknown): IconPack | null {
  if (!isRecord(value) || !Array.isArray(value.colors) || !Array.isArray(value.icons)) {
    return null
  }

  const colors: Array<IconPackColor> = []
  const seenColors = new Set<string>()

  for (const entry of value.colors.slice(0, maxColors)) {
    const color = readColor(entry)

    if (color && !seenColors.has(color.id)) {
      seenColors.add(color.id)
      colors.push(color)
    }
  }

  const icons: Array<IconPackIcon> = []
  const seenIcons = new Set<string>()

  for (const entry of value.icons.slice(0, iconPackMaxIcons)) {
    const icon = readIcon(entry, seenColors)

    if (icon && !seenIcons.has(icon.name)) {
      seenIcons.add(icon.name)
      icons.push(icon)
    }
  }

  if (colors.length === 0 || icons.length === 0) {
    return null
  }

  return { name: shortText(value.name) ?? '', colors, icons }
}

export function iconPackFile(
  icon: IconPackIcon,
  color: string,
  colors: ReadonlyArray<IconPackColor>,
): string {
  const exact = icon.files[color]

  if (exact) {
    return exact
  }

  const fallback = colors.find((entry) => icon.files[entry.id])

  return fallback ? icon.files[fallback.id] : Object.values(icon.files)[0]
}

function searchable(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .trim()
}

export function searchIconPack(
  icons: ReadonlyArray<IconPackIcon>,
  query: string,
): ReadonlyArray<IconPackIcon> {
  const terms = searchable(query).split(/\s+/).filter(Boolean)

  if (terms.length === 0) {
    return icons
  }

  return icons.filter((icon) => {
    const haystack = searchable([icon.name, ...icon.tags].join(' '))

    return terms.every((term) => haystack.includes(term))
  })
}

export function iconPackLabel(name: string) {
  return name.replace(/[_-]+/g, ' ')
}
