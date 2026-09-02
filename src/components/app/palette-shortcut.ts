export type ShortcutSignal = Readonly<{
  key: string
  code: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  defaultPrevented: boolean
  editorSelection: boolean
}>

export function isLetterK(signal: Pick<ShortcutSignal, 'key' | 'code'>) {
  return signal.code === 'KeyK' || signal.key.toLowerCase() === 'k'
}

export function shouldTogglePalette(signal: ShortcutSignal): boolean {
  if (!isLetterK(signal)) {
    return false
  }

  if (signal.altKey) {
    return !signal.metaKey && !signal.ctrlKey
  }

  if (!signal.metaKey && !signal.ctrlKey) {
    return false
  }

  return !signal.defaultPrevented && !signal.editorSelection
}

export function isMacPlatform(userAgent: string): boolean {
  return /Mac|iPod|iPhone|iPad/.test(userAgent)
}

export function primaryShortcutLabel(mac: boolean): string {
  return mac ? '⌘K' : 'Ctrl+K'
}

export function alternateShortcutLabel(mac: boolean): string {
  return mac ? '⌥K' : 'Alt+K'
}
