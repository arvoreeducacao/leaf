import { nanoid } from 'nanoid'

const notionHashPattern = /[\s._-]+[0-9a-f]{32}(_all)?$/i

const shortHashPattern = /[\s._-]+[0-9a-f]{8,}$/i

export function directoryOf(path: string): string {
  const index = path.lastIndexOf('/')

  return index === -1 ? '' : path.slice(0, index)
}

export function baseNameOf(path: string): string {
  return path.split('/').pop() ?? ''
}

export function extensionOf(path: string): string {
  const name = baseNameOf(path)
  const index = name.lastIndexOf('.')

  return index <= 0 ? '' : name.slice(index).toLowerCase()
}

export function withoutExtension(path: string): string {
  const extension = extensionOf(path)

  return extension.length === 0 ? path : path.slice(0, -extension.length)
}

export function strippedBaseOf(pathWithoutExtension: string): string {
  const directory = directoryOf(pathWithoutExtension)
  const name = baseNameOf(pathWithoutExtension).replace(notionHashPattern, '')

  return directory.length > 0 ? `${directory}/${name}` : name
}

export function notionTitle(path: string, fallbackTitle: string): string {
  const name = withoutExtension(baseNameOf(path))
  const withoutHash = name.replace(notionHashPattern, '')
  const cleaned = (
    withoutHash.length > 0 ? withoutHash : name.replace(shortHashPattern, '')
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)

  return cleaned.length > 0 ? cleaned : fallbackTitle
}

export function resolveRelativePath(fromDirectory: string, target: string) {
  const base = fromDirectory.length > 0 ? fromDirectory.split('/') : []
  const segments = target.startsWith('/')
    ? target.slice(1).split('/')
    : [...base, ...target.split('/')]

  const stack: Array<string> = []

  for (const segment of segments) {
    if (segment === '' || segment === '.') {
      continue
    }

    if (segment === '..') {
      stack.pop()
      continue
    }

    stack.push(segment)
  }

  return stack.join('/')
}

export function decodeTarget(target: string): string {
  try {
    return decodeURIComponent(target)
  } catch {
    return target
  }
}

export function stripCommonRoot(paths: Array<string>): string {
  if (paths.length === 0) {
    return ''
  }

  const first = paths[0]
  const firstSlash = first.indexOf('/')

  if (firstSlash === -1) {
    return ''
  }

  const candidate = first.slice(0, firstSlash + 1)

  return paths.every((path) => path.startsWith(candidate)) ? candidate : ''
}

export function assetKeyFor(path: string) {
  const extension = extensionOf(path)

  return `u/${nanoid(16)}${extension.length > 0 ? extension : '.bin'}`
}
