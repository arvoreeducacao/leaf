'use client'

import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'

type MenuIcon = React.ComponentType<{
  'aria-hidden'?: boolean
  className?: string
}>

export type MenuAction = Readonly<{
  key: string
  label: string
  icon?: MenuIcon
  onSelect: () => void
  disabled?: boolean
  variant?: 'default' | 'destructive'
}>

export type MenuSeparator = Readonly<{ key: string; separator: true }>

export type MenuSubmenu = Readonly<{
  key: string
  label: string
  icon?: MenuIcon
  items: ReadonlyArray<MenuAction>
}>

export type MenuEntry = MenuAction | MenuSeparator | MenuSubmenu

function isSeparator(entry: MenuEntry): entry is MenuSeparator {
  return 'separator' in entry
}

function isSubmenu(entry: MenuEntry): entry is MenuSubmenu {
  return 'items' in entry
}

export function DropdownEntries({
  entries,
}: Readonly<{ entries: ReadonlyArray<MenuEntry> }>) {
  return entries.map((entry) => {
    if (isSeparator(entry)) {
      return <DropdownMenuSeparator key={entry.key} />
    }

    if (isSubmenu(entry)) {
      return (
        <DropdownMenuSub key={entry.key}>
          <DropdownMenuSubTrigger>
            {entry.icon ? <entry.icon aria-hidden={true} /> : null}
            {entry.label}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownEntries entries={entry.items} />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )
    }

    return (
      <DropdownMenuItem
        disabled={entry.disabled}
        key={entry.key}
        onSelect={entry.onSelect}
        variant={entry.variant}
      >
        {entry.icon ? <entry.icon aria-hidden={true} /> : null}
        {entry.label}
      </DropdownMenuItem>
    )
  })
}

export function ContextEntries({
  entries,
}: Readonly<{ entries: ReadonlyArray<MenuEntry> }>) {
  return entries.map((entry) => {
    if (isSeparator(entry)) {
      return <ContextMenuSeparator key={entry.key} />
    }

    if (isSubmenu(entry)) {
      return (
        <ContextMenuSub key={entry.key}>
          <ContextMenuSubTrigger>
            {entry.icon ? <entry.icon aria-hidden={true} /> : null}
            {entry.label}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextEntries entries={entry.items} />
          </ContextMenuSubContent>
        </ContextMenuSub>
      )
    }

    return (
      <ContextMenuItem
        disabled={entry.disabled}
        key={entry.key}
        onSelect={entry.onSelect}
        variant={entry.variant}
      >
        {entry.icon ? <entry.icon aria-hidden={true} /> : null}
        {entry.label}
      </ContextMenuItem>
    )
  })
}
