'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import { toast } from 'sonner'

import {
  onCommandPaletteOpen,
  pendingImportFlag,
  requestDocumentImport,
  useImportAvailability,
} from '@/components/app/palette-bridge'
import {
  alternateShortcutLabel,
  isMacPlatform,
  shouldTogglePalette,
} from '@/components/app/palette-shortcut'
import { PaletteAsk } from '@/components/app/palette-ask'
import {
  AddIcon,
  ArchiveUploadIcon,
  ClockIcon,
  MagicWandIcon,
  PageIcon,
  SearchIcon,
  TeamIcon,
} from '@/components/icons'
import { Dialog, DialogOverlay } from '@/components/ui/dialog'
import { askQuestionMinLength } from '@/lib/ai-ask'
import { createDocument } from '@/lib/document-actions'
import { searchWorkspace } from '@/lib/search-actions'
import type { SearchHit } from '@/lib/search-index'
import { writeSessionFlag } from '@/shared/storage'
import { cn } from '@/shared/utils'

type ActionKind = 'new' | 'organization' | 'import' | 'ask'

type PaletteItem = Readonly<{
  key: string
  label: string
  hit: SearchHit | null
  action: ActionKind | null
  icon: React.ComponentType<{ className?: string }>
}>

type PaletteGroup = Readonly<{
  id: string
  label: string
  items: Array<PaletteItem>
}>

type Props = Readonly<{ hasOrganization: boolean; aiEnabled: boolean }>

const searchDebounce = 200

function hasEditorSelection() {
  const selection = window.getSelection()

  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return false
  }

  const node = selection.anchorNode
  const element = node instanceof Element ? node : node?.parentElement

  if (!element) {
    return false
  }

  return element.closest('.bn-editor') !== null
}

export function CommandPalette({ hasOrganization, aiEnabled }: Props) {
  const t = useTranslations('palette')
  const tNav = useTranslations('nav')
  const router = useRouter()
  const listId = useId()
  const optionPrefix = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const requestId = useRef(0)
  const importAvailable = useImportAvailability()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [documents, setDocuments] = useState<Array<SearchHit>>([])
  const [recent, setRecent] = useState(true)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const [asked, setAsked] = useState<string | null>(null)
  const [mac, setMac] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setMac(isMacPlatform(window.navigator.userAgent))
  }, [])

  useEffect(() => onCommandPaletteOpen(() => setOpen(true)), [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        !shouldTogglePalette({
          key: event.key,
          code: event.code,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          altKey: event.altKey,
          defaultPrevented: event.defaultPrevented,
          editorSelection: hasEditorSelection(),
        })
      ) {
        return
      }

      event.preventDefault()
      setOpen((current) => !current)
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }

    setQuery('')
    setSelected(0)
    setAsked(null)
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    const term = query.trim()
    const current = requestId.current + 1
    requestId.current = current

    setLoading(true)

    const timer = window.setTimeout(
      () => {
        searchWorkspace(term)
          .then((result) => {
            if (requestId.current !== current) {
              return
            }

            setDocuments(result.documents)
            setRecent(result.recent)
          })
          .catch(() => {
            if (requestId.current === current) {
              setDocuments([])
            }
          })
          .finally(() => {
            if (requestId.current === current) {
              setLoading(false)
            }
          })
      },
      term.length === 0 ? 0 : searchDebounce,
    )

    return () => {
      window.clearTimeout(timer)
    }
  }, [open, query])

  const actions = useMemo<Array<PaletteItem>>(() => {
    const list: Array<PaletteItem> = [
      {
        key: 'action-new',
        label: t('actionNewDocument'),
        hit: null,
        action: 'new',
        icon: AddIcon,
      },
    ]

    if (hasOrganization) {
      list.push({
        key: 'action-organization',
        label: t('actionOrganization'),
        hit: null,
        action: 'organization',
        icon: TeamIcon,
      })
    }

    list.push({
      key: 'action-import',
      label: t('actionImport'),
      hit: null,
      action: 'import',
      icon: ArchiveUploadIcon,
    })

    const term = query.trim().toLowerCase()

    if (term.length === 0) {
      return list
    }

    return list.filter((item) => item.label.toLowerCase().includes(term))
  }, [hasOrganization, query, t])

  const groups = useMemo<Array<PaletteGroup>>(() => {
    const result: Array<PaletteGroup> = []
    const question = query.trim()

    if (aiEnabled && question.length >= askQuestionMinLength) {
      result.push({
        id: 'ai',
        label: t('askSection'),
        items: [
          {
            key: 'action-ask',
            label: t('askActionWithQuery', { query: question }),
            hit: null,
            action: 'ask',
            icon: MagicWandIcon,
          },
        ],
      })
    }

    if (documents.length > 0) {
      result.push({
        id: 'documents',
        label: recent ? t('sectionRecent') : t('sectionDocuments'),
        items: documents.map((hit) => ({
          key: `doc-${hit.id}`,
          label: hit.title,
          hit,
          action: null,
          icon: recent ? ClockIcon : PageIcon,
        })),
      })
    }

    if (actions.length > 0) {
      result.push({ id: 'actions', label: t('sectionActions'), items: actions })
    }

    return result
  }, [actions, aiEnabled, documents, query, recent, t])

  const items = useMemo(() => groups.flatMap((group) => group.items), [groups])

  useEffect(() => {
    setSelected((current) =>
      current > items.length - 1 ? Math.max(items.length - 1, 0) : current,
    )
  }, [items.length])

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${selected}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const runAction = useCallback(
    (kind: ActionKind) => {
      if (kind === 'ask') {
        setAsked(query.trim())

        return
      }

      if (kind === 'organization') {
        setOpen(false)
        router.push('/org')

        return
      }

      if (kind === 'import' && importAvailable) {
        setOpen(false)
        requestDocumentImport()

        return
      }

      if (kind === 'import') {
        writeSessionFlag(pendingImportFlag, 'markdown')
      }

      startTransition(async () => {
        try {
          await createDocument()
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes('NEXT_REDIRECT')
          ) {
            setOpen(false)

            throw error
          }

          toast.error(tNav('newDocumentFailed'))
        }
      })
    },
    [importAvailable, query, router, tNav],
  )

  const activate = useCallback(
    (item: PaletteItem) => {
      if (item.hit) {
        setOpen(false)
        router.push(`/doc/${item.hit.id}`)

        return
      }

      if (item.action) {
        runAction(item.action)
      }
    },
    [router, runAction],
  )

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (items.length === 0) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelected((current) => (current + 1) % items.length)

      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelected((current) => (current - 1 + items.length) % items.length)

      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      setSelected(0)

      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      setSelected(items.length - 1)

      return
    }

    if (event.key === 'Enter') {
      const item = items[selected]

      if (!item) {
        return
      }

      event.preventDefault()
      activate(item)
    }
  }

  const status = loading
    ? t('loading')
    : items.length === 0
      ? t('empty')
      : t('resultCount', { count: items.length })

  let index = -1

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogPrimitive.Portal>
        <DialogOverlay />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed inset-x-4 top-[12dvh] z-50 flex max-h-[70dvh] flex-col overflow-hidden rounded-lg bg-surface-card shadow-center-xlarge duration-150 data-[state=closed]:animate-out data-[state=open]:animate-in tablet:inset-x-auto tablet:left-[50%] tablet:w-[calc(100%-2rem)] tablet:max-w-180 tablet:translate-x-[-50%]"
          data-testid="command-palette"
          onEscapeKeyDown={(event) => {
            if (asked === null) {
              return
            }

            event.preventDefault()
            setAsked(null)
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            inputRef.current?.focus()
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            {t('title')}
          </DialogPrimitive.Title>

          {asked !== null ? (
            <PaletteAsk
              onBack={() => setAsked(null)}
              onOpenDocument={(documentId) => {
                setOpen(false)
                router.push(`/doc/${documentId}`)
              }}
              question={asked}
            />
          ) : (
            <>
              <div className="flex items-center gap-2 border-line-divider border-b px-3 py-2.5">
                <SearchIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-content-subtle"
                />
                <input
                  aria-activedescendant={
                    items.length > 0 ? `${optionPrefix}-${selected}` : undefined
                  }
                  aria-autocomplete="list"
                  aria-controls={listId}
                  aria-expanded={true}
                  aria-label={t('title')}
                  autoComplete="off"
                  className="min-w-0 flex-1 bg-transparent text-body-small text-content-strong outline-hidden placeholder:text-content-disabled"
                  data-testid="command-palette-input"
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setSelected(0)
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={t('placeholder')}
                  ref={inputRef}
                  role="combobox"
                  type="text"
                  value={query}
                />
                <span
                  aria-hidden="true"
                  className="shrink-0 rounded-small bg-surface-subtle px-1.5 py-0.5 font-sans text-caption text-content-subtle"
                >
                  Esc
                </span>
              </div>

              <span aria-live="polite" className="sr-only" role="status">
                {status}
              </span>

              <ul
                aria-label={t('resultsLabel')}
                className="min-h-0 flex-1 overflow-y-auto p-1"
                id={listId}
                ref={listRef}
                role="listbox"
              >
                {items.length === 0 ? (
                  <li
                    className="px-3 py-10 text-center text-body-small text-content-subtle"
                    role="presentation"
                  >
                    {loading ? t('loading') : t('empty')}
                  </li>
                ) : null}

                {groups.map((group) => (
                  <li key={group.id} role="presentation">
                    <p
                      aria-hidden="true"
                      className="px-2 pt-2 pb-1 font-medium text-caption text-content-subtle"
                    >
                      {group.label}
                    </p>
                    <ul aria-label={group.label} role="group">
                      {group.items.map((item) => {
                        index += 1
                        const position = index
                        const Icon = item.icon
                        const active = position === selected

                        return (
                          <li
                            aria-selected={active}
                            className={cn(
                              'flex min-h-11 cursor-pointer items-center gap-2 rounded-medium px-2 py-1 transition-colors tablet:min-h-7',
                              active ? 'bg-surface-hover' : 'hover:bg-surface-hover',
                            )}
                            data-index={position}
                            id={`${optionPrefix}-${position}`}
                            key={item.key}
                            onClick={() => activate(item)}
                            onMouseMove={() => setSelected(position)}
                            role="option"
                          >
                            <Icon
                              aria-hidden="true"
                              className="size-4 shrink-0 text-content-subtle"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-body-small text-content-strong">
                                {item.label}
                              </span>
                              {item.hit && item.hit.segments.length > 0 ? (
                                <span className="block truncate text-caption text-content-subtle">
                                  {item.hit.segments.map((segment, part) => (
                                    <span
                                      className={
                                        segment.highlight
                                          ? 'rounded-small bg-warn-surface px-0.5 font-semibold text-content-strong'
                                          : undefined
                                      }
                                      key={`${item.key}-${part}`}
                                    >
                                      {segment.text}
                                    </span>
                                  ))}
                                </span>
                              ) : null}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-line-divider border-t px-3 py-2 text-caption text-content-subtle">
                <span>
                  <kbd className="rounded-small bg-surface-subtle px-1 py-0.5 font-sans">
                    ↑↓
                  </kbd>{' '}
                  {t('hintNavigate')}
                </span>
                <span>
                  <kbd className="rounded-small bg-surface-subtle px-1 py-0.5 font-sans">
                    ↵
                  </kbd>{' '}
                  {t('hintOpen')}
                </span>
                <span>
                  <kbd className="rounded-small bg-surface-subtle px-1 py-0.5 font-sans">
                    {alternateShortcutLabel(mac)}
                  </kbd>{' '}
                  {t('hintToggle')}
                </span>
                {pending ? <span className="ml-auto">{t('loading')}</span> : null}
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Dialog>
  )
}
