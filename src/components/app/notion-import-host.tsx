'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

import {
  notionImportParam,
  notionStatusParam,
} from '@/components/app/notion-import-params'
import { NotionPersonalImportDialog } from '@/components/app/notion-personal-import-dialog'
import { onNotionImportRequest } from '@/components/app/palette-bridge'

function Host() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [connectFailed, setConnectFailed] = useState(false)

  useEffect(() => onNotionImportRequest(() => setOpen(true)), [])

  useEffect(() => {
    if (searchParams.get(notionImportParam) !== 'personal') {
      return
    }

    setConnectFailed(searchParams.get(notionStatusParam) === 'failed')
    setOpen(true)

    const next = new URLSearchParams(searchParams)
    next.delete(notionImportParam)
    next.delete(notionStatusParam)
    const query = next.toString()

    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  return (
    <NotionPersonalImportDialog
      connectFailed={connectFailed}
      onOpenChange={(next: boolean) => {
        setOpen(next)

        if (!next) {
          setConnectFailed(false)
        }
      }}
      open={open}
      returnPath={pathname}
    />
  )
}

export function NotionImportHost() {
  return (
    <Suspense fallback={null}>
      <Host />
    </Suspense>
  )
}
