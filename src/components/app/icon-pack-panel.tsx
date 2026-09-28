'use client'

import { useTranslations } from 'next-intl'
import { useDeferredValue, useEffect, useId, useMemo, useState } from 'react'

import { SearchIcon } from '@/components/icons'
import { Input } from '@/components/ui/input'
import {
  type IconPack,
  type IconPackIcon,
  iconPackFile,
  iconPackLabel,
  parseIconPack,
  searchIconPack,
} from '@/lib/icon-pack'
import { cn } from '@/shared/utils'

let packRequest: Promise<IconPack | null> | null = null

async function requestIconPack(): Promise<IconPack | null> {
  try {
    const response = await fetch('/api/icon-pack')

    if (!response.ok) {
      packRequest = null

      return null
    }

    const body: unknown = await response.json()

    return typeof body === 'object' && body !== null && 'pack' in body
      ? parseIconPack(body.pack)
      : null
  } catch {
    packRequest = null

    return null
  }
}

export function useIconPack(open: boolean) {
  const [pack, setPack] = useState<IconPack | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    let active = true

    packRequest ??= requestIconPack()
    void packRequest.then((loaded) => {
      if (active) {
        setPack(loaded)
      }
    })

    return () => {
      active = false
    }
  }, [open])

  return pack
}

type Props = Readonly<{
  pack: IconPack
  currentIcon: string | null
  busy: boolean
  onPick: (url: string) => void
}>

function colorOfCurrentIcon(pack: IconPack, currentIcon: string | null) {
  if (!currentIcon) {
    return null
  }

  for (const icon of pack.icons) {
    for (const [color, url] of Object.entries(icon.files)) {
      if (url === currentIcon) {
        return color
      }
    }
  }

  return null
}

export function IconPackPanel({ pack, currentIcon, busy, onPick }: Props) {
  const t = useTranslations('icon')
  const searchId = useId()
  const [query, setQuery] = useState('')
  const [color, setColor] = useState(
    () => colorOfCurrentIcon(pack, currentIcon) ?? pack.colors[0].id,
  )
  const deferredQuery = useDeferredValue(query)
  const results = useMemo(
    () => searchIconPack(pack.icons, deferredQuery),
    [pack.icons, deferredQuery],
  )
  const sample = pack.icons[0]

  function iconButton(icon: IconPackIcon) {
    const url = iconPackFile(icon, color, pack.colors)
    const label = iconPackLabel(icon.name)
    const selected = currentIcon === url

    return (
      <li key={icon.name}>
        <button
          aria-label={label}
          aria-pressed={selected}
          className={cn(
            'flex size-9 cursor-pointer items-center justify-center rounded-medium outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
            selected && 'bg-surface-hover ring-2 ring-ring',
          )}
          disabled={busy}
          onClick={() => onPick(url)}
          title={label}
          type="button"
        >
          <img
            alt=""
            className="size-6 object-contain"
            decoding="async"
            draggable={false}
            loading="lazy"
            src={url}
          />
        </button>
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <label className="sr-only" htmlFor={searchId}>
          {t('packSearchLabel')}
        </label>
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-content-subtle"
        />
        <Input
          autoComplete="off"
          className="max-w-none pl-9"
          id={searchId}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('packSearchPlaceholder')}
          type="search"
          value={query}
        />
      </div>

      {pack.colors.length > 1 ? (
        <div
          aria-label={t('packColorLabel')}
          className="flex flex-wrap gap-1"
          role="radiogroup"
        >
          {pack.colors.map((entry) => {
            const checked = entry.id === color

            return (
              <button
                aria-checked={checked}
                aria-label={entry.label}
                className={cn(
                  'flex size-7 cursor-pointer items-center justify-center rounded-full outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring',
                  checked && 'ring-2 ring-ring',
                )}
                key={entry.id}
                onClick={() => setColor(entry.id)}
                role="radio"
                title={entry.label}
                type="button"
              >
                {entry.swatch ? (
                  <span
                    aria-hidden="true"
                    className="size-4 rounded-full"
                    style={{ backgroundColor: entry.swatch }}
                  />
                ) : (
                  <img
                    alt=""
                    className="size-4 object-contain"
                    draggable={false}
                    src={iconPackFile(sample, entry.id, pack.colors)}
                  />
                )}
              </button>
            )
          })}
        </div>
      ) : null}

      <div className="-mr-1 max-h-72 overflow-y-auto pr-1">
        {results.length > 0 ? (
          <ul className="grid grid-cols-8 gap-0.5 tablet:grid-cols-10">
            {results.map(iconButton)}
          </ul>
        ) : (
          <p className="py-6 text-center text-body-small text-content-subtle">
            {t('packSearchEmpty', { query: query.trim() })}
          </p>
        )}
      </div>
    </div>
  )
}
