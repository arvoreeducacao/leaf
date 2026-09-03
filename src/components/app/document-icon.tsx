'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { PageIcon, TableIcon } from '@/components/icons/outline'
import { readDocumentIcon } from '@/lib/document-icon'
import { cn } from '@/shared/utils'

type Props = Readonly<{
  icon: string | null | undefined
  kind?: 'page' | 'database' | 'row'
  className?: string
}>

type ImageProps = Readonly<{
  url: string
  className: string
  brighten: boolean
  onBroken: (url: string) => void
}>

function DocumentIconImage({ url, className, brighten, onBroken }: ImageProps) {
  const ref = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const node = ref.current

    if (!node) {
      return
    }

    const check = () => {
      if (node.complete && node.naturalWidth === 0) {
        onBroken(url)
      }
    }

    check()
    node.addEventListener('error', check)
    node.addEventListener('load', check)

    return () => {
      node.removeEventListener('error', check)
      node.removeEventListener('load', check)
    }
  }, [onBroken, url])

  return (
    <img
      alt=""
      aria-hidden="true"
      className={cn(
        'shrink-0 rounded-small object-contain',
        brighten && 'dark:brightness-150',
        className,
      )}
      decoding="async"
      draggable={false}
      loading="lazy"
      ref={ref}
      src={url}
    />
  )
}

export function DocumentIcon({
  icon,
  kind = 'page',
  className = 'size-4',
}: Props) {
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null)
  const onBroken = useCallback((url: string) => setBrokenUrl(url), [])
  const source = readDocumentIcon(icon)

  if (source?.kind === 'text') {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex shrink-0 items-center justify-center leading-none',
          className,
        )}
      >
        {source.text}
      </span>
    )
  }

  if (source?.kind === 'image' && source.url !== brokenUrl) {
    return (
      <DocumentIconImage
        brighten={source.fromNotionLibrary}
        className={className}
        onBroken={onBroken}
        url={source.url}
      />
    )
  }

  const Fallback = kind === 'database' ? TableIcon : PageIcon

  return <Fallback aria-hidden="true" className={cn('shrink-0', className)} />
}
