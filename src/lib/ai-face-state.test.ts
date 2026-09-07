import { describe, expect, it } from 'vitest'

import {
  faceHoldMs,
  faceMiniMaxSize,
  faceStateFor,
  faceStates,
  faceTransientStates,
  isMiniFace,
} from '@/lib/ai-face-state'

describe('faceStateFor', () => {
  it('rests while the panel is closed and nothing was asked', () => {
    expect(faceStateFor({ open: false, typing: false, status: 'idle' })).toBe(
      'resting',
    )
  })

  it('wakes up when the panel opens', () => {
    expect(faceStateFor({ open: true, typing: false, status: 'idle' })).toBe(
      'alert',
    )
  })

  it('listens while the person types', () => {
    expect(faceStateFor({ open: true, typing: true, status: 'idle' })).toBe(
      'listening',
    )
  })

  it('follows the request over what the person is doing', () => {
    expect(faceStateFor({ open: true, typing: true, status: 'thinking' })).toBe(
      'thinking',
    )
    expect(faceStateFor({ open: true, typing: true, status: 'writing' })).toBe(
      'answering',
    )
  })

  it('reads an answer with no sources as a failure, like the palette does', () => {
    expect(faceStateFor({ open: true, typing: false, status: 'empty' })).toBe(
      'error',
    )
    expect(faceStateFor({ open: true, typing: false, status: 'error' })).toBe(
      'error',
    )
  })

  it('celebrates when the answer ends', () => {
    expect(faceStateFor({ open: true, typing: false, status: 'done' })).toBe(
      'done',
    )
  })

  it('never leaves the panel closed showing a request state', () => {
    for (const status of ['thinking', 'writing', 'done', 'error'] as const) {
      expect(
        faceStateFor({ open: false, typing: false, status }),
      ).not.toBe('resting')
    }
  })

  it('only ever returns a known state', () => {
    for (const status of [
      'idle',
      'thinking',
      'writing',
      'done',
      'empty',
      'error',
    ] as const) {
      for (const open of [true, false]) {
        for (const typing of [true, false]) {
          expect(faceStates).toContain(faceStateFor({ open, typing, status }))
        }
      }
    }
  })
})

describe('isMiniFace', () => {
  it('thins the drawing out at the sizes where it closes up', () => {
    expect(isMiniFace(18)).toBe(true)
    expect(isMiniFace(faceMiniMaxSize)).toBe(true)
  })

  it('keeps the full drawing from the avatar size up', () => {
    expect(isMiniFace(faceMiniMaxSize + 1)).toBe(false)
    expect(isMiniFace(26)).toBe(false)
    expect(isMiniFace(40)).toBe(false)
  })
})

describe('faceHoldMs', () => {
  it('holds every transient state for a while and then lets go', () => {
    for (const state of faceTransientStates) {
      expect(faceHoldMs(state)).toBeGreaterThan(0)
    }
  })

  it('keeps the looping states until something else changes them', () => {
    expect(faceHoldMs('resting')).toBeNull()
    expect(faceHoldMs('alert')).toBeNull()
    expect(faceHoldMs('listening')).toBeNull()
    expect(faceHoldMs('thinking')).toBeNull()
    expect(faceHoldMs('answering')).toBeNull()
  })

  it('lets the error linger longer than the cheer', () => {
    expect(faceHoldMs('error')).toBeGreaterThan(Number(faceHoldMs('done')))
  })
})
