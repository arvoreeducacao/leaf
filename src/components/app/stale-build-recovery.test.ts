import { describe, expect, it } from 'vitest'

import { isStaleBuildError } from './stale-build-recovery'

describe('stale build detection', () => {
  it('recognises the chunk that a finished deploy took away', () => {
    const error = new Error('Failed to load chunk /_next/static/chunks/0okkphpudp5mm.js')
    error.name = 'ChunkLoadError'

    expect(isStaleBuildError(error)).toBe(true)
  })

  it('recognises a module the running build can no longer instantiate', () => {
    expect(
      isStaleBuildError(new Error('was instantiated but the module factory is not available')),
    ).toBe(true)
  })

  it('leaves every other failure alone, so a bug never turns into a reload loop', () => {
    expect(isStaleBuildError(new Error('Network request failed'))).toBe(false)
    expect(isStaleBuildError(null)).toBe(false)
    expect(isStaleBuildError(undefined)).toBe(false)
    expect(isStaleBuildError('boom')).toBe(false)
  })
})
