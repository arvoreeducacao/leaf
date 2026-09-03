'use client'

import type { Dictionary } from '@blocknote/core'
import { useState } from 'react'

import { PagesIcon, TrashIcon, TypeSquareIcon } from '@/components/icons'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { ContextEntries, type MenuEntry } from '@/components/ui/menu-entries'

import type { LeafBlock, LeafEditor } from './types'

type TurnIntoTarget = Readonly<{
  key: string
  dictionaryKey: keyof Dictionary['slash_menu']
  update: LeafBlock
}>

const turnIntoTargets: ReadonlyArray<TurnIntoTarget> = [
  { dictionaryKey: 'paragraph', key: 'paragraph', update: { type: 'paragraph' } },
  {
    dictionaryKey: 'heading',
    key: 'heading-1',
    update: { props: { level: 1 }, type: 'heading' },
  },
  {
    dictionaryKey: 'heading_2',
    key: 'heading-2',
    update: { props: { level: 2 }, type: 'heading' },
  },
  {
    dictionaryKey: 'heading_3',
    key: 'heading-3',
    update: { props: { level: 3 }, type: 'heading' },
  },
  {
    dictionaryKey: 'bullet_list',
    key: 'bullet-list',
    update: { type: 'bulletListItem' },
  },
  {
    dictionaryKey: 'numbered_list',
    key: 'numbered-list',
    update: { type: 'numberedListItem' },
  },
  {
    dictionaryKey: 'check_list',
    key: 'check-list',
    update: { type: 'checkListItem' },
  },
  {
    dictionaryKey: 'toggle_list',
    key: 'toggle-list',
    update: { type: 'toggleListItem' },
  },
  { dictionaryKey: 'quote', key: 'quote', update: { type: 'quote' } },
  {
    dictionaryKey: 'code_block',
    key: 'code-block',
    update: { type: 'codeBlock' },
  },
]

const turnIntoSourceTypes = new Set([
  'bulletListItem',
  'callout',
  'checkListItem',
  'codeBlock',
  'heading',
  'numberedListItem',
  'paragraph',
  'quote',
  'toggleListItem',
])

type Props = Readonly<{
  editor: LeafEditor
  editable: boolean
  labels: Readonly<{ turnInto: string; duplicate: string; remove: string }>
  children: React.ReactNode
}>

export function BlockContextMenu({
  editor,
  editable,
  labels,
  children,
}: Props) {
  const [open, setOpen] = useState(false)
  const [blockId, setBlockId] = useState<string | null>(null)

  if (!editable) {
    return children
  }

  function captureBlock(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null
    const outer = target?.closest<HTMLElement>('.bn-block-outer[data-id]')

    setBlockId(outer?.dataset.id ?? null)
  }

  const block = blockId ? editor.getBlock(blockId) : undefined

  const entries: Array<MenuEntry> = []

  if (block && turnIntoSourceTypes.has(block.type)) {
    entries.push({
      icon: TypeSquareIcon,
      items: turnIntoTargets.map((target) => ({
        key: target.key,
        label: editor.dictionary.slash_menu[target.dictionaryKey].title,
        onSelect: () => editor.updateBlock(block, target.update),
      })),
      key: 'turn-into',
      label: labels.turnInto,
    })
  }

  if (block) {
    entries.push({
      icon: PagesIcon,
      key: 'duplicate',
      label: labels.duplicate,
      onSelect: () =>
        editor.insertBlocks([{ ...block, id: undefined }], block, 'after'),
    })
    entries.push({ key: 'separator-remove', separator: true })
    entries.push({
      icon: TrashIcon,
      key: 'remove',
      label: labels.remove,
      onSelect: () => editor.removeBlocks([block]),
      variant: 'destructive',
    })
  }

  return (
    <ContextMenu onOpenChange={setOpen} open={open && entries.length > 0}>
      <ContextMenuTrigger asChild>
        <div className="flex w-full flex-col" onContextMenu={captureBlock}>
          {children}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        <ContextEntries entries={entries} />
      </ContextMenuContent>
    </ContextMenu>
  )
}
