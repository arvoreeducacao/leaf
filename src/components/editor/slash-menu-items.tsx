import { insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions'
import type { DefaultReactSuggestionItem } from '@blocknote/react'
import { getDefaultReactSlashMenuItems } from '@blocknote/react'

import { IdeaIcon } from '@/components/icons'

import type { CalloutMenuItem } from './dictionary'
import type { LeafEditor } from './types'

export function getLeafSlashMenuItems(
  editor: LeafEditor,
  calloutItem: CalloutMenuItem,
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

  const quoteIndex = defaults.findIndex(
    (item) => item.title === menu.quote.title,
  )
  const insertAt = quoteIndex === -1 ? defaults.length : quoteIndex + 1

  return [
    ...defaults.slice(0, insertAt),
    callout,
    ...defaults.slice(insertAt),
  ]
}
