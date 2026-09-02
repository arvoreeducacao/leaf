export type NotionImportMessages = Readonly<{
  untitled: string
  unreadableZip: string
  noPages: string
  unsafePaths: string
  tooManyEntries: (max: number) => string
  unzippedTooLarge: (limit: string) => string
  assetTooLarge: (name: string, limit: string) => string
  assetFailed: (name: string) => string
  csvColumn: string
  csvView: string
  boardView: string
  csvDatabases: (count: number) => string
  unsupportedBlocks: (count: number, types: string) => string
  skippedUnchanged: (count: number) => string
  unresolvedPeople: (count: number, names: string) => string
  pageFailed: (title: string) => string
  togglesDegraded: (count: number) => string
  missingLinks: (count: number) => string
  crawlTruncated: (max: number) => string
  commentsUnavailable: string
  commentsImported: (count: number) => string
  commentsFailed: string
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
    csvColumn: translate('csvColumn'),
    csvView: translate('csvView'),
    boardView: translate('boardView'),
    csvDatabases: (count) => translate('csvDatabases', { count }),
    unsupportedBlocks: (count, types) =>
      translate('unsupportedBlocks', { count, types }),
    skippedUnchanged: (count) => translate('skippedUnchanged', { count }),
    unresolvedPeople: (count, names) =>
      translate('unresolvedPeople', { count, names }),
    pageFailed: (title) => translate('pageFailed', { title }),
    togglesDegraded: (count) => translate('togglesDegraded', { count }),
    missingLinks: (count) => translate('missingLinks', { count }),
    crawlTruncated: (max) => translate('crawlTruncated', { max }),
    commentsUnavailable: translate('commentsUnavailable'),
    commentsImported: (count) => translate('commentsImported', { count }),
    commentsFailed: translate('commentsFailed'),
  }
}
