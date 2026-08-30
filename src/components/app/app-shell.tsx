'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { DocumentList } from '@/components/app/document-list'
import { DocumentSearchResults } from '@/components/app/document-search-results'
import { DocumentTree } from '@/components/app/document-tree'
import { NewDocumentButton } from '@/components/app/new-document-button'
import { TrashSection } from '@/components/app/trash-section'
import { UserMenu } from '@/components/app/user-menu'
import {
  CaretLeftIcon,
  CaretRightIcon,
  LeafIcon,
  MenuIcon,
  TeamIcon,
} from '@/components/icons'
import { ButtonIcon } from '@/components/ui/button-icon'
import { Search } from '@/components/ui/search'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { searchDocumentList, searchDocumentTree } from '@/lib/document-search'
import type { DocumentNode, DocumentSummary } from '@/lib/documents'
import { readStoredValue, writeStoredValue } from '@/shared/storage'
import { cn } from '@/shared/utils'

const collapsedStorageKey = 'leaf:sidebar-collapsed'

type Props = Readonly<{
  user: { name: string; email: string }
  locale: string
  owned: Array<DocumentNode>
  organizationDocuments: Array<DocumentNode>
  organizationName: string | null
  shared: Array<DocumentSummary>
  trashed: Array<DocumentSummary>
  children: React.ReactNode
}>

function NavContent({
  owned,
  organizationDocuments,
  organizationName,
  shared,
  trashed,
  user,
  locale,
  onNavigate,
  searchRef,
}: Readonly<{
  owned: Array<DocumentNode>
  organizationDocuments: Array<DocumentNode>
  organizationName: string | null
  shared: Array<DocumentSummary>
  trashed: Array<DocumentSummary>
  user: { name: string; email: string }
  locale: string
  onNavigate?: () => void
  searchRef?: React.RefObject<HTMLInputElement | null>
}>) {
  const t = useTranslations('nav')
  const searchId = useId()
  const [query, setQuery] = useState('')
  const term = query.trim()

  const matches = useMemo(() => {
    if (term.length === 0) {
      return []
    }

    return [
      ...searchDocumentTree(organizationDocuments, term),
      ...searchDocumentTree(owned, term),
      ...searchDocumentList(shared, term),
    ]
  }, [organizationDocuments, owned, shared, term])

  const searchStatus =
    term.length === 0
      ? ''
      : matches.length === 0
        ? t('searchEmpty')
        : t('searchCount', { count: matches.length })

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4">
      <NewDocumentButton />

      <Separator />

      <div>
        <label className="sr-only" htmlFor={searchId}>
          {t('searchLabel')}
        </label>
        <Search
          aria-keyshortcuts="Meta+P Control+P"
          id={searchId}
          onChange={(event) => setQuery(event.target.value)}
          onClear={() => {
            setQuery('')
            searchRef?.current?.focus()
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || query.length === 0) {
              return
            }

            event.stopPropagation()
            setQuery('')
          }}
          placeholder={t('searchPlaceholder')}
          ref={searchRef}
          value={query}
        />
      </div>

      <span aria-live="polite" className="sr-only" role="status">
        {searchStatus}
      </span>

      <nav
        aria-label={t('documents')}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
      >
        {term.length > 0 ? (
          <section className="flex flex-col gap-1">
            <h2 className="px-3 py-2 font-bold text-caption text-content uppercase tracking-wide">
              {t('searchResults')}
            </h2>
            <DocumentSearchResults matches={matches} onNavigate={onNavigate} />
          </section>
        ) : (
          <>
            {organizationName ? (
              <section className="flex flex-col gap-1">
                <h2 className="flex items-center gap-2 px-3 py-2 font-bold text-caption text-content uppercase tracking-wide">
                  <TeamIcon aria-hidden="true" className="size-4 shrink-0" />
                  {t('organizationSection')}
                </h2>
                <DocumentTree
                  emptyLabel={t('emptyOrganization')}
                  nodes={organizationDocuments}
                  onNavigate={onNavigate}
                />
              </section>
            ) : null}

            {shared.length > 0 ? (
              <section className="flex flex-col gap-1">
                <h2 className="px-3 py-2 font-bold text-caption text-content uppercase tracking-wide">
                  {t('sharedWithMe')}
                </h2>
                <DocumentList
                  documents={shared}
                  emptyLabel={t('emptyShared')}
                  onNavigate={onNavigate}
                />
              </section>
            ) : null}

            <section className="flex flex-col gap-1">
              <h2 className="px-3 py-2 font-bold text-caption text-content uppercase tracking-wide">
                {t('privateSection')}
              </h2>
              <DocumentTree
                emptyLabel={t('emptyPrivate')}
                nodes={owned}
                onNavigate={onNavigate}
              />
            </section>

            <TrashSection documents={trashed} />
          </>
        )}
      </nav>

      <Separator />

      <UserMenu email={user.email} locale={locale} name={user.name} />
    </div>
  )
}

export function AppShell({
  user,
  locale,
  owned,
  organizationDocuments,
  organizationName,
  shared,
  trashed,
  children,
}: Props) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const collapseRef = useRef<HTMLButtonElement>(null)
  const expandRef = useRef<HTMLButtonElement>(null)
  const desktopSearchRef = useRef<HTMLInputElement>(null)
  const mobileSearchRef = useRef<HTMLInputElement>(null)
  const toggled = useRef(false)
  const focusSearch = useRef(false)

  useEffect(() => {
    setCollapsed(readStoredValue(collapsedStorageKey, false))
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!toggled.current) {
      return
    }

    if (focusSearch.current) {
      focusSearch.current = false
      desktopSearchRef.current?.focus()

      return
    }

    const target = collapsed ? expandRef.current : collapseRef.current
    target?.focus()
  }, [collapsed])

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'p') {
        return
      }

      event.preventDefault()

      if (window.matchMedia('(max-width: 767px)').matches) {
        setMobileOpen(true)
        window.setTimeout(() => mobileSearchRef.current?.focus(), 0)

        return
      }

      if (collapsed) {
        focusSearch.current = true
        toggled.current = true
        setCollapsed(false)
        writeStoredValue(collapsedStorageKey, false)

        return
      }

      desktopSearchRef.current?.focus()
    }

    window.addEventListener('keydown', handleShortcut)

    return () => {
      window.removeEventListener('keydown', handleShortcut)
    }
  }, [collapsed])

  function toggleCollapsed(next: boolean) {
    toggled.current = true
    setCollapsed(next)
    writeStoredValue(collapsedStorageKey, next)
  }

  return (
    <div className="flex min-h-dvh w-full bg-surface-app">
      {collapsed ? null : (
        <aside
          aria-label={t('navigation')}
          className="hidden w-70 shrink-0 border-line border-r bg-surface-nav tablet:block"
        >
          <div className="sticky top-0 flex h-dvh flex-col">
            <div className="flex items-center justify-between gap-2 px-4 pt-4">
              <Link
                className="flex items-center gap-2 rounded-large focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                href="/"
              >
                <LeafIcon aria-hidden="true" className="size-5 text-brand" />
                <span className="font-bold text-body-medium text-content-strong">
                  Leaf
                </span>
              </Link>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ButtonIcon
                    aria-label={t('collapseNavigation')}
                    onClick={() => toggleCollapsed(true)}
                    ref={collapseRef}
                    size="medium"
                    variant="ghost"
                  >
                    <CaretLeftIcon aria-hidden="true" />
                  </ButtonIcon>
                </TooltipTrigger>
                <TooltipContent>{t('collapse')}</TooltipContent>
              </Tooltip>
            </div>
            <NavContent
              locale={locale}
              organizationDocuments={organizationDocuments}
              organizationName={organizationName}
              owned={owned}
              searchRef={desktopSearchRef}
              shared={shared}
              trashed={trashed}
              user={user}
            />
          </div>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            'sticky top-0 z-10 flex items-center gap-2 border-line border-b bg-surface-app px-4 py-3',
            collapsed ? '' : 'tablet:hidden',
          )}
        >
          <div className="tablet:hidden">
            <ButtonIcon
              aria-label={t('openNavigation')}
              onClick={() => setMobileOpen(true)}
              size="large"
              variant="ghost"
            >
              <MenuIcon aria-hidden="true" />
            </ButtonIcon>
          </div>

          {collapsed ? (
            <div className="hidden tablet:block">
              <Tooltip>
                <TooltipTrigger asChild>
                  <ButtonIcon
                    aria-label={t('expandNavigation')}
                    onClick={() => toggleCollapsed(false)}
                    ref={expandRef}
                    size="large"
                    variant="ghost"
                  >
                    <CaretRightIcon aria-hidden="true" />
                  </ButtonIcon>
                </TooltipTrigger>
                <TooltipContent>{t('expand')}</TooltipContent>
              </Tooltip>
            </div>
          ) : null}

          <Link
            className="flex items-center gap-2 rounded-large focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
            href="/"
          >
            <LeafIcon aria-hidden="true" className="size-5 text-brand" />
            <span className="font-bold text-body-medium text-content-strong">
              Leaf
            </span>
          </Link>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <Sheet onOpenChange={setMobileOpen} open={mobileOpen}>
        <SheetContent className="w-70 bg-surface-nav p-0" side="left">
          <SheetHeader className="px-4 pt-4 pb-0">
            <SheetTitle className="flex items-center gap-2">
              <LeafIcon aria-hidden="true" className="size-5 text-brand" />
              Leaf
            </SheetTitle>
            <SheetDescription className="sr-only">
              {t('mobileDescription')}
            </SheetDescription>
          </SheetHeader>
          <NavContent
            locale={locale}
            onNavigate={() => setMobileOpen(false)}
            organizationDocuments={organizationDocuments}
            organizationName={organizationName}
            owned={owned}
            searchRef={mobileSearchRef}
            shared={shared}
            trashed={trashed}
            user={user}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}
