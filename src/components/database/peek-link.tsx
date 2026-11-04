'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentProps } from 'react'

type Props = Omit<ComponentProps<typeof Link>, 'href' | 'replace' | 'scroll'> &
  Readonly<{ rowId: string }>

export function PeekLink({ rowId, ...props }: Props) {
  const pathname = usePathname()

  return (
    <Link
      {...props}
      href={`/peek/${rowId}`}
      replace={pathname.startsWith('/peek/')}
      scroll={false}
    />
  )
}
