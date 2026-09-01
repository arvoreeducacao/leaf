import { describe, expect, it } from 'vitest'

import { layoutMarkers } from './marker-layout'

describe('layoutMarkers', () => {
  it('keeps positions that already have room between them', () => {
    const markers = layoutMarkers(
      [
        { blockId: 'b', top: 100 },
        { blockId: 'a', top: 0 },
      ],
      34,
    )

    expect(markers).toEqual([
      { blockId: 'a', top: 0 },
      { blockId: 'b', top: 100 },
    ])
  })

  it('pushes overlapping markers down in document order', () => {
    const markers = layoutMarkers(
      [
        { blockId: 'a', top: 10 },
        { blockId: 'b', top: 12 },
        { blockId: 'c', top: 20 },
      ],
      34,
    )

    expect(markers).toEqual([
      { blockId: 'a', top: 10 },
      { blockId: 'b', top: 44 },
      { blockId: 'c', top: 78 },
    ])
  })

  it('breaks ties between blocks at the same height by id', () => {
    const markers = layoutMarkers(
      [
        { blockId: 'z', top: 50 },
        { blockId: 'a', top: 50 },
      ],
      10,
    )

    expect(markers.map((marker) => marker.blockId)).toEqual(['a', 'z'])
  })

  it('an empty list stays empty', () => {
    expect(layoutMarkers([], 34)).toEqual([])
  })
})
