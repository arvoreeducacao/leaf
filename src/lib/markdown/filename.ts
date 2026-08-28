import { MARKDOWN_EXTENSIONS } from '@/lib/markdown/limits'

export function titleFromFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? ''
  const lowered = base.toLowerCase()
  const extension = MARKDOWN_EXTENSIONS.find((item) => lowered.endsWith(item))
  const withoutExtension = extension
    ? base.slice(0, base.length - extension.length)
    : base
  const title = withoutExtension.trim().slice(0, 200)

  return title.length > 0 ? title : 'Sem título'
}

export function toFileSlug(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')

  return slug.length > 0 ? slug : 'documento'
}
