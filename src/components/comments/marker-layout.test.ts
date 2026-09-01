import { describe, expect, it } from 'vitest'

import { layoutMarkers } from './marker-layout'

describe('layoutMarkers', () => {
  it('mantém posições que já têm espaço entre si', () => {
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

  it('empurra marcadores sobrepostos para baixo na ordem do documento', () => {
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

  it('desempata blocos na mesma altura pelo id', () => {
    const markers = layoutMarkers(
      [
        { blockId: 'z', top: 50 },
        { blockId: 'a', top: 50 },
      ],
      10,
    )

    expect(markers.map((marker) => marker.blockId)).toEqual(['a', 'z'])
  })

  it('lista vazia continua vazia', () => {
    expect(layoutMarkers([], 34)).toEqual([])
  })
})
