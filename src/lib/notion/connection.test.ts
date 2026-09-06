import { describe, expect, it, vi } from 'vitest'

vi.mock('@/db', () => ({ db: {} }))

import { safeReturnPath } from '@/lib/notion/connection'

describe('safeReturnPath', () => {
  it('keeps a relative path with its query string', () => {
    expect(safeReturnPath('/org?notionImport=workspace')).toBe(
      '/org?notionImport=workspace',
    )
    expect(safeReturnPath('/')).toBe('/')
  })

  it('rejects anything that could leave the app', () => {
    expect(safeReturnPath('//evil.example')).toBeNull()
    expect(safeReturnPath('https://evil.example/')).toBeNull()
    expect(safeReturnPath('/back\\slash')).toBeNull()
    expect(safeReturnPath('/with space')).toBeNull()
    expect(safeReturnPath('')).toBeNull()
    expect(safeReturnPath(null)).toBeNull()
    expect(safeReturnPath(undefined)).toBeNull()
  })
})
