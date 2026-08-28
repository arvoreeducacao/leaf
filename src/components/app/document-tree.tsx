'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { CaretDownIcon, CaretRightIcon, PageIcon } from '@/components/icons'
import { ButtonIcon } from '@/components/ui/button-icon'
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

const indentByDepth = ['pl-3', 'pl-6', 'pl-10', 'pl-14']

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
    return <p className="px-3 py-2 text-body-small text-gray-700">{emptyLabel}</p>
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
  const visualDepth = Math.min(depth, maxVisualDepth)

  return (
    <ul className="flex flex-col gap-1">
      {nodes.map((node) => {
        const open = expanded.has(node.id)
        const active = activeId === node.id
        const hasChildren = node.children.length > 0
        const deep = depth > maxVisualDepth

        const link = (
          <Link
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-large py-2 text-body-small transition-colors',
              'focus-visible:outline-2 focus-visible:outline-gray-900 focus-visible:outline-offset-2',
              active
                ? 'font-bold text-gray-900'
                : 'text-gray-700 hover:text-gray-900',
            )}
            href={`/doc/${node.id}`}
            onClick={onNavigate}
          >
            <PageIcon aria-hidden="true" className="size-4 shrink-0" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate">{node.title}</span>
              {deep ? (
                <span className="truncate text-gray-700">
                  {ancestors.join(' / ')}
                </span>
              ) : null}
            </span>
          </Link>
        )

        return (
          <li key={node.id}>
            <div
              className={cn(
                'flex min-h-11 items-center gap-1 rounded-large pr-1 transition-colors',
                indentByDepth[visualDepth],
                active ? 'bg-primary-100' : 'hover:bg-gray-200',
              )}
            >
              {hasChildren ? (
                <ButtonIcon
                  aria-expanded={open}
                  aria-label={
                    open ? `Recolher ${node.title}` : `Expandir ${node.title}`
                  }
                  onClick={() => onToggle(node.id)}
                  size="medium"
                  variant="ghost"
                >
                  {open ? (
                    <CaretDownIcon aria-hidden="true" />
                  ) : (
                    <CaretRightIcon aria-hidden="true" />
                  )}
                </ButtonIcon>
              ) : (
                <span aria-hidden="true" className="size-8 shrink-0" />
              )}

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
              <div className="pt-1">
                <TreeLevel
                  activeId={activeId}
                  ancestors={[...ancestors, node.title]}
                  depth={depth + 1}
                  expanded={expanded}
                  nodes={node.children}
                  onNavigate={onNavigate}
                  onToggle={onToggle}
                />
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
