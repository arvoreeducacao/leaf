export type MarkerEntry = Readonly<{ blockId: string; top: number }>

export const MARKER_MIN_GAP = 34

export function layoutMarkers(
  entries: ReadonlyArray<MarkerEntry>,
  minGap: number = MARKER_MIN_GAP,
): ReadonlyArray<MarkerEntry> {
  const sorted = [...entries].sort(
    (a, b) => a.top - b.top || a.blockId.localeCompare(b.blockId),
  )

  let floor = Number.NEGATIVE_INFINITY

  return sorted.map((entry) => {
    const top = Math.max(entry.top, floor)

    floor = top + minGap

    return { blockId: entry.blockId, top }
  })
}
