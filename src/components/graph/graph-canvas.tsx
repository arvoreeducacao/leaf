'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

import type { LayoutRequest, LayoutUpdate } from '@/components/graph/graph-layout.worker'
import type { GraphEdge, GraphNode, LinkRelation } from '@/lib/document-link-graph'

type SimNode = {
  id: string
  label: string
  radius: number
  colorIndex: number
  x: number
  y: number
  z: number
  screenX: number
  screenY: number
  scale: number
  depth: number
}

type SimLink = Readonly<{ source: SimNode; target: SimNode; relation: LinkRelation }>

type Transform = { k: number; x: number; y: number }

type Vector = readonly [number, number, number]

type Rotation = readonly [Vector, Vector, Vector]

type Focus = { id: string | null; level: number }

type Theme = Readonly<{
  brand: string
  ink: string
  strongInk: string
  ground: string
  line: string
  font: string
}>

type Press = {
  x: number
  y: number
  node: SimNode | null
  moved: boolean
  pan: boolean
  time: number
}

type Pinch = { x: number; y: number; distance: number }

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
  spinning: boolean
  label: string
  onSelect: (id: string | null) => void
  onOpen: (id: string) => void
}>

const minScale = 0.04
const maxScale = 8
const zoomStep = 1.4
const tapTolerance = 5
const hoverRadius = 6
const fitScale = 2.2
const fitAlpha = 0.35
const maxLabels = 140
const labelChars = 28
const cameraDistance = 3
const depthFade = 0.5
const depthBands = 4
const dotScale = 0.42
const minDot = 1.1
const lineWidth = 0.8
const labelFrom = 5
const labelRamp = 3
const fadeRate = 12
const dimmedNode = 0.12
const dragTurn = 0.006
const idleSpin = 0.16
const settleRate = 3
const flingWindow = 80
const longestFrame = 0.05
const restingSpeed = 0.001
const idleFrameGap = 12
const upright: Rotation = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
]

function radiusOf(degree: number) {
  return 2.6 + Math.sqrt(degree) * 1.5
}

function readVar(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()

  return value.length > 0 ? value : fallback
}

function readTheme(): Theme {
  return {
    brand: readVar('--brand', '#2783de'),
    ink: readVar('--content', '#5f5e59'),
    strongInk: readVar('--content-strong', '#2c2c2b'),
    ground: readVar('--surface-app', '#ffffff'),
    line: readVar('--content-subtle', '#7d7a75'),
    font: getComputedStyle(document.body).fontFamily,
  }
}

function prefersCalm() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function shortTitle(title: string) {
  const characters = Array.from(title.trim())

  return characters.length > labelChars
    ? `${characters.slice(0, labelChars - 1).join('').trimEnd()}…`
    : characters.join('')
}

function dot(a: Vector, b: Vector) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function normalized(vector: Vector): Vector {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1

  return [vector[0] / length, vector[1] / length, vector[2] / length]
}

function turn(rotation: Rotation, yaw: number, pitch: number): Rotation {
  const cosYaw = Math.cos(yaw)
  const sinYaw = Math.sin(yaw)
  const cosPitch = Math.cos(pitch)
  const sinPitch = Math.sin(pitch)
  const through = (row: Vector): Vector => [
    row[0] * rotation[0][0] + row[1] * rotation[1][0] + row[2] * rotation[2][0],
    row[0] * rotation[0][1] + row[1] * rotation[1][1] + row[2] * rotation[2][1],
    row[0] * rotation[0][2] + row[1] * rotation[1][2] + row[2] * rotation[2][2],
  ]
  const across = normalized(through([cosYaw, 0, sinYaw]))
  const tilted = through([sinPitch * sinYaw, cosPitch, -sinPitch * cosYaw])
  const overlap = dot(tilted, across)
  const down = normalized([
    tilted[0] - overlap * across[0],
    tilted[1] - overlap * across[1],
    tilted[2] - overlap * across[2],
  ])

  return [
    across,
    down,
    [
      across[1] * down[2] - across[2] * down[1],
      across[2] * down[0] - across[0] * down[2],
      across[0] * down[1] - across[1] * down[0],
    ],
  ]
}

function extentOf(nodes: ReadonlyArray<SimNode>) {
  let extent = 1

  for (const node of nodes) {
    extent = Math.max(extent, Math.hypot(node.x, node.y, node.z) + node.radius)
  }

  return extent
}

function fade(depth: number) {
  return 1 - depth * depthFade
}

function bandOf(depth: number) {
  return Math.min(depthBands - 1, Math.floor(depth * depthBands))
}

function dotOf(node: SimNode) {
  return Math.max(minDot, node.radius * dotScale * node.scale)
}

export const GraphCanvas = forwardRef<GraphCanvasHandle, Props>(
  function GraphCanvas(
    { nodes, edges, degree, colorOf, selectedId, spinning, label, onSelect, onOpen },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const simNodesRef = useRef<Array<SimNode>>([])
    const simLinksRef = useRef<Array<SimLink>>([])
    const byIdRef = useRef<Map<string, SimNode>>(new Map())
    const colorsRef = useRef<Array<string>>([])
    const adjacencyRef = useRef<Map<string, Set<string>>>(new Map())
    const positionsRef = useRef<Map<string, { x: number; y: number; z: number }>>(new Map())
    const transformRef = useRef<Transform>({ k: 1, x: 0, y: 0 })
    const rotationRef = useRef<Rotation>(upright)
    const velocityRef = useRef({ yaw: 0, pitch: 0 })
    const spinDirectionRef = useRef(1)
    const spinningRef = useRef(spinning)
    const grabbedRef = useRef(false)
    const focusRef = useRef<Focus>({ id: null, level: 0 })
    const themeRef = useRef<Theme | null>(null)
    const calmRef = useRef(false)
    const placedRef = useRef(false)
    const lastFrameRef = useRef<number | null>(null)
    const lastPaintRef = useRef(0)
    const sizeRef = useRef({ width: 0, height: 0, ratio: 1 })
    const hoverRef = useRef<string | null>(null)
    const selectedRef = useRef<string | null>(selectedId)
    const frameRef = useRef<number | null>(null)
    const fittedRef = useRef(false)
    const movedByPersonRef = useRef(false)
    const handlersRef = useRef({ onSelect, onOpen })

    handlersRef.current = { onSelect, onOpen }

    function advance(elapsed: number) {
      const velocity = velocityRef.current
      const idle =
        spinningRef.current &&
        !grabbedRef.current &&
        hoverRef.current === null &&
        selectedRef.current === null

      if (grabbedRef.current) {
        return false
      }

      const settle = 1 - Math.exp(-settleRate * elapsed)

      velocity.yaw += ((idle ? idleSpin * spinDirectionRef.current : 0) - velocity.yaw) * settle
      velocity.pitch -= velocity.pitch * settle

      if (!idle && Math.abs(velocity.yaw) < restingSpeed && Math.abs(velocity.pitch) < restingSpeed) {
        velocityRef.current = { yaw: 0, pitch: 0 }

        return false
      }

      rotationRef.current = turn(rotationRef.current, velocity.yaw * elapsed, velocity.pitch * elapsed)

      return true
    }

    function blend(elapsed: number) {
      const wanted = hoverRef.current ?? selectedRef.current
      const focus = focusRef.current
      const goal = wanted === null ? 0 : 1

      if (wanted !== null) {
        focus.id = wanted
      }

      focus.level = calmRef.current
        ? goal
        : focus.level + (goal - focus.level) * (1 - Math.exp(-fadeRate * elapsed))

      if (Math.abs(goal - focus.level) > 0.01) {
        return true
      }

      focus.level = goal

      if (goal === 0) {
        focus.id = null
      }

      return false
    }

    function project(extent: number) {
      const [across, down, away] = rotationRef.current
      const { k, x, y } = transformRef.current
      const camera = extent * cameraDistance

      for (const node of simNodesRef.current) {
        const distance = away[0] * node.x + away[1] * node.y + away[2] * node.z
        const perspective = camera / Math.max(camera + distance, camera * 0.25)

        node.scale = perspective * k
        node.depth = Math.min(1, Math.max(0, (distance + extent) / (extent * 2)))
        node.screenX = x + (across[0] * node.x + across[1] * node.y + across[2] * node.z) * node.scale
        node.screenY = y + (down[0] * node.x + down[1] * node.y + down[2] * node.z) * node.scale
      }
    }

    function draw(time: number) {
      frameRef.current = null

      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')

      if (!canvas || !context) {
        return
      }

      if (!grabbedRef.current && time - lastPaintRef.current < idleFrameGap) {
        requestDraw()

        return
      }

      const elapsed =
        lastFrameRef.current === null
          ? 0
          : Math.min((time - lastFrameRef.current) / 1000, longestFrame)
      const turning = advance(elapsed)
      const fading = blend(elapsed)
      const theme = themeRef.current ?? (themeRef.current = readTheme())
      const { width, height, ratio } = sizeRef.current

      lastFrameRef.current = turning || fading ? time : null
      lastPaintRef.current = time
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, width, height)

      if (!placedRef.current) {
        return
      }

      const simNodes = simNodesRef.current
      const colors = colorsRef.current
      const { id: active, level } = focusRef.current
      const near = active ? adjacencyRef.current.get(active) : undefined
      const focused = (node: SimNode) => node.id === active || near?.has(node.id) === true

      project(extentOf(simNodes))
      context.lineWidth = lineWidth

      const lines = Array.from({ length: depthBands * 2 }, () => new Path2D())
      const highlighted = new Path2D()

      for (const link of simLinksRef.current) {
        const { source, target } = link
        const touchesActive = active !== null && (source.id === active || target.id === active)
        const path = touchesActive
          ? highlighted
          : lines[
              (link.relation === 'citation' ? depthBands : 0) +
                depthBands -
                1 -
                bandOf((source.depth + target.depth) / 2)
            ]

        path.moveTo(source.screenX, source.screenY)
        path.lineTo(target.screenX, target.screenY)
      }

      context.strokeStyle = theme.line

      lines.forEach((path, index) => {
        const band = depthBands - 1 - (index % depthBands)

        context.globalAlpha =
          (index >= depthBands ? 0.42 : 0.26) *
          (1 - level * 0.7) *
          fade((band + 0.5) / depthBands)
        context.stroke(path)
      })

      if (active) {
        context.globalAlpha = 0.34 * (1 - level)
        context.stroke(highlighted)
        context.strokeStyle = theme.brand
        context.globalAlpha = 0.85 * level
        context.lineWidth = 1.2
        context.stroke(highlighted)
      }

      const dots: Array<Path2D | undefined> = new Array(depthBands * colors.length * 2)
      let activeNode: SimNode | null = null

      for (const node of simNodes) {
        const lit = active === null || focused(node) ? 1 : 0
        const slot = ((depthBands - 1 - bandOf(node.depth)) * colors.length + node.colorIndex) * 2 + lit
        const path = dots[slot] ?? (dots[slot] = new Path2D())
        const radius = dotOf(node)

        path.moveTo(node.screenX + radius, node.screenY)
        path.arc(node.screenX, node.screenY, radius, 0, Math.PI * 2)

        if (node.id === active) {
          activeNode = node
        }
      }

      dots.forEach((path, slot) => {
        if (!path) {
          return
        }

        const lit = slot % 2 === 1
        const group = Math.floor(slot / 2)
        const resting = fade((depthBands - 1 - Math.floor(group / colors.length) + 0.5) / depthBands)

        context.globalAlpha = lit
          ? resting + (1 - resting) * level
          : resting * (1 - level * (1 - dimmedNode))
        context.fillStyle = colors[group % colors.length] ?? theme.line
        context.fill(path)
      })

      if (activeNode && level > 0) {
        context.globalAlpha = level
        context.beginPath()
        context.arc(activeNode.screenX, activeNode.screenY, dotOf(activeNode), 0, Math.PI * 2)
        context.fillStyle = theme.brand
        context.fill()
      }

      const selected = selectedRef.current ? byIdRef.current.get(selectedRef.current) : undefined

      if (selected) {
        context.globalAlpha = 1
        context.beginPath()
        context.arc(selected.screenX, selected.screenY, dotOf(selected) + 3, 0, Math.PI * 2)
        context.strokeStyle = theme.brand
        context.lineWidth = 1.5
        context.stroke()
      }

      const labeled: Array<SimNode> = []

      if (activeNode) {
        labeled.push(activeNode)

        for (const id of near ?? []) {
          const neighbor = byIdRef.current.get(id)

          if (neighbor && labeled.length < maxLabels) {
            labeled.push(neighbor)
          }
        }
      }

      for (const node of simNodes) {
        if (labeled.length >= maxLabels) {
          break
        }

        if (!focused(node) && dotOf(node) > labelFrom) {
          labeled.push(node)
        }
      }

      labeled.sort((a, b) => b.depth - a.depth)
      context.textAlign = 'center'
      context.textBaseline = 'top'
      context.lineJoin = 'round'
      context.lineWidth = 3
      context.strokeStyle = theme.ground
      context.font = `400 11px ${theme.font}`

      for (const node of labeled) {
        const radius = dotOf(node)
        const screenX = node.screenX
        const screenY = node.screenY + radius + 4
        const zoomed = Math.min(1, Math.max(0, (radius - labelFrom) / labelRamp)) * fade(node.depth)
        const alpha = focused(node) ? Math.max(zoomed, level) : zoomed * (1 - level * 0.85)

        if (
          alpha < 0.02 ||
          screenX < -80 ||
          screenX > width + 80 ||
          screenY < -20 ||
          screenY > height + 20
        ) {
          continue
        }

        const emphasis = node.id === active

        if (emphasis) {
          context.font = `600 12.5px ${theme.font}`
        }

        context.globalAlpha = alpha
        context.strokeText(node.label, screenX, screenY)
        context.fillStyle = emphasis ? theme.strongInk : theme.ink
        context.fillText(node.label, screenX, screenY)

        if (emphasis) {
          context.font = `400 11px ${theme.font}`
        }
      }

      if (turning || fading) {
        requestDraw()
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

      const extent = extentOf(placed)
      const camera = extent * cameraDistance
      const silhouette = (extent * camera) / Math.sqrt(camera * camera - extent * extent)
      const { width, height } = sizeRef.current
      const pad = 48

      transformRef.current = {
        k: Math.min(
          fitScale,
          Math.max(minScale, (Math.min(width, height) / 2 - pad) / silhouette),
        ),
        x: width / 2,
        y: height / 2,
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
      spinningRef.current = spinning
      requestDraw()
    })

    useEffect(() => {
      const previous = positionsRef.current
      const ranked = [...nodes].sort(
        (a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0),
      )
      const colors: Array<string> = []
      const colorIndex = new Map<string, number>()
      const byId = new Map<string, SimNode>()
      const simNodes: Array<SimNode> = ranked.map((node) => {
        const known = previous.get(node.id)
        const color = colorOf(node)

        if (!colorIndex.has(color)) {
          colorIndex.set(color, colors.length)
          colors.push(color)
        }

        const placed: SimNode = {
          id: node.id,
          label: shortTitle(node.title),
          radius: radiusOf(degree.get(node.id) ?? 0),
          colorIndex: colorIndex.get(color) ?? 0,
          x: known?.x ?? 0,
          y: known?.y ?? 0,
          z: known?.z ?? 0,
          screenX: 0,
          screenY: 0,
          scale: 1,
          depth: 0,
        }

        byId.set(node.id, placed)

        return placed
      })
      const simLinks: Array<SimLink> = []

      for (const edge of edges) {
        const source = byId.get(edge.source)
        const target = byId.get(edge.target)

        if (source && target) {
          simLinks.push({ source, target, relation: edge.relation })
        }
      }

      const adjacency = new Map<string, Set<string>>()

      for (const link of simLinks) {
        adjacency.set(link.source.id, (adjacency.get(link.source.id) ?? new Set()).add(link.target.id))
        adjacency.set(link.target.id, (adjacency.get(link.target.id) ?? new Set()).add(link.source.id))
      }

      simNodesRef.current = simNodes
      simLinksRef.current = simLinks
      byIdRef.current = byId
      colorsRef.current = colors
      adjacencyRef.current = adjacency
      fittedRef.current = false
      placedRef.current = simNodes.some((node) => previous.has(node.id))
      calmRef.current = prefersCalm()

      const remember = () => {
        for (const node of simNodes) {
          positionsRef.current.set(node.id, { x: node.x, y: node.y, z: node.z })
        }
      }

      const worker = new Worker(new URL('./graph-layout.worker.ts', import.meta.url), {
        type: 'module',
      })

      worker.onmessage = (event: MessageEvent<LayoutUpdate>) => {
        const { positions, alpha, done } = event.data

        simNodes.forEach((node, index) => {
          node.x = positions[index * 3] ?? 0
          node.y = positions[index * 3 + 1] ?? 0
          node.z = positions[index * 3 + 2] ?? 0
        })
        placedRef.current = true

        if (!fittedRef.current && !movedByPersonRef.current && (alpha < fitAlpha || done)) {
          fittedRef.current = true
          fit()
        }

        if (done) {
          remember()
          worker.terminate()
        }

        requestDraw()
      }

      const request: LayoutRequest = {
        nodes: simNodes.map((node) =>
          previous.has(node.id)
            ? { id: node.id, radius: node.radius, x: node.x, y: node.y, z: node.z }
            : { id: node.id, radius: node.radius },
        ),
        links: simLinks.map((link) => ({
          source: link.source.id,
          target: link.target.id,
          relation: link.relation,
        })),
        calm: calmRef.current,
      }

      worker.postMessage(request)
      requestDraw()

      return () => {
        if (placedRef.current) {
          remember()
        }

        worker.terminate()
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

      const theme = new MutationObserver(() => {
        themeRef.current = readTheme()
        requestDraw()
      })

      theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

      const local = (clientX: number, clientY: number) => {
        const box = canvas.getBoundingClientRect()

        return { x: clientX - box.left, y: clientY - box.top }
      }

      const nodeAt = (clientX: number, clientY: number) => {
        const point = local(clientX, clientY)
        let nearest: SimNode | null = null

        for (const node of simNodesRef.current) {
          if (
            Math.hypot(node.screenX - point.x, node.screenY - point.y) <= dotOf(node) + hoverRadius &&
            (!nearest || node.depth < nearest.depth)
          ) {
            nearest = node
          }
        }

        return nearest
      }

      const pointers = new Map<number, { x: number; y: number }>()
      let press: Press | null = null
      let pinch: Pinch | null = null

      const spread = (): Pinch | null => {
        const [first, second] = [...pointers.values()]

        if (!first || !second) {
          return null
        }

        const middle = local((first.x + second.x) / 2, (first.y + second.y) / 2)

        return { ...middle, distance: Math.hypot(first.x - second.x, first.y - second.y) }
      }

      const onPointerDown = (event: PointerEvent) => {
        canvas.setPointerCapture(event.pointerId)
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
        grabbedRef.current = true
        velocityRef.current = { yaw: 0, pitch: 0 }

        if (pointers.size >= 2) {
          press = null
          pinch = spread()

          return
        }

        press = {
          x: event.clientX,
          y: event.clientY,
          node: nodeAt(event.clientX, event.clientY),
          moved: false,
          pan: event.shiftKey,
          time: event.timeStamp,
        }
      }

      const onPointerMove = (event: PointerEvent) => {
        const last = pointers.get(event.pointerId)

        if (last) {
          pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
        }

        if (pinch) {
          const next = spread()

          if (next) {
            movedByPersonRef.current = true
            transformRef.current = {
              ...transformRef.current,
              x: transformRef.current.x + next.x - pinch.x,
              y: transformRef.current.y + next.y - pinch.y,
            }
            zoomBy(next.distance / Math.max(pinch.distance, 1), next.x, next.y)
            pinch = next
          }

          return
        }

        if (press && last) {
          const shiftX = event.clientX - last.x
          const shiftY = event.clientY - last.y

          if (press.moved || Math.hypot(event.clientX - press.x, event.clientY - press.y) > tapTolerance) {
            press.moved = true

            if (press.pan) {
              movedByPersonRef.current = true
              transformRef.current = {
                ...transformRef.current,
                x: transformRef.current.x + shiftX,
                y: transformRef.current.y + shiftY,
              }
            } else {
              const yaw = -shiftX * dragTurn
              const pitch = shiftY * dragTurn
              const span = Math.max((event.timeStamp - press.time) / 1000, 1 / 240)
              const velocity = velocityRef.current

              rotationRef.current = turn(rotationRef.current, yaw, pitch)
              velocityRef.current = {
                yaw: velocity.yaw * 0.4 + (yaw / span) * 0.6,
                pitch: velocity.pitch * 0.4 + (pitch / span) * 0.6,
              }
              press.time = event.timeStamp
            }

            canvas.style.cursor = 'grabbing'
            requestDraw()
          }

          return
        }

        if (last) {
          return
        }

        const hovered = nodeAt(event.clientX, event.clientY)?.id ?? null

        if (hovered !== hoverRef.current) {
          hoverRef.current = hovered

          if (hovered) {
            velocityRef.current = { yaw: 0, pitch: 0 }
          }

          canvas.style.cursor = hovered ? 'pointer' : 'grab'
          requestDraw()
        }
      }

      const onPointerUp = (event: PointerEvent) => {
        pointers.delete(event.pointerId)

        if (pinch) {
          pinch = pointers.size >= 2 ? spread() : null
        } else if (press) {
          if (!press.moved) {
            handlersRef.current.onSelect(press.node?.id ?? null)
          }

          if (calmRef.current || press.pan || !press.moved || event.timeStamp - press.time > flingWindow) {
            velocityRef.current = { yaw: 0, pitch: 0 }
          } else if (velocityRef.current.yaw !== 0) {
            spinDirectionRef.current = Math.sign(velocityRef.current.yaw)
          }
        }

        press = null
        grabbedRef.current = pointers.size > 0
        canvas.style.cursor = hoverRef.current ? 'pointer' : 'grab'

        if (canvas.hasPointerCapture(event.pointerId)) {
          canvas.releasePointerCapture(event.pointerId)
        }

        requestDraw()
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

        const point = local(event.clientX, event.clientY)

        zoomBy(Math.exp(-event.deltaY * 0.0015), point.x, point.y)
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
