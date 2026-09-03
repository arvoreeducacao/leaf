import { insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions'
import type { DefaultReactSuggestionItem } from '@blocknote/react'
import { getDefaultReactSlashMenuItems } from '@blocknote/react'

import {
  BrowserIcon,
  CloudDownloadIcon,
  DatabaseIcon,
  FileUploadIcon,
  IdeaIcon,
  ZipArchiveIcon,
} from '@/components/icons'

import type {
  CalloutMenuItem,
  DatabaseMenuItem,
  EmbedMenuItem,
} from './dictionary'
import type { LeafEditor } from './types'

export type ImportMenuTexts = Readonly<{
  group: string
  markdown: string
  markdownHint: string
  archive: string
  archiveHint: string
  link: string
  linkHint: string
}>

export type ImportMenuActions = Readonly<{
  onMarkdown: () => void
  onArchive?: () => void
  onLink?: () => void
}>

export type DatabaseMenuAction = DatabaseMenuItem &
  Readonly<{ onInsert: () => void }>

export type MenuInsertion<T> = Readonly<{ after: string; item: T }>

export function arrangeMenuItems<T extends { title: string }>(
  defaults: ReadonlyArray<T>,
  insertions: ReadonlyArray<MenuInsertion<T>>,
  tail: ReadonlyArray<T>,
): Array<T> {
  const items = [...defaults]

  for (const insertion of insertions) {
    const index = items.findIndex((item) => item.title === insertion.after)

    if (index === -1) {
      items.push(insertion.item)
      continue
    }

    items.splice(index + 1, 0, insertion.item)
  }

  return [...items, ...tail]
}

export function getLeafSlashMenuItems(
  editor: LeafEditor,
  calloutItem: CalloutMenuItem,
  importTexts?: ImportMenuTexts,
  importActions?: ImportMenuActions,
  databaseItem?: DatabaseMenuAction,
  aiItems: ReadonlyArray<DefaultReactSuggestionItem> = [],
  embedItem?: EmbedMenuItem,
): DefaultReactSuggestionItem[] {
  const menu = editor.dictionary.slash_menu
  const hiddenGroups = new Set([menu.video.group, menu.emoji.group])
  const allowedMediaTitles = new Set([menu.image.title])

  const defaults = getDefaultReactSlashMenuItems(editor).filter((item) => {
    if (!item.group || !hiddenGroups.has(item.group)) {
      return true
    }

    return allowedMediaTitles.has(item.title)
  })

  const callout: DefaultReactSuggestionItem = {
    ...calloutItem,
    icon: <IdeaIcon aria-hidden="true" className="size-4" />,
    onItemClick: () => {
      insertOrUpdateBlockForSlashMenu(editor, { type: 'callout' })
    },
  }

  const embed: DefaultReactSuggestionItem | null = embedItem
    ? {
        title: embedItem.title,
        subtext: embedItem.subtext,
        aliases: embedItem.aliases,
        group: embedItem.group,
        icon: <BrowserIcon aria-hidden="true" className="size-4" />,
        onItemClick: () => {
          insertOrUpdateBlockForSlashMenu(editor, { type: 'embed' })
        },
      }
    : null

  const database: DefaultReactSuggestionItem | null = databaseItem
    ? {
        title: databaseItem.title,
        subtext: databaseItem.subtext,
        aliases: databaseItem.aliases,
        group: databaseItem.group,
        icon: <DatabaseIcon aria-hidden="true" className="size-4" />,
        onItemClick: databaseItem.onInsert,
      }
    : null

  const archiveAction = importActions?.onArchive
  const linkAction = importActions?.onLink
  const imports: DefaultReactSuggestionItem[] =
    importTexts && importActions
      ? [
          {
            title: importTexts.markdown,
            subtext: importTexts.markdownHint,
            group: importTexts.group,
            icon: <FileUploadIcon aria-hidden="true" className="size-4" />,
            onItemClick: importActions.onMarkdown,
          },
          ...(archiveAction
            ? [
                {
                  title: importTexts.archive,
                  subtext: importTexts.archiveHint,
                  group: importTexts.group,
                  icon: <ZipArchiveIcon aria-hidden="true" className="size-4" />,
                  onItemClick: archiveAction,
                },
              ]
            : []),
          ...(linkAction
            ? [
                {
                  title: importTexts.link,
                  subtext: importTexts.linkHint,
                  group: importTexts.group,
                  icon: <CloudDownloadIcon aria-hidden="true" className="size-4" />,
                  onItemClick: linkAction,
                },
              ]
            : []),
        ]
      : []

  return [
    ...aiItems,
    ...arrangeMenuItems(
      defaults,
      [
        { after: menu.quote.title, item: callout },
        ...(database ? [{ after: menu.table.title, item: database }] : []),
        ...(embed ? [{ after: menu.image.title, item: embed }] : []),
      ],
      imports,
    ),
  ]
}
