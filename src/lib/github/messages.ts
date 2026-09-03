export type GithubSyncMessages = Readonly<{
  databaseTitle: string
  untitled: string
  propertyRepository: string
  propertyNumber: string
  propertyState: string
  propertyAuthor: string
  propertyUpdatedAt: string
  propertyUrl: string
  stateOpen: string
  stateMerged: string
  stateClosed: string
  tableView: string
  boardView: string
  repoFailed: (repo: string) => string
  skippedUnchanged: (count: number) => string
}>

type Translate = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string

export function buildGithubSyncMessages(
  translate: Translate,
  untitled: string,
): GithubSyncMessages {
  return {
    untitled,
    databaseTitle: translate('databaseTitle'),
    propertyRepository: translate('propertyRepository'),
    propertyNumber: translate('propertyNumber'),
    propertyState: translate('propertyState'),
    propertyAuthor: translate('propertyAuthor'),
    propertyUpdatedAt: translate('propertyUpdatedAt'),
    propertyUrl: translate('propertyUrl'),
    stateOpen: translate('stateOpen'),
    stateMerged: translate('stateMerged'),
    stateClosed: translate('stateClosed'),
    tableView: translate('tableView'),
    boardView: translate('boardView'),
    repoFailed: (repo) => translate('repoFailed', { repo }),
    skippedUnchanged: (count) => translate('skippedUnchanged', { count }),
  }
}
