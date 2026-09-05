import { parseDocumentContent } from '@/components/editor/content'
import type { LinkedDocumentIcon } from '@/components/editor/doc-link-icons'
import { blocksToPlainText } from '@/components/editor/text-stats'

export const previewExcerptLines = 4
export const previewExcerptLength = 240

export type DocumentPreview = Readonly<{
  id: string
  title: string
  icon: string | null
  kind: LinkedDocumentIcon['kind']
  trail: ReadonlyArray<string>
  excerpt: string
}>

export function documentExcerpt(content: string | null): string {
  const lines = blocksToPlainText(parseDocumentContent(content))
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .slice(0, previewExcerptLines)

  const text = lines.join('\n')

  if (text.length <= previewExcerptLength) {
    return text
  }

  return `${text.slice(0, previewExcerptLength).trimEnd()}…`
}

export const previewTrailCrumbs = 3

export function previewTrail(trail: ReadonlyArray<string>): string {
  const tail = trail.slice(-previewTrailCrumbs)
  const path = tail.join(' / ')

  return tail.length < trail.length ? `… / ${path}` : path
}
