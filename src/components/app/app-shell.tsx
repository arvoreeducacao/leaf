'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { DocumentList } from '@/components/app/document-list'
import { DocumentSearchResults } from '@/components/app/document-search-results'
import { DocumentTree } from '@/components/app/document-tree'
import { ImportButton } from '@/components/app/import-button'
import { NewDocumentButton } from '@/components/app/new-document-button'
import { TrashSection } from '@/components/app/trash-section'
import { UserMenu } from '@/components/app/user-menu'
import { CaretLeftIcon, CaretRightIcon, LeafIcon, MenuIcon } from '@/components/icons'
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
  owned: Array<DocumentNode>
  shared: Array<DocumentSummary>
  trashed: Array<DocumentSummary>
  children: React.ReactNode
}>

function NavContent({
  owned,
  shared,
  trashed,
  user,
  onNavigate,
  searchRef,
}: Readonly<{
  owned: Array<DocumentNode>
  shared: Array<DocumentSummary>
  trashed: Array<DocumentSummary>
  user: { name: string; email: string }
  onNavigate?: () => void
  searchRef?: React.RefObject<HTMLInputElement | null>
}>) {
  const searchId = useId()
  const [query, setQuery] = useState('')
  const term = query.trim()

  const matches = useMemo(() => {
    if (term.length === 0) {
      return []
    }

    return [
      ...searchDocumentTree(owned, term),
      ...searchDocumentList(shared, term),
    ]
  }, [owned, shared, term])

  const searchStatus =
    term.length === 0
      ? ''
      : matches.length === 0
        ? 'Nenhum documento com esse nome'
        : `${matches.length} ${matches.length === 1 ? 'documento encontrado' : 'documentos encontrados'}`

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <NewDocumentButton />
        <ImportButton />
      </div>

      <Separator />

      <div>
        <label className="sr-only" htmlFor={searchId}>
          Buscar documento pelo título
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
          placeholder="Buscar documento"
          ref={searchRef}
          value={query}
        />
      </div>

      <span aria-live="polite" className="sr-only" role="status">
        {searchStatus}
      </span>

      <nav
        aria-label="Documentos"
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
      >
        {term.length > 0 ? (
          <section className="flex flex-col gap-1">
            <h2 className="px-3 py-2 font-bold text-caption text-gray-700 uppercase tracking-wide">
              Resultados da busca
            </h2>
            <DocumentSearchResults matches={matches} onNavigate={onNavigate} />
          </section>
        ) : (
          <>
            <section className="flex flex-col gap-1">
              <h2 className="px-3 py-2 font-bold text-caption text-gray-700 uppercase tracking-wide">
                Meus documentos
              </h2>
              <DocumentTree
                emptyLabel="Nenhum documento ainda"
                nodes={owned}
                onNavigate={onNavigate}
              />
            </section>

            {shared.length > 0 ? (
              <section className="flex flex-col gap-1">
                <h2 className="px-3 py-2 font-bold text-caption text-gray-700 uppercase tracking-wide">
                  Compartilhados comigo
                </h2>
                <DocumentList
                  documents={shared}
                  emptyLabel="Nada compartilhado com você"
                  onNavigate={onNavigate}
                />
              </section>
            ) : null}

            <TrashSection documents={trashed} />
          </>
        )}
      </nav>

      <Separator />

      <UserMenu email={user.email} name={user.name} />
    </div>
  )
}

export function AppShell({ user, owned, shared, trashed, children }: Props) {
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
    <div className="flex min-h-dvh w-full bg-white">
      {collapsed ? null : (
        <aside
          aria-label="Navegação"
          className="hidden w-70 shrink-0 border-alpha-200 border-r bg-gray-50 tablet:block"
        >
          <div className="sticky top-0 flex h-dvh flex-col">
            <div className="flex items-center justify-between gap-2 px-4 pt-4">
              <Link
                className="flex items-center gap-2 rounded-large focus-visible:outline-2 focus-visible:outline-gray-900 focus-visible:outline-offset-2"
                href="/"
              >
                <LeafIcon aria-hidden="true" className="size-5 text-primary-700" />
                <span className="font-bold text-body-medium text-gray-900">
                  Leaf
                </span>
              </Link>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ButtonIcon
                    aria-label="Recolher navegação"
                    onClick={() => toggleCollapsed(true)}
                    ref={collapseRef}
                    size="medium"
                    variant="ghost"
                  >
                    <CaretLeftIcon aria-hidden="true" />
                  </ButtonIcon>
                </TooltipTrigger>
                <TooltipContent>Recolher</TooltipContent>
              </Tooltip>
            </div>
            <NavContent
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
            'sticky top-0 z-10 flex items-center gap-2 border-alpha-200 border-b bg-white px-4 py-3',
            collapsed ? '' : 'tablet:hidden',
          )}
        >
          <div className="tablet:hidden">
            <ButtonIcon
              aria-label="Abrir navegação"
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
                    aria-label="Expandir navegação"
                    onClick={() => toggleCollapsed(false)}
                    ref={expandRef}
                    size="large"
                    variant="ghost"
                  >
                    <CaretRightIcon aria-hidden="true" />
                  </ButtonIcon>
                </TooltipTrigger>
                <TooltipContent>Expandir</TooltipContent>
              </Tooltip>
            </div>
          ) : null}

          <Link
            className="flex items-center gap-2 rounded-large focus-visible:outline-2 focus-visible:outline-gray-900 focus-visible:outline-offset-2"
            href="/"
          >
            <LeafIcon aria-hidden="true" className="size-5 text-primary-700" />
            <span className="font-bold text-body-medium text-gray-900">
              Leaf
            </span>
          </Link>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <Sheet onOpenChange={setMobileOpen} open={mobileOpen}>
        <SheetContent className="w-70 bg-gray-50 p-0" side="left">
          <SheetHeader className="px-4 pt-4 pb-0">
            <SheetTitle className="flex items-center gap-2">
              <LeafIcon aria-hidden="true" className="size-5 text-primary-700" />
              Leaf
            </SheetTitle>
            <SheetDescription className="sr-only">
              Lista de documentos, lixeira e conta
            </SheetDescription>
          </SheetHeader>
          <NavContent
            onNavigate={() => setMobileOpen(false)}
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
