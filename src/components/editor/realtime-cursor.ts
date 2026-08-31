'use client'

import type { RealtimeTheme } from '@/lib/realtime-user'
import { realtimeColorFor, realtimeTextColorFor } from '@/lib/realtime-user'

type CursorUser = Readonly<{
  id?: unknown
  name: string
  color: string
}>

export function renderRealtimeCursor(
  user: CursorUser,
  theme: RealtimeTheme,
  anonymousName: string,
) {
  const color =
    typeof user.id === 'string' && user.id.length > 0
      ? realtimeColorFor(user.id, theme)
      : user.color
  const style = `background-color: ${color}; color: ${realtimeTextColorFor(color)}`

  const base = document.createElement('span')

  base.classList.add('bn-collaboration-cursor__base')

  const caret = document.createElement('span')

  caret.setAttribute('contentedEditable', 'false')
  caret.classList.add('bn-collaboration-cursor__caret')
  caret.setAttribute('style', style)

  const label = document.createElement('span')

  label.classList.add('bn-collaboration-cursor__label')
  label.setAttribute('style', style)
  label.textContent = user.name.trim().length > 0 ? user.name : anonymousName

  caret.append(label)
  base.append('⁠', caret, '⁠')

  return base
}
