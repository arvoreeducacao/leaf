export const CARD_WIDTH = 308

export const CARD_MIN_WIDTH = 260

export const CARD_GAP = 32

export const CARD_MIN_GAP = 8

export const CARD_STACK_GAP = 10

export const LANE_GUTTER = 16

export const CARD_ANCHOR_OFFSET = 7

export type LaneFit = Readonly<{ left: number; width: number }>

export function fitLane(
  textRight: number,
  viewportWidth: number,
): LaneFit | null {
  const room = viewportWidth - LANE_GUTTER - textRight
  const gap = Math.min(
    CARD_GAP,
    Math.max(CARD_MIN_GAP, room - CARD_MIN_WIDTH),
  )
  const width = Math.min(CARD_WIDTH, room - gap)

  if (width < CARD_MIN_WIDTH) {
    return null
  }

  return { left: textRight + gap, width }
}

export type StackEntry = Readonly<{ id: string; top: number; height: number }>

export type StackedCard = Readonly<{ id: string; top: number }>

export function stackCards(
  entries: ReadonlyArray<StackEntry>,
  gap: number = CARD_STACK_GAP,
): ReadonlyArray<StackedCard> {
  const sorted = [...entries].sort(
    (left, right) => left.top - right.top || left.id.localeCompare(right.id),
  )

  let floor = Number.NEGATIVE_INFINITY

  return sorted.map((entry) => {
    const top = Math.max(entry.top, floor)

    floor = top + entry.height + gap

    return { id: entry.id, top }
  })
}
