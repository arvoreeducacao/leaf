'use client'

import { useRouter } from 'next/navigation'

import type { LinkRelation, LinkedDocument } from '@/lib/document-link-graph'
import { cn } from '@/shared/utils'

const width = 360
const height = 200
const centerX = width / 2
const centerY = height / 2 - 6
const radiusX = 128
const radiusY = 64
const maxNodes = 12
const maxLabel = 16

type Neighbor = Readonly<{
  id: string
  title: string
  relation: LinkRelation
}>

type Props = Readonly<{
  title: string
  incoming: ReadonlyArray<LinkedDocument>
  outgoing: ReadonlyArray<LinkedDocument>
  label: string
}>

function shortTitle(title: string) {
  const characters = Array.from(title.trim())

  return characters.length > maxLabel
    ? `${characters.slice(0, maxLabel - 1).join('').trimEnd()}…`
    : characters.join('')
}

function neighborsOf(
  incoming: ReadonlyArray<LinkedDocument>,
  outgoing: ReadonlyArray<LinkedDocument>,
): Array<Neighbor> {
  const byId = new Map<string, Neighbor>()

  for (const linked of [...incoming, ...outgoing]) {
    const known = byId.get(linked.id)

    if (!known || (known.relation !== 'citation' && linked.relation === 'citation')) {
      byId.set(linked.id, {
        id: linked.id,
        title: linked.title,
        relation: linked.relation,
      })
    }
  }

  return [...byId.values()]
    .sort((a, b) => Number(a.relation !== 'citation') - Number(b.relation !== 'citation'))
    .slice(0, maxNodes)
}

export function LocalGraph({ title, incoming, outgoing, label }: Props) {
  const router = useRouter()
  const neighbors = neighborsOf(incoming, outgoing)
  const start = -Math.PI / 2 + 0.35

  const placed = neighbors.map((neighbor, index) => {
    const angle = start + (2 * Math.PI * index) / Math.max(neighbors.length, 1)

    return {
      ...neighbor,
      x: centerX + radiusX * Math.cos(angle),
      y: centerY + radiusY * Math.sin(angle),
    }
  })

  const open = (id: string) => router.push(`/doc/${id}`)

  return (
    <svg
      aria-label={label}
      className="block h-auto w-full"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      {placed.map((node) => (
        <line
          className={cn(
            node.relation === 'citation'
              ? 'stroke-brand'
              : 'stroke-line-stronger [stroke-dasharray:3_3]',
          )}
          key={`line-${node.id}`}
          strokeWidth={node.relation === 'citation' ? 1.5 : 1}
          x1={centerX}
          x2={node.x}
          y1={centerY}
          y2={node.y}
        />
      ))}
      {placed.map((node) => (
        <g
          aria-label={node.title}
          className="cursor-pointer outline-none [&:focus-visible_circle]:stroke-focus [&:hover_text]:fill-content-strong"
          key={node.id}
          onClick={() => open(node.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              open(node.id)
            }
          }}
          role="link"
          tabIndex={0}
        >
          <circle
            className={cn(
              'stroke-surface-card',
              node.relation === 'citation' ? 'fill-brand' : 'fill-content-tertiary',
            )}
            cx={node.x}
            cy={node.y}
            r={5.5}
            strokeWidth={2}
          />
          <text
            className="fill-content stroke-surface-card text-[10.5px] [paint-order:stroke]"
            strokeLinejoin="round"
            strokeWidth={3}
            textAnchor="middle"
            x={node.x}
            y={node.y + 17}
          >
            {shortTitle(node.title)}
          </text>
        </g>
      ))}
      <circle
        className="fill-brand/15 stroke-brand"
        cx={centerX}
        cy={centerY}
        r={14}
        strokeWidth={1.5}
      />
      <circle className="fill-brand" cx={centerX} cy={centerY} r={8} />
      <text
        className="fill-content-strong stroke-surface-card text-[12px] font-semibold [paint-order:stroke]"
        strokeLinejoin="round"
        strokeWidth={3.5}
        textAnchor="middle"
        x={centerX}
        y={centerY + 28}
      >
        {shortTitle(title)}
      </text>
    </svg>
  )
}
