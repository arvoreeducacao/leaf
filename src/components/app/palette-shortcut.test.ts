import { describe, expect, it } from 'vitest'

import {
  alternateShortcutLabel,
  isMacPlatform,
  primaryShortcutLabel,
  shouldTogglePalette,
} from '@/components/app/palette-shortcut'

const base = {
  key: 'k',
  code: 'KeyK',
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  defaultPrevented: false,
  editorSelection: false,
}

describe('shouldTogglePalette', () => {
  it('opens with Ctrl+K outside the editor', () => {
    expect(shouldTogglePalette({ ...base, ctrlKey: true })).toBe(true)
  })

  it('opens with Cmd+K outside the editor', () => {
    expect(shouldTogglePalette({ ...base, metaKey: true })).toBe(true)
  })

  it('leaves Cmd+K to the link button when there is a selection in the editor', () => {
    expect(
      shouldTogglePalette({ ...base, metaKey: true, editorSelection: true }),
    ).toBe(false)
  })

  it('leaves Cmd+K alone when the editor already handled the event', () => {
    expect(
      shouldTogglePalette({ ...base, metaKey: true, defaultPrevented: true }),
    ).toBe(false)
  })

  it('always opens with Alt+K, even with a selection in the editor', () => {
    expect(
      shouldTogglePalette({
        ...base,
        altKey: true,
        editorSelection: true,
        defaultPrevented: true,
      }),
    ).toBe(true)
  })

  it('recognizes Option+K on macOS, where the key is a dead character', () => {
    expect(
      shouldTogglePalette({ ...base, key: '˚', altKey: true }),
    ).toBe(true)
  })

  it('ignores Ctrl+Alt+K, which is a system combination', () => {
    expect(
      shouldTogglePalette({ ...base, altKey: true, ctrlKey: true }),
    ).toBe(false)
  })

  it('ignores other keys and the bare letter', () => {
    expect(shouldTogglePalette({ ...base, key: 'p', code: 'KeyP' })).toBe(false)
    expect(shouldTogglePalette(base)).toBe(false)
  })
})

describe('shortcut labels', () => {
  it('detects macOS from the user agent', () => {
    expect(isMacPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(
      true,
    )
    expect(isMacPlatform('Mozilla/5.0 (X11; Linux x86_64)')).toBe(false)
  })

  it('shows the symbols of each platform', () => {
    expect(primaryShortcutLabel(true)).toBe('⌘K')
    expect(primaryShortcutLabel(false)).toBe('Ctrl+K')
    expect(alternateShortcutLabel(true)).toBe('⌥K')
    expect(alternateShortcutLabel(false)).toBe('Alt+K')
  })
})
