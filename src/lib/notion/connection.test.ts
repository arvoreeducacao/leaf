import { describe, expect, it, vi } from 'vitest'

vi.mock('@/db', () => ({ db: {} }))

import {
  notionAppOrigin,
  notionReturnUrl,
  safeReturnPath,
} from '@/lib/notion/connection'

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

describe('notionAppOrigin', () => {
  it('takes the public origin from the redirect uri', () => {
    expect(
      notionAppOrigin({
        clientId: 'id',
        clientSecret: 'secret',
        redirectUri: 'https://leaf.arvore.com.br/api/notion/callback',
      }),
    ).toBe('https://leaf.arvore.com.br')
  })
})

describe('notionReturnUrl', () => {
  it('sends the person back to the public origin, never to the server itself', () => {
    expect(
      notionReturnUrl(
        'https://leaf.arvore.com.br',
        '/?notionImport=personal',
        'connected',
      ),
    ).toBe(
      'https://leaf.arvore.com.br/?notionImport=personal&notion=connected',
    )
  })

  it('falls back to the root when there is no path to return to', () => {
    expect(notionReturnUrl('https://leaf.arvore.com.br', null, 'failed')).toBe(
      'https://leaf.arvore.com.br/?notion=failed',
    )
  })
})
