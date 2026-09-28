import type { DefaultReactSuggestionItem } from '@blocknote/react'
import { nanoid } from 'nanoid'

import { UserAvatar } from '@/components/ui/user-avatar'
import type { MentionablePerson } from '@/lib/mention-people'

import type { LeafEditor } from './types'

export type MentionMenuTexts = Readonly<{
  group: string
  noAccess: string
}>

export function mentionMenuItems(
  editor: LeafEditor,
  people: ReadonlyArray<MentionablePerson>,
  texts: MentionMenuTexts,
): Array<DefaultReactSuggestionItem> {
  return people.map((person) => ({
    group: texts.group,
    icon: (
      <UserAvatar
        className="size-5"
        image={person.image}
        name={person.name}
        userId={person.id}
      />
    ),
    onItemClick: () => {
      editor.insertInlineContent([
        {
          props: { mentionId: nanoid(12), name: person.name, userId: person.id },
          type: 'mention',
        },
        ' ',
      ])
    },
    subtext: person.hasAccess ? undefined : texts.noAccess,
    title: person.name,
  }))
}
