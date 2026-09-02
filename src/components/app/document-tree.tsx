'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { DocumentIcon } from '@/components/app/document-icon'
import {
  sidebarEmpty,
  sidebarIcon,
  sidebarRow,
  sidebarRowActive,
} from '@/components/app/sidebar-styles'
import { CaretDownIcon, CaretRightIcon } from '@/components/icons'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { DocumentNode } from '@/lib/documents'
import { readStoredValue, writeStoredValue } from '@/shared/storage'
import { cn } from '@/shared/utils'

const expandedStorageKey = 'leaf:tree-expanded'

type Props = Readonly<{
  nodes: Array<DocumentNode>
  emptyLabel: string
  onNavigate?: () => void
}>

const maxVisualDepth = 3

const indentByDepth = ['pl-1.5', 'pl-5', 'pl-8.5', 'pl-12']

function parentsOf(nodes: Array<DocumentNode>) {
  const parents = new Map<string, string | null>()

  function walk(list: Array<DocumentNode>, parentId: string | null) {
    for (const node of list) {
      parents.set(node.id, parentId)
      walk(node.children, node.id)
    }
  }

  walk(nodes, null)

  return parents
}

export function DocumentTree({ nodes, emptyLabel, onNavigate }: Props) {
  const pathname = usePathname()
  const activeId = pathname.startsWith('/doc/') ? pathname.slice(5) : null
  const parents = useMemo(() => parentsOf(nodes), [nodes])
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const touched = useRef(false)

  useEffect(() => {
    const stored = readStoredValue<Array<string>>(expandedStorageKey, [])

    if (stored.length === 0) {
      return
    }

    setExpanded((current) => {
      const next = new Set(current)

      for (const id of stored) {
        next.add(id)
      }

      return next.size === current.size ? current : next
    })
  }, [])

  useEffect(() => {
    if (!activeId) {
      return
    }

    setExpanded((current) => {
      const next = new Set(current)
      let parent = parents.get(activeId) ?? null

      while (parent) {
        next.add(parent)
        parent = parents.get(parent) ?? null
      }

      return next.size === current.size ? current : next
    })
  }, [activeId, parents])

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current)

      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next
    })

    touched.current = true
  }

  useEffect(() => {
    if (!touched.current) {
      return
    }

    writeStoredValue(expandedStorageKey, [...expanded])
  }, [expanded])

  if (nodes.length === 0) {
    return <p className={sidebarEmpty}>{emptyLabel}</p>
  }

  return (
    <TreeLevel
      activeId={activeId}
      ancestors={[]}
      depth={0}
      expanded={expanded}
      nodes={nodes}
      onNavigate={onNavigate}
      onToggle={toggle}
    />
  )
}

function TreeLevel({
  nodes,
  depth,
  ancestors,
  expanded,
  activeId,
  onToggle,
  onNavigate,
}: Readonly<{
  nodes: Array<DocumentNode>
  depth: number
  ancestors: Array<string>
  expanded: ReadonlySet<string>
  activeId: string | null
  onToggle: (id: string) => void
  onNavigate?: () => void
}>) {
  const t = useTranslations('nav')
  const visualDepth = Math.min(depth, maxVisualDepth)

  return (
    <ul className="flex flex-col">
      {nodes.map((node) => {
        const open = expanded.has(node.id)
        const active = activeId === node.id
        const hasChildren = node.children.length > 0
        const deep = depth > maxVisualDepth
        const nodeKind = node.kind === 'row' ? 'page' : node.kind

        const link = (
          <Link
            aria-current={active ? 'page' : undefined}
            className="flex h-full min-w-0 flex-1 items-center truncate rounded-large focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1"
            href={`/doc/${node.id}`}
            onClick={onNavigate}
          >
            <span className="min-w-0 flex-1 truncate">{node.title}</span>
          </Link>
        )

        return (
          <li key={node.id}>
            <div
              className={cn(
                sidebarRow,
                'group/row gap-1',
                indentByDepth[visualDepth],
                active && sidebarRowActive,
              )}
            >
              <span className="relative flex size-5 shrink-0 items-center justify-center">
                <DocumentIcon
                  className={cn(
                    sidebarIcon,
                    hasChildren && 'group-hover/row:opacity-0',
                  )}
                  icon={node.icon}
                  kind={nodeKind}
                />
                {hasChildren ? (
                  <button
                    aria-expanded={open}
                    aria-label={
                      open
                        ? t('collapseNode', { title: node.title })
                        : t('expandNode', { title: node.title })
                    }
                    className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-small text-content-subtle opacity-0 transition-opacity hover:bg-surface-active hover:text-content group-hover/row:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-focus"
                    onClick={() => onToggle(node.id)}
                    type="button"
                  >
                    {open ? (
                      <CaretDownIcon aria-hidden="true" className="size-3.5" />
                    ) : (
                      <CaretRightIcon aria-hidden="true" className="size-3.5" />
                    )}
                  </button>
                ) : null}
              </span>
              {deep ? (
                <Tooltip>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent>
                    {[...ancestors, node.title].join(' / ')}
                  </TooltipContent>
                </Tooltip>
              ) : (
                link
              )}
            </div>

            {hasChildren && open ? (
              <TreeLevel
                activeId={activeId}
                ancestors={[...ancestors, node.title]}
                depth={depth + 1}
                expanded={expanded}
                nodes={node.children}
                onNavigate={onNavigate}
                onToggle={onToggle}
              />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
