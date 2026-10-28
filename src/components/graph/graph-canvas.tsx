'use client'

import {
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from 'd3-force'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

import type { GraphEdge, GraphNode, LinkRelation } from '@/lib/document-link-graph'

type SimNode = SimulationNodeDatum & {
  id: string
  title: string
  radius: number
  color: string
  degree: number
}

type SimLink = SimulationLinkDatum<SimNode> & { relation: LinkRelation }

type Transform = { k: number; x: number; y: number }

export type GraphCanvasHandle = Readonly<{
  zoomIn: () => void
  zoomOut: () => void
  fit: () => void
}>

type Props = Readonly<{
  nodes: ReadonlyArray<GraphNode>
  edges: ReadonlyArray<GraphEdge>
  degree: ReadonlyMap<string, number>
  colorOf: (node: GraphNode) => string
  selectedId: string | null
  label: string
  onSelect: (id: string | null) => void
  onOpen: (id: string) => void
}>

const minScale = 0.04
const maxScale = 8
const zoomStep = 1.4
const tapTolerance = 5
const hoverRadius = 8
const restingLabels = 24
const fitScale = 2.2
const smallGraph = 40
const maxLabels = 140
const labelChars = 28

function radiusOf(degree: number) {
  return 2.6 + Math.sqrt(degree) * 1.5
}

function readVar(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()

  return value.length > 0 ? value : fallback
}

function shortTitle(title: string) {
  const characters = Array.from(title.trim())

  return characters.length > labelChars
    ? `${characters.slice(0, labelChars - 1).join('').trimEnd()}…`
    : characters.join('')
}

function endpoint(value: string | number | SimNode | undefined): SimNode | null {
  return value && typeof value === 'object' ? value : null
}

export const GraphCanvas = forwardRef<GraphCanvasHandle, Props>(
  function GraphCanvas(
    { nodes, edges, degree, colorOf, selectedId, label, onSelect, onOpen },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const simulationRef = useRef<Simulation<SimNode, SimLink> | null>(null)
    const simNodesRef = useRef<Array<SimNode>>([])
    const simLinksRef = useRef<Array<SimLink>>([])
    const adjacencyRef = useRef<Map<string, Set<string>>>(new Map())
    const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())
    const transformRef = useRef<Transform>({ k: 1, x: 0, y: 0 })
    const sizeRef = useRef({ width: 0, height: 0, ratio: 1 })
    const hoverRef = useRef<string | null>(null)
    const selectedRef = useRef<string | null>(selectedId)
    const frameRef = useRef<number | null>(null)
    const fittedRef = useRef(false)
    const movedByPersonRef = useRef(false)
    const handlersRef = useRef({ onSelect, onOpen })

    handlersRef.current = { onSelect, onOpen }

    function draw() {
      frameRef.current = null

      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')

      if (!canvas || !context) {
        return
      }

      const { width, height, ratio } = sizeRef.current
      const { k, x, y } = transformRef.current
      const brand = readVar('--brand', '#2783de')
      const ink = readVar('--content', '#5f5e59')
      const strongInk = readVar('--content-strong', '#2c2c2b')
      const ground = readVar('--surface-app', '#ffffff')
      const line = readVar('--line-contrast', 'rgba(55,53,47,.4)')
      const fontFamily = getComputedStyle(document.body).fontFamily
      const active = hoverRef.current ?? selectedRef.current
      const near = active ? adjacencyRef.current.get(active) : undefined

      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, width, height)
      context.save()
      context.translate(x, y)
      context.scale(k, k)
      context.lineWidth = 1 / k

      const touchesActive = (link: SimLink) =>
        active !== null &&
        (endpoint(link.source)?.id === active || endpoint(link.target)?.id === active)

      for (const relation of ['subpage', 'citation'] as const) {
        context.beginPath()

        for (const link of simLinksRef.current) {
          const source = endpoint(link.source)
          const target = endpoint(link.target)

          if (
            !source ||
            !target ||
            touchesActive(link) ||
            (relation === 'citation') !== (link.relation === 'citation')
          ) {
            continue
          }

          context.moveTo(source.x ?? 0, source.y ?? 0)
          context.lineTo(target.x ?? 0, target.y ?? 0)
        }

        context.strokeStyle = line
        context.globalAlpha =
          (relation === 'citation' ? 0.55 : 0.22) * (active ? 0.25 : 1)
        context.stroke()
      }

      if (active) {
        context.beginPath()

        for (const link of simLinksRef.current) {
          const source = endpoint(link.source)
          const target = endpoint(link.target)

          if (source && target && touchesActive(link)) {
            context.moveTo(source.x ?? 0, source.y ?? 0)
            context.lineTo(target.x ?? 0, target.y ?? 0)
          }
        }

        context.strokeStyle = brand
        context.globalAlpha = 0.9
        context.lineWidth = 1.6 / k
        context.stroke()
      }

      for (const node of simNodesRef.current) {
        const lit = !active || node.id === active || near?.has(node.id)

        context.globalAlpha = lit ? 1 : 0.16
        context.beginPath()
        context.arc(node.x ?? 0, node.y ?? 0, node.radius, 0, Math.PI * 2)
        context.fillStyle = node.color
        context.fill()
      }

      const selected = simNodesRef.current.find(
        (node) => node.id === selectedRef.current,
      )

      if (selected) {
        context.globalAlpha = 1
        context.beginPath()
        context.arc(selected.x ?? 0, selected.y ?? 0, selected.radius + 5 / k, 0, Math.PI * 2)
        context.strokeStyle = brand
        context.lineWidth = 2 / k
        context.stroke()
      }

      context.restore()

      const labeled = active
        ? simNodesRef.current.filter((node) => node.id === active || near?.has(node.id))
        : simNodesRef.current
            .filter(
              (node, index) =>
                index < restingLabels ||
                simNodesRef.current.length <= smallGraph ||
                node.radius * k > 14,
            )

      context.globalAlpha = 1
      context.textAlign = 'center'
      context.textBaseline = 'top'
      context.lineJoin = 'round'

      for (const node of labeled.slice(0, maxLabels)) {
        const screenX = (node.x ?? 0) * k + x
        const screenY = (node.y ?? 0) * k + y + node.radius * k + 4

        if (screenX < -80 || screenX > width + 80 || screenY < -20 || screenY > height + 20) {
          continue
        }

        const emphasis = node.id === active

        context.font = `${emphasis ? 600 : 400} ${emphasis ? 12.5 : 11}px ${fontFamily}`
        context.strokeStyle = ground
        context.lineWidth = 3.5
        context.strokeText(shortTitle(node.title), screenX, screenY)
        context.fillStyle = emphasis ? strongInk : ink
        context.fillText(shortTitle(node.title), screenX, screenY)
      }
    }

    function requestDraw() {
      if (frameRef.current === null) {
        frameRef.current = requestAnimationFrame(draw)
      }
    }

    function fit() {
      const placed = simNodesRef.current

      if (placed.length === 0) {
        return
      }

      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity

      for (const node of placed) {
        minX = Math.min(minX, (node.x ?? 0) - node.radius)
        minY = Math.min(minY, (node.y ?? 0) - node.radius)
        maxX = Math.max(maxX, (node.x ?? 0) + node.radius)
        maxY = Math.max(maxY, (node.y ?? 0) + node.radius)
      }

      const { width, height } = sizeRef.current
      const pad = 48
      const k = Math.min(
        fitScale,
        Math.max(
          minScale,
          Math.min(
            (width - pad * 2) / Math.max(maxX - minX, 1),
            (height - pad * 2) / Math.max(maxY - minY, 1),
          ),
        ),
      )

      transformRef.current = {
        k,
        x: width / 2 - ((minX + maxX) / 2) * k,
        y: height / 2 - ((minY + maxY) / 2) * k,
      }
      requestDraw()
    }

    function zoomBy(factor: number, originX?: number, originY?: number) {
      const { width, height } = sizeRef.current
      const current = transformRef.current
      const k = Math.min(maxScale, Math.max(minScale, current.k * factor))
      const pivotX = originX ?? width / 2
      const pivotY = originY ?? height / 2
      const worldX = (pivotX - current.x) / current.k
      const worldY = (pivotY - current.y) / current.k

      movedByPersonRef.current = true
      transformRef.current = { k, x: pivotX - worldX * k, y: pivotY - worldY * k }
      requestDraw()
    }

    useImperativeHandle(ref, () => ({
      zoomIn: () => zoomBy(zoomStep),
      zoomOut: () => zoomBy(1 / zoomStep),
      fit: () => {
        movedByPersonRef.current = false
        fit()
      },
    }))

    useEffect(() => {
      selectedRef.current = selectedId
      requestDraw()
    })

    useEffect(() => {
      const previous = positionsRef.current
      const ranked = [...nodes].sort(
        (a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0),
      )

      const simNodes: Array<SimNode> = ranked.map((node) => {
        const known = previous.get(node.id)
        const nodeDegree = degree.get(node.id) ?? 0

        return {
          id: node.id,
          title: node.title,
          degree: nodeDegree,
          radius: radiusOf(nodeDegree),
          color: colorOf(node),
          ...(known ? { x: known.x, y: known.y } : {}),
        }
      })

      const simLinks: Array<SimLink> = edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
        relation: edge.relation,
      }))

      const adjacency = new Map<string, Set<string>>()

      for (const edge of edges) {
        adjacency.set(edge.source, (adjacency.get(edge.source) ?? new Set()).add(edge.target))
        adjacency.set(edge.target, (adjacency.get(edge.target) ?? new Set()).add(edge.source))
      }

      simNodesRef.current = simNodes
      simLinksRef.current = simLinks
      adjacencyRef.current = adjacency
      fittedRef.current = false

      const simulation = forceSimulation<SimNode, SimLink>(simNodes)
        .force(
          'link',
          forceLink<SimNode, SimLink>(simLinks)
            .id((node) => node.id)
            .distance((link) => (link.relation === 'citation' ? 42 : 26))
            .strength((link) => (link.relation === 'citation' ? 0.35 : 0.7)),
        )
        .force('charge', forceManyBody<SimNode>().strength(-34).distanceMax(320).theta(0.9))
        .force('x', forceX<SimNode>(0).strength(0.035))
        .force('y', forceY<SimNode>(0).strength(0.035))
        .force('collide', forceCollide<SimNode>((node) => node.radius + 1.5).iterations(1))
        .alphaDecay(0.028)

      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      const settle = () => {
        if (!fittedRef.current && !movedByPersonRef.current && simulation.alpha() < 0.35) {
          fittedRef.current = true
          fit()
        }

        requestDraw()
      }

      if (calm) {
        simulation.stop()
        simulation.tick(260)
        fittedRef.current = true

        if (!movedByPersonRef.current) {
          fit()
        }

        requestDraw()
      } else {
        simulation.on('tick', settle)
        simulation.on('end', () => {
          for (const node of simNodes) {
            positionsRef.current.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 })
          }
        })
      }

      simulationRef.current = simulation

      return () => {
        for (const node of simNodes) {
          positionsRef.current.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 })
        }

        simulation.stop()
      }
    }, [nodes, edges, degree, colorOf])

    useEffect(() => {
      const container = containerRef.current
      const canvas = canvasRef.current

      if (!container || !canvas) {
        return
      }

      const resize = () => {
        const ratio = window.devicePixelRatio || 1
        const { width, height } = container.getBoundingClientRect()

        sizeRef.current = { width, height, ratio }
        canvas.width = Math.round(width * ratio)
        canvas.height = Math.round(height * ratio)
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`

        if (!movedByPersonRef.current && fittedRef.current) {
          fit()
        }

        requestDraw()
      }

      const observer = new ResizeObserver(resize)

      observer.observe(container)
      resize()

      const theme = new MutationObserver(requestDraw)

      theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

      const toWorld = (clientX: number, clientY: number) => {
        const box = canvas.getBoundingClientRect()
        const { k, x, y } = transformRef.current

        return {
          screenX: clientX - box.left,
          screenY: clientY - box.top,
          worldX: (clientX - box.left - x) / k,
          worldY: (clientY - box.top - y) / k,
        }
      }

      const nodeAt = (clientX: number, clientY: number) => {
        const { worldX, worldY } = toWorld(clientX, clientY)
        const reach = hoverRadius / transformRef.current.k

        return (
          simulationRef.current?.find(worldX, worldY, reach + 6 / transformRef.current.k) ??
          null
        )
      }

      let press: { x: number; y: number; node: SimNode | null; panned: boolean } | null = null

      const onPointerDown = (event: PointerEvent) => {
        canvas.setPointerCapture(event.pointerId)
        press = { x: event.clientX, y: event.clientY, node: nodeAt(event.clientX, event.clientY), panned: false }
      }

      const onPointerMove = (event: PointerEvent) => {
        if (press) {
          const dx = event.clientX - press.x
          const dy = event.clientY - press.y

          if (press.panned || Math.hypot(dx, dy) > tapTolerance) {
            press.panned = true
            movedByPersonRef.current = true
            transformRef.current = {
              ...transformRef.current,
              x: transformRef.current.x + event.movementX,
              y: transformRef.current.y + event.movementY,
            }
            canvas.style.cursor = 'grabbing'
            requestDraw()
          }

          return
        }

        const hovered = nodeAt(event.clientX, event.clientY)?.id ?? null

        if (hovered !== hoverRef.current) {
          hoverRef.current = hovered
          canvas.style.cursor = hovered ? 'pointer' : 'grab'
          requestDraw()
        }
      }

      const onPointerUp = (event: PointerEvent) => {
        if (press && !press.panned) {
          handlersRef.current.onSelect(press.node?.id ?? null)
        }

        press = null
        canvas.style.cursor = hoverRef.current ? 'pointer' : 'grab'

        if (canvas.hasPointerCapture(event.pointerId)) {
          canvas.releasePointerCapture(event.pointerId)
        }
      }

      const onPointerLeave = () => {
        if (hoverRef.current) {
          hoverRef.current = null
          requestDraw()
        }
      }

      const onDoubleClick = (event: MouseEvent) => {
        const node = nodeAt(event.clientX, event.clientY)

        if (node) {
          handlersRef.current.onOpen(node.id)
        }
      }

      const onWheel = (event: WheelEvent) => {
        event.preventDefault()

        const { screenX, screenY } = toWorld(event.clientX, event.clientY)

        zoomBy(Math.exp(-event.deltaY * 0.0015), screenX, screenY)
      }

      canvas.addEventListener('pointerdown', onPointerDown)
      canvas.addEventListener('pointermove', onPointerMove)
      canvas.addEventListener('pointerup', onPointerUp)
      canvas.addEventListener('pointercancel', onPointerUp)
      canvas.addEventListener('pointerleave', onPointerLeave)
      canvas.addEventListener('dblclick', onDoubleClick)
      canvas.addEventListener('wheel', onWheel, { passive: false })

      return () => {
        observer.disconnect()
        theme.disconnect()
        canvas.removeEventListener('pointerdown', onPointerDown)
        canvas.removeEventListener('pointermove', onPointerMove)
        canvas.removeEventListener('pointerup', onPointerUp)
        canvas.removeEventListener('pointercancel', onPointerUp)
        canvas.removeEventListener('pointerleave', onPointerLeave)
        canvas.removeEventListener('dblclick', onDoubleClick)
        canvas.removeEventListener('wheel', onWheel)

        if (frameRef.current !== null) {
          cancelAnimationFrame(frameRef.current)
          frameRef.current = null
        }
      }
    }, [])

    return (
      <div className="absolute inset-0" ref={containerRef}>
        <canvas
          aria-label={label}
          className="block cursor-grab touch-none"
          ref={canvasRef}
          role="img"
        />
      </div>
    )
  },
)
