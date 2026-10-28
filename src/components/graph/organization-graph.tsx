'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { DocumentIcon } from '@/components/app/document-icon'
import { useTopbarSlot } from '@/components/app/topbar-slot'
import {
  AddIcon,
  ArrowRightIcon,
  CancelIcon,
  GraphIcon,
  ReplyIcon,
  SearchIcon,
} from '@/components/icons'
import { type GraphCanvasHandle, GraphCanvas } from '@/components/graph/graph-canvas'
import {
  type GraphFilters,
  darkPalette,
  findByTitle,
  groupLegend,
  groupOf,
  lightPalette,
  linkCounts,
  otherColor,
  otherGroup,
  visibleGraph,
} from '@/components/graph/graph-model'
import { Button } from '@/components/ui/button'
import { ButtonIcon } from '@/components/ui/button-icon'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import type { GraphNode, OrganizationGraph as GraphData } from '@/lib/document-link-graph'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { cn } from '@/shared/utils'

type Props = Readonly<{
  initialFocusId: string | null
  initialDepth: 1 | 2 | null
}>

type LoadState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed' }>
  | Readonly<{ status: 'ready'; graph: GraphData }>

function useDarkTheme() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    const read = () => setDark(root.classList.contains('dark'))
    const observer = new MutationObserver(read)

    read()
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })

    return () => observer.disconnect()
  }, [])

  return dark
}

async function fetchGraph(): Promise<LoadState> {
  try {
    const response = await fetch('/api/graph', { cache: 'no-store' })

    if (!response.ok) {
      return { status: 'failed' }
    }

    return { status: 'ready', graph: (await response.json()) as GraphData }
  } catch {
    return { status: 'failed' }
  }
}

const floating =
  'absolute rounded-xlarge bg-surface-card shadow-down-medium dark:border dark:border-line'

export function OrganizationGraph({ initialFocusId, initialDepth }: Props) {
  const t = useTranslations('graph')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const pathname = usePathname()
  const slot = useTopbarSlot()
  const isMobile = useIsMobile()
  const dark = useDarkTheme()
  const canvasRef = useRef<GraphCanvasHandle>(null)
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [hiddenGroups, setHiddenGroups] = useState<ReadonlySet<string>>(new Set())
  const [showSubpages, setShowSubpages] = useState(true)
  const [showLoose, setShowLoose] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(initialFocusId)
  const [anchorId, setAnchorId] = useState<string | null>(initialFocusId)
  const [depth, setDepth] = useState<1 | 2 | null>(initialFocusId ? initialDepth ?? 1 : null)
  const [query, setQuery] = useState('')
  const [missing, setMissing] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    setState(await fetchGraph())
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const graph = state.status === 'ready' ? state.graph : null
  const legend = useMemo(() => (graph ? groupLegend(graph) : []), [graph])

  const filters: GraphFilters = useMemo(
    () => ({ hiddenGroups, showSubpages, showLoose, focusId: depth ? anchorId : null, depth }),
    [hiddenGroups, showSubpages, showLoose, anchorId, depth],
  )

  const visible = useMemo(
    () =>
      graph
        ? visibleGraph(graph, legend, filters)
        : { nodes: [], edges: [], degree: new Map<string, number>(), loose: 0 },
    [graph, legend, filters],
  )

  const colorOf = useCallback(
    (node: GraphNode) => {
      const group = groupOf(node, legend)
      const entry = legend.find((item) => item.id === group)
      const palette = dark ? darkPalette : lightPalette

      return entry ? palette[entry.index] ?? palette[0] : dark ? otherColor.dark : otherColor.light
    },
    [legend, dark],
  )

  const byId = useMemo(
    () => new Map((graph?.nodes ?? []).map((node) => [node.id, node])),
    [graph],
  )

  const selected = selectedId ? byId.get(selectedId) ?? null : null
  const anchor = depth && anchorId ? byId.get(anchorId) ?? null : null
  const counts = graph && selected ? linkCounts(graph, selected.id) : null
  const teamspaceName = (id: string | null) =>
    graph?.teamspaces.find((teamspace) => teamspace.id === id)?.name ?? null

  const writeUrl = useCallback(
    (focus: string | null, hops: 1 | 2 | null) => {
      const params = new URLSearchParams()

      if (focus && hops) {
        params.set('pagina', focus)
        params.set('saltos', String(hops))
      }

      const search = params.toString()

      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false })
    },
    [pathname, router],
  )

  const openNeighbors = (id: string) => {
    setSelectedId(id)
    setAnchorId(id)
    setDepth(1)
    writeUrl(id, 1)
  }

  const closeNeighbors = () => {
    setAnchorId(null)
    setDepth(null)
    writeUrl(null, null)
  }

  const changeDepth = (hops: 1 | 2) => {
    setDepth(hops)
    writeUrl(anchorId, hops)
  }

  const toggleGroup = (id: string) => {
    setHiddenGroups((current) => {
      const next = new Set(current)

      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next
    })
  }

  const search = () => {
    const found = findByTitle(graph?.nodes ?? [], query)

    setMissing(found === null && query.trim().length > 0)

    if (found) {
      setSelectedId(found.id)
    }
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedId(null)
      }
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const topbar = (
    <div className="flex min-w-0 flex-1 items-center gap-1.5 px-1.5 text-body-small text-content-strong">
      <GraphIcon aria-hidden="true" className="size-4.5 text-content-subtle" />
      <span className="truncate">{t('title')}</span>
      {anchor ? (
        <>
          <span aria-hidden="true" className="text-[13px] text-content-disabled">/</span>
          <DocumentIcon className="size-4.5 text-[15px]" icon={anchor.icon} kind={anchor.kind} />
          <span className="truncate">{anchor.title}</span>
        </>
      ) : null}
    </div>
  )

  const filterPanel = (
    <div className="flex flex-col gap-3 p-2.5">
      <form
        className="flex h-8 items-center gap-2 rounded-large border border-line-muted bg-surface-card px-2.5"
        onSubmit={(event) => {
          event.preventDefault()
          search()
        }}
        role="search"
      >
        <SearchIcon aria-hidden="true" className="size-4 shrink-0 text-content-tertiary" />
        <input
          aria-label={t('search')}
          className="min-w-0 flex-1 bg-transparent text-body-small text-content-strong outline-none placeholder:text-content-tertiary"
          data-testid="graph-search"
          onChange={(event) => {
            setQuery(event.target.value)
            setMissing(false)
          }}
          placeholder={t('search')}
          value={query}
        />
      </form>
      {missing ? <p className="px-0.5 text-caption text-content-subtle">{t('notFound')}</p> : null}
      <div className="flex flex-col gap-1.5">
        <span className="px-0.5 text-caption font-medium text-content-subtle">{t('teamspaces')}</span>
        <div className="flex flex-wrap gap-1.5" data-testid="graph-teamspaces">
          {[...legend.map((entry) => ({ id: entry.id, name: entry.name })), { id: otherGroup, name: t('others') }].map((entry) => {
            const hidden = hiddenGroups.has(entry.id)
            const swatch =
              entry.id === otherGroup
                ? dark ? otherColor.dark : otherColor.light
                : (dark ? darkPalette : lightPalette)[legend.findIndex((item) => item.id === entry.id)]

            return (
              <button
                aria-pressed={!hidden}
                className={cn(
                  'flex h-6 max-w-full items-center gap-1.5 rounded-pill px-2 text-caption transition-colors',
                  hidden
                    ? 'border border-dashed border-line-strong text-content-tertiary'
                    : 'bg-surface-subtle text-content-strong hover:bg-surface-active',
                )}
                key={entry.id}
                onClick={() => toggleGroup(entry.id)}
                type="button"
              >
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: swatch }} />
                <span className="truncate">{entry.name}</span>
              </button>
            )
          })}
        </div>
      </div>
      <label className="flex items-center justify-between gap-3 px-0.5 text-body-small text-content">
        <span>{t('subpages')}</span>
        <Switch checked={showSubpages} onCheckedChange={setShowSubpages} />
      </label>
      <label className="flex items-center justify-between gap-3 px-0.5 text-body-small text-content">
        <span>
          {t('loose')} <span className="text-content-tertiary tabular-nums">({visible.loose})</span>
        </span>
        <Switch checked={showLoose} onCheckedChange={setShowLoose} />
      </label>
    </div>
  )

  const card = selected && counts ? (
    <div
      className={cn(
        floating,
        isMobile ? 'inset-x-0 bottom-0 rounded-b-none px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3' : 'right-4 top-3 w-[300px] px-4 py-3',
      )}
      data-testid="graph-card"
    >
      <div className="flex items-start justify-between gap-2">
        <DocumentIcon className="size-7 text-[24px]" icon={selected.icon} kind={selected.kind} />
        <ButtonIcon aria-label={tCommon('close')} onClick={() => setSelectedId(null)} size="small" variant="ghost">
          <CancelIcon aria-hidden="true" />
        </ButtonIcon>
      </div>
      {teamspaceName(selected.teamspaceId) ? (
        <p className="mt-1 text-caption text-content-subtle">{teamspaceName(selected.teamspaceId)}</p>
      ) : null}
      <p className="mt-0.5 text-body-small font-semibold text-content-strong">{selected.title}</p>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-caption text-content">
        <span className="flex items-center gap-1">
          <ReplyIcon aria-hidden="true" className="size-3.5" />
          {t('incoming', { count: counts.incoming })}
        </span>
        <span className="flex items-center gap-1">
          <ArrowRightIcon aria-hidden="true" className="size-3.5" />
          {t('outgoing', { count: counts.outgoing })}
        </span>
      </div>
      <div className="mt-3 flex gap-2">
        <Button asChild size="sm">
          <Link href={`/doc/${selected.id}`}>{t('openPage')}</Link>
        </Button>
        {anchor?.id === selected.id ? null : (
          <Button onClick={() => openNeighbors(selected.id)} size="sm" type="button" variant="outline">
            {t('neighbors')}
          </Button>
        )}
      </div>
    </div>
  ) : null

  return (
    <div className="relative h-[calc(100dvh-var(--topbar-height))] w-full overflow-hidden bg-surface-app bg-[radial-gradient(circle,var(--line-subtle)_1px,transparent_1.2px)] bg-[length:22px_22px]">
      {slot ? createPortal(topbar, slot) : null}

      {state.status === 'loading' ? (
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-3 text-body-small text-content-subtle">
            <Skeleton className="size-24 rounded-full" />
            <span>{t('loading')}</span>
          </div>
        </div>
      ) : null}

      {state.status === 'failed' ? (
        <div className="absolute inset-0 grid place-items-center px-4">
          <div className="flex flex-col items-center gap-3 text-center text-body-small text-content-subtle">
            <p>{t('failed')}</p>
            <Button onClick={() => void load()} size="sm" type="button" variant="outline">
              {tCommon('tryAgain')}
            </Button>
          </div>
        </div>
      ) : null}

      {graph && graph.edges.length === 0 ? (
        <div className="absolute inset-0 grid place-items-center px-4" data-testid="graph-empty">
          <div className="flex max-w-sm flex-col items-center gap-2 text-center">
            <GraphIcon aria-hidden="true" className="size-8 text-content-tertiary" />
            <p className="text-body-medium font-semibold text-content-strong">{t('empty')}</p>
            <p className="text-body-small text-content-subtle">{t('emptyHint')}</p>
          </div>
        </div>
      ) : null}

      {graph && graph.edges.length > 0 ? (
        <GraphCanvas
          colorOf={colorOf}
          degree={visible.degree}
          edges={visible.edges}
          label={t('canvasLabel')}
          nodes={visible.nodes}
          onOpen={(id) => router.push(`/doc/${id}`)}
          onSelect={setSelectedId}
          ref={canvasRef}
          selectedId={selectedId}
        />
      ) : null}

      {graph ? (
        <>
          {anchor ? (
            <div className={cn(floating, 'left-3 top-3 flex max-w-[calc(100%-1.5rem)] items-center gap-2 py-1.5 pl-3 pr-1.5 text-body-small text-content')} data-testid="graph-neighbors">
              <span className="min-w-0 truncate">
                {t.rich('neighborsOf', { title: anchor.title, b: (chunks) => <b className="font-semibold text-content-strong">{chunks}</b> })}
              </span>
              <div className="flex shrink-0 rounded-large bg-surface-subtle p-0.5 text-caption">
                {([1, 2] as const).map((hops) => (
                  <button
                    aria-pressed={depth === hops}
                    className={cn('rounded-medium px-2 py-0.5', depth === hops ? 'bg-surface-card text-content-strong shadow-down-small' : 'text-content-subtle')}
                    key={hops}
                    onClick={() => changeDepth(hops)}
                    type="button"
                  >
                    {t('hops', { count: hops })}
                  </button>
                ))}
              </div>
              <ButtonIcon aria-label={t('wholeGraph')} onClick={closeNeighbors} size="small" variant="ghost">
                <CancelIcon aria-hidden="true" />
              </ButtonIcon>
            </div>
          ) : isMobile ? (
            <div className="absolute left-3 top-3 flex gap-2">
              <Button className="shadow-down-medium" onClick={() => setFiltersOpen((open) => !open)} size="sm" type="button" variant="outline">
                {t('filters')}
              </Button>
            </div>
          ) : (
            <div className={cn(floating, 'left-4 top-3 w-[272px]')} data-testid="graph-filters">
              {filterPanel}
            </div>
          )}

          {isMobile && filtersOpen && !anchor ? (
            <div className={cn(floating, 'left-3 right-3 top-14')}>{filterPanel}</div>
          ) : null}

          {card}

          {!(isMobile && selected) ? (
            <>
              <div className={cn(floating, 'bottom-4 left-4 px-2.5 py-1.5 text-caption text-content-subtle')} data-testid="graph-stats">
                {t('stats', { pages: visible.nodes.length, links: visible.edges.length })}
              </div>
              <div className={cn(floating, 'bottom-4 right-4 flex flex-col gap-0.5 p-1')}>
                <ButtonIcon aria-label={t('zoomIn')} onClick={() => canvasRef.current?.zoomIn()} size="medium" variant="ghost">
                  <AddIcon aria-hidden="true" />
                </ButtonIcon>
                <ButtonIcon aria-label={t('zoomOut')} onClick={() => canvasRef.current?.zoomOut()} size="medium" variant="ghost">
                  <span aria-hidden="true" className="block h-0.5 w-3.5 rounded-full bg-current" />
                </ButtonIcon>
                <ButtonIcon aria-label={t('fit')} onClick={() => canvasRef.current?.fit()} size="medium" variant="ghost">
                  <GraphIcon aria-hidden="true" />
                </ButtonIcon>
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
