export type NotionImportMessages = Readonly<{
  untitled: string
  unreadableZip: string
  noPages: string
  unsafePaths: string
  tooManyEntries: (max: number) => string
  unzippedTooLarge: (limit: string) => string
  assetTooLarge: (name: string, limit: string) => string
  assetFailed: (name: string) => string
  tableTruncated: (columns: number, rows: number) => string
  pageFailed: (title: string) => string
  togglesDegraded: (count: number) => string
  missingLinks: (count: number) => string
}>

type Translate = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string

export function buildNotionImportMessages(
  translate: Translate,
  untitled: string,
): NotionImportMessages {
  return {
    untitled,
    unreadableZip: translate('unreadableZip'),
    noPages: translate('noPages'),
    unsafePaths: translate('unsafePaths'),
    tooManyEntries: (max) => translate('tooManyEntries', { max }),
    unzippedTooLarge: (limit) => translate('unzippedTooLarge', { limit }),
    assetTooLarge: (name, limit) => translate('assetTooLarge', { limit, name }),
    assetFailed: (name) => translate('assetFailed', { name }),
    tableTruncated: (columns, rows) =>
      translate('tableTruncated', { columns, rows }),
    pageFailed: (title) => translate('pageFailed', { title }),
    togglesDegraded: (count) => translate('togglesDegraded', { count }),
    missingLinks: (count) => translate('missingLinks', { count }),
  }
}
