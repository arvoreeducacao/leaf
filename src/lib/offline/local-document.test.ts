import { describe, expect, it } from 'vitest'

import { decideLocalStart } from './local-document'
import type { LocalStartInput, ServerSnapshot } from './local-document'

const serverSnapshot: ServerSnapshot = {
  content: '[]',
  identity: 'server-identity',
  updatedAt: 2_000,
  canEdit: true,
}

function decide(overrides: Partial<LocalStartInput> = {}) {
  return decideLocalStart({
    mode: 'realtime',
    hasLocalState: false,
    hasPendingEdits: false,
    local: null,
    server: serverSnapshot,
    ...overrides,
  })
}

describe('decideLocalStart', () => {
  it('opens the local copy when the server cannot be reached', () => {
    expect(decide({ server: null, hasLocalState: true })).toEqual({
      action: 'local-only',
      conflict: false,
    })
  })

  it('has nothing to open when offline without a local copy', () => {
    expect(decide({ server: null })).toEqual({
      action: 'unavailable',
      conflict: false,
    })
  })

  it('lets collaboration deliver the document when identities match', () => {
    expect(
      decide({
        hasLocalState: true,
        local: { identity: 'server-identity', serverUpdatedAt: 1_000 },
      }),
    ).toEqual({ action: 'connect', conflict: false })
  })

  it('throws the local copy away when the server document was reseeded', () => {
    expect(
      decide({
        hasLocalState: true,
        local: { identity: 'old-identity', serverUpdatedAt: 1_000 },
      }),
    ).toEqual({ action: 'reset-and-connect', conflict: false })
  })

  it('flags a conflict when a reseed would discard unsent edits', () => {
    expect(
      decide({
        hasLocalState: true,
        hasPendingEdits: true,
        local: { identity: 'old-identity', serverUpdatedAt: 1_000 },
      }),
    ).toEqual({ action: 'reset-and-connect', conflict: true })
  })

  it('connects without a local copy instead of seeding by hand', () => {
    expect(decide()).toEqual({ action: 'connect', conflict: false })
  })

  it('seeds the first solo open from the server content', () => {
    expect(decide({ mode: 'solo' })).toEqual({
      action: 'seed',
      conflict: false,
    })
  })

  it('keeps the local copy when the solo server has not moved', () => {
    expect(
      decide({
        mode: 'solo',
        hasLocalState: true,
        local: { identity: null, serverUpdatedAt: 2_000 },
      }),
    ).toEqual({ action: 'local-only', conflict: false })
  })

  it('reseeds a clean local copy when the solo server moved ahead', () => {
    expect(
      decide({
        mode: 'solo',
        hasLocalState: true,
        local: { identity: null, serverUpdatedAt: 1_000 },
      }),
    ).toEqual({ action: 'reset-and-seed', conflict: false })
  })

  it('never discards unsent solo edits, and says the document diverged', () => {
    expect(
      decide({
        mode: 'solo',
        hasLocalState: true,
        hasPendingEdits: true,
        local: { identity: null, serverUpdatedAt: 1_000 },
      }),
    ).toEqual({ action: 'local-only', conflict: true })
  })

  it('treats a local copy with no recorded version as older than the server', () => {
    expect(
      decide({
        mode: 'solo',
        hasLocalState: true,
        local: { identity: null, serverUpdatedAt: null },
      }),
    ).toEqual({ action: 'reset-and-seed', conflict: false })
  })
})
