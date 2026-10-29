declare module 'd3-force-3d' {
  import type {
    Simulation,
    SimulationLinkDatum,
    SimulationNodeDatum as FlatNodeDatum,
  } from 'd3-force'

  export type { Simulation, SimulationLinkDatum }

  export interface SimulationNodeDatum extends FlatNodeDatum {
    z?: number | undefined
    vz?: number | undefined
    fz?: number | null | undefined
  }

  export interface ForceZ<NodeDatum extends SimulationNodeDatum> {
    (alpha: number): void
    initialize?(nodes: NodeDatum[], random: () => number): void
    strength(strength: number): this
  }

  export function forceSimulation<
    NodeDatum extends SimulationNodeDatum,
    LinkDatum extends SimulationLinkDatum<NodeDatum> | undefined = undefined,
  >(nodes?: NodeDatum[], numDimensions?: 1 | 2 | 3): Simulation<NodeDatum, LinkDatum>

  export function forceZ<NodeDatum extends SimulationNodeDatum>(z?: number): ForceZ<NodeDatum>

  export { forceCollide, forceLink, forceManyBody, forceX, forceY } from 'd3-force'
}
