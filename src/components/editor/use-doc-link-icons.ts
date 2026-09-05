'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { documentIdFromHref, maxLinkedDocuments } from '@/lib/document-links'

import {
  type LinkedDocumentIcon,
  documentLinkIconRules,
  documentLinkRowRules,
} from './doc-link-icons'

type Props = Readonly<{
  initialTargets: ReadonlyArray<LinkedDocumentIcon>
  container: React.RefObject<HTMLElement | null>
}>

const rescanDelay = 200

function blockOfLinkAlone(anchor: Element): string | null {
  const line = anchor.parentElement

  if (line === null || !line.classList.contains('bn-inline-content')) {
    return null
  }

  const block = anchor.closest('.bn-block-content')

  if (block?.getAttribute('data-content-type') !== 'paragraph') {
    return null
  }

  for (const node of line.childNodes) {
    if (node === anchor || node.nodeName === 'BR') {
      continue
    }

    if (node.nodeType !== Node.TEXT_NODE || node.textContent?.trim() !== '') {
      return null
    }
  }

  return anchor.closest('.bn-block-outer')?.getAttribute('data-id') ?? null
}

function sameOrder(
  left: ReadonlyArray<string>,
  right: ReadonlyArray<string>,
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

export function useDocLinkIcons({ initialTargets, container }: Props) {
  const [targets, setTargets] =
    useState<ReadonlyArray<LinkedDocumentIcon>>(initialTargets)
  const [rowBlocks, setRowBlocks] = useState<ReadonlyArray<string>>([])
  const known = useRef(new Set(initialTargets.map((target) => target.id)))

  useEffect(() => {
    setTargets(initialTargets)

    for (const target of initialTargets) {
      known.current.add(target.id)
    }
  }, [initialTargets])

  const scan = useCallback(() => {
    const root = container.current

    if (!root) {
      return
    }

    const missing = new Set<string>()
    const rows: Array<string> = []

    for (const anchor of root.querySelectorAll('a[href]')) {
      const id = documentIdFromHref(
        anchor.getAttribute('href'),
        window.location.origin,
      )

      if (id === null) {
        continue
      }

      if (!known.current.has(id)) {
        missing.add(id)
      }

      const blockId = blockOfLinkAlone(anchor)

      if (blockId !== null && rows.length < maxLinkedDocuments) {
        rows.push(blockId)
      }
    }

    setRowBlocks((current) => (sameOrder(current, rows) ? current : rows))

    if (missing.size === 0) {
      return
    }

    const ids = [...missing].slice(0, maxLinkedDocuments)

    for (const id of ids) {
      known.current.add(id)
    }

    fetch(`/api/documents/icons?ids=${encodeURIComponent(ids.join(','))}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { targets?: Array<LinkedDocumentIcon> } | null) => {
        const found = payload?.targets ?? []

        if (found.length > 0) {
          setTargets((current) => [...current, ...found])
        }
      })
      .catch(() => undefined)
  }, [container])

  useEffect(() => {
    const root = container.current

    if (!root) {
      return
    }

    let pending: ReturnType<typeof setTimeout> | null = null

    scan()

    const observer = new MutationObserver(() => {
      if (pending !== null) {
        return
      }

      pending = setTimeout(() => {
        pending = null
        scan()
      }, rescanDelay)
    })

    observer.observe(root, {
      attributeFilter: ['href'],
      attributes: true,
      childList: true,
      subtree: true,
    })

    return () => {
      observer.disconnect()

      if (pending !== null) {
        clearTimeout(pending)
      }
    }
  }, [container, scan])

  const css = useMemo(
    () => `${documentLinkIconRules(targets)}${documentLinkRowRules(rowBlocks)}`,
    [rowBlocks, targets],
  )

  return { css, scan }
}
