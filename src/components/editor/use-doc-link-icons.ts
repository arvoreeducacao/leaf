'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { documentIdFromHref, maxLinkedDocuments } from '@/lib/document-links'

import {
  type LinkedDocumentIcon,
  documentLinkIconRules,
} from './doc-link-icons'

type Props = Readonly<{
  initialTargets: ReadonlyArray<LinkedDocumentIcon>
  container: React.RefObject<HTMLElement | null>
}>

const rescanDelay = 200

export function useDocLinkIcons({ initialTargets, container }: Props) {
  const [targets, setTargets] =
    useState<ReadonlyArray<LinkedDocumentIcon>>(initialTargets)
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

    for (const anchor of root.querySelectorAll('a[href]')) {
      const id = documentIdFromHref(
        anchor.getAttribute('href'),
        window.location.origin,
      )

      if (id !== null && !known.current.has(id)) {
        missing.add(id)
      }
    }

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

  const css = useMemo(() => documentLinkIconRules(targets), [targets])

  return { css, scan }
}
