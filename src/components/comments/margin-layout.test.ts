import { describe, expect, it } from 'vitest'

import {
  CARD_GAP,
  CARD_MIN_GAP,
  CARD_MIN_WIDTH,
  CARD_WIDTH,
  fitLane,
  stackCards,
} from './margin-layout'

describe('fitLane', () => {
  it('keeps the full card and the wide gap when there is room to spare', () => {
    const lane = fitLane(1_200, 1_600)

    expect(lane).toEqual({ left: 1_200 + CARD_GAP, width: CARD_WIDTH })
  })

  it('narrows the card before touching the gap', () => {
    const lane = fitLane(1_200, 1_528)

    expect(lane?.left).toBe(1_200 + CARD_GAP)
    expect(lane?.width).toBeLessThan(CARD_WIDTH)
    expect(lane?.width).toBeGreaterThanOrEqual(CARD_MIN_WIDTH)
  })

  it('closes the gap only after the card reaches its floor', () => {
    const lane = fitLane(1_200, 1_484)

    expect(lane).toEqual({ left: 1_200 + CARD_MIN_GAP, width: CARD_MIN_WIDTH })
  })

  it('gives up when the narrowest card no longer fits', () => {
    expect(fitLane(1_200, 1_483)).toBeNull()
    expect(fitLane(1_074, 1_280)).toBeNull()
  })
})

describe('stackCards', () => {
  it('leaves cards where they are when they do not collide', () => {
    const cards = stackCards([
      { id: 'a', top: 0, height: 80 },
      { id: 'b', top: 200, height: 80 },
    ])

    expect(cards).toEqual([
      { id: 'a', top: 0 },
      { id: 'b', top: 200 },
    ])
  })

  it('pushes a colliding card below the one above it', () => {
    const cards = stackCards([
      { id: 'a', top: 0, height: 80 },
      { id: 'b', top: 20, height: 60 },
      { id: 'c', top: 40, height: 40 },
    ])

    expect(cards).toEqual([
      { id: 'a', top: 0 },
      { id: 'b', top: 90 },
      { id: 'c', top: 160 },
    ])
  })

  it('orders by position and keeps ties stable', () => {
    const cards = stackCards([
      { id: 'second', top: 10, height: 0 },
      { id: 'first', top: 10, height: 0 },
    ])

    expect(cards.map((card) => card.id)).toEqual(['first', 'second'])
  })

  it('does not mutate the entries it is given', () => {
    const entries = [
      { id: 'b', top: 100, height: 40 },
      { id: 'a', top: 0, height: 40 },
    ]

    stackCards(entries)

    expect(entries.map((entry) => entry.id)).toEqual(['b', 'a'])
  })
})
