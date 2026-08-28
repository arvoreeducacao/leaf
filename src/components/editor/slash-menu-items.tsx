import { insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions'
import type { DefaultReactSuggestionItem } from '@blocknote/react'
import { getDefaultReactSlashMenuItems } from '@blocknote/react'

import { IdeaIcon } from '@/components/icons'

import { calloutSlashMenuItem } from './dictionary'
import type { LeafEditor } from './types'

const hiddenGroups = new Set(['Mídia', 'Outros'])
const allowedMediaTitles = new Set(['Imagem'])

export function getLeafSlashMenuItems(
  editor: LeafEditor
): DefaultReactSuggestionItem[] {
  const defaults = getDefaultReactSlashMenuItems(editor).filter((item) => {
    if (!item.group || !hiddenGroups.has(item.group)) {
      return true
    }

    return allowedMediaTitles.has(item.title)
  })

  const callout: DefaultReactSuggestionItem = {
    ...calloutSlashMenuItem,
    icon: <IdeaIcon aria-hidden="true" className="size-4" />,
    onItemClick: () => {
      insertOrUpdateBlockForSlashMenu(editor, { type: 'callout' })
    },
  }

  const quoteIndex = defaults.findIndex((item) => item.title === 'Citação')
  const insertAt = quoteIndex === -1 ? defaults.length : quoteIndex + 1

  return [
    ...defaults.slice(0, insertAt),
    callout,
    ...defaults.slice(insertAt),
  ]
}
