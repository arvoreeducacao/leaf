import {
  type SimulationLinkDatum,
  type SimulationNodeDatum,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  forceZ,
} from 'd3-force-3d'

import type { LinkRelation } from '@/lib/document-link-graph'

type LayoutNode = SimulationNodeDatum & { id: string; radius: number }

type LayoutLink = SimulationLinkDatum<LayoutNode> & { relation: LinkRelation }

export type LayoutRequest = Readonly<{
  nodes: ReadonlyArray<Readonly<{ id: string; radius: number; x?: number; y?: number; z?: number }>>
  links: ReadonlyArray<Readonly<{ source: string; target: string; relation: LinkRelation }>>
  calm: boolean
}>

export type LayoutUpdate = Readonly<{
  positions: Float32Array
  alpha: number
  done: boolean
}>

const tickGap = 16
const calmBatch = 20

self.onmessage = (event: MessageEvent<LayoutRequest>) => {
  const { nodes, links, calm } = event.data
  const placed: Array<LayoutNode> = nodes.map((node) => ({ ...node }))
  const simulation = forceSimulation<LayoutNode, LayoutLink>(placed, 3)
    .force(
      'link',
      forceLink<LayoutNode, LayoutLink>(links.map((link) => ({ ...link })))
        .id((node) => node.id)
        .distance((link) => (link.relation === 'citation' ? 42 : 26))
        .strength((link) => (link.relation === 'citation' ? 0.35 : 0.7)),
    )
    .force('charge', forceManyBody<LayoutNode>().strength(-34).distanceMax(320).theta(0.9))
    .force('x', forceX<LayoutNode>(0).strength(0.035))
    .force('y', forceY<LayoutNode>(0).strength(0.035))
    .force('z', forceZ<LayoutNode>(0).strength(0.035))
    .force('collide', forceCollide<LayoutNode>((node) => node.radius + 1.5).iterations(1))
    .alphaDecay(0.028)
    .stop()

  const send = (done: boolean) => {
    const positions = new Float32Array(placed.length * 3)

    placed.forEach((node, index) => {
      positions[index * 3] = node.x ?? 0
      positions[index * 3 + 1] = node.y ?? 0
      positions[index * 3 + 2] = node.z ?? 0
    })

    const update: LayoutUpdate = { positions, alpha: simulation.alpha(), done }

    self.postMessage(update, { transfer: [positions.buffer] })
  }

  const step = () => {
    const started = performance.now()

    simulation.tick(calm ? calmBatch : 1)

    const done = simulation.alpha() < simulation.alphaMin()

    send(done)

    if (!done) {
      setTimeout(step, Math.max(0, tickGap - (performance.now() - started)))
    }
  }

  step()
}
