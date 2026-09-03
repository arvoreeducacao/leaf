'use client'

import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import { CommandPalette } from '@/components/app/command-palette'
import { CommandPaletteTrigger } from '@/components/app/command-palette-trigger'
import { DocumentList } from '@/components/app/document-list'
import { DocumentSearchResults } from '@/components/app/document-search-results'
import { DocumentTree } from '@/components/app/document-tree'
import { NewDatabaseButton } from '@/components/app/new-database-button'
import { NewDocumentButton } from '@/components/app/new-document-button'
import { OrgSwitcher } from '@/components/app/org-switcher'
import type { OrganizationOption } from '@/components/app/org-switcher'
import { SidebarSection } from '@/components/app/sidebar-section'
import { TeamspaceSections } from '@/components/app/teamspace-sections'
import { registerTopbarSlot } from '@/components/app/topbar-slot'
import { TrashSection } from '@/components/app/trash-section'
import { UserMenu } from '@/components/app/user-menu'
import {
  CaretLeftIcon,
  CaretRightIcon,
  MenuIcon,
  TeamIcon,
} from '@/components/icons'
import { ButtonIcon } from '@/components/ui/button-icon'
import { Search } from '@/components/ui/search'
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
import type { TeamspaceSection } from '@/lib/teamspaces'
import { readStoredValue, writeStoredValue } from '@/shared/storage'
import { cn } from '@/shared/utils'

const collapsedStorageKey = 'leaf:sidebar-collapsed'

type Props = Readonly<{
  user: { name: string; email: string }
  locale: string
  connectedAppsEnabled: boolean
  owned: Array<DocumentNode>
  organizationDocuments: Array<DocumentNode>
  organizationName: string | null
  organizations: Array<OrganizationOption>
  activeOrgId: string | null
  teamspaces: Array<TeamspaceSection>
  shared: Array<DocumentSummary>
  trashed: Array<DocumentSummary>
  children: React.ReactNode
}>

function NavContent({
  owned,
  organizationDocuments,
  organizationName,
  organizations,
  activeOrgId,
  teamspaces,
  shared,
  trashed,
  user,
  locale,
  connectedAppsEnabled,
  onNavigate,
  searchRef,
  headerAction,
}: Readonly<{
  owned: Array<DocumentNode>
  organizationDocuments: Array<DocumentNode>
  organizationName: string | null
  organizations: Array<OrganizationOption>
  activeOrgId: string | null
  teamspaces: Array<TeamspaceSection>
  shared: Array<DocumentSummary>
  trashed: Array<DocumentSummary>
  user: { name: string; email: string }
  locale: string
  connectedAppsEnabled: boolean
  onNavigate?: () => void
  searchRef?: React.RefObject<HTMLInputElement | null>
  headerAction?: React.ReactNode
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
      ...teamspaces.flatMap((teamspace) =>
        searchDocumentTree(teamspace.documents, term),
      ),
      ...searchDocumentTree(organizationDocuments, term),
      ...searchDocumentTree(owned, term),
      ...searchDocumentList(shared, term),
    ]
  }, [organizationDocuments, owned, shared, teamspaces, term])

  const searchStatus =
    term.length === 0
      ? ''
      : matches.length === 0
        ? t('searchEmpty')
        : t('searchCount', { count: matches.length })

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 px-2 pt-2">
        <OrgSwitcher
          activeOrgId={activeOrgId}
          onNavigate={onNavigate}
          organizations={organizations}
        />
        {headerAction}
      </div>

      <div className="mt-1 flex flex-col px-2">
        <CommandPaletteTrigger />
        <NewDocumentButton />
        <NewDatabaseButton />
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
        className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 pb-2"
      >
        {term.length > 0 ? (
          <SidebarSection title={t('searchResults')}>
            <DocumentSearchResults matches={matches} onNavigate={onNavigate} />
          </SidebarSection>
        ) : (
          <>
            {organizationName ? (
              <TeamspaceSections
                canCreate={true}
                onNavigate={onNavigate}
                teamspaces={teamspaces}
              />
            ) : null}

            {organizationName ? (
              <SidebarSection
                href="/org"
                icon={TeamIcon}
                onNavigate={onNavigate}
                title={t('organizationSection')}
              >
                <DocumentTree
                  emptyLabel={t('emptyOrganization')}
                  nodes={organizationDocuments}
                  onNavigate={onNavigate}
                />
              </SidebarSection>
            ) : null}

            {shared.length > 0 ? (
              <SidebarSection title={t('sharedWithMe')}>
                <DocumentList
                  documents={shared}
                  emptyLabel={t('emptyShared')}
                  onNavigate={onNavigate}
                />
              </SidebarSection>
            ) : null}

            <SidebarSection title={t('privateSection')}>
              <DocumentTree
                emptyLabel={t('emptyPrivate')}
                nodes={owned}
                onNavigate={onNavigate}
              />
            </SidebarSection>
          </>
        )}
      </nav>

      <div className="flex flex-col gap-0.5 px-2 pt-1 pb-2">
        <TrashSection documents={trashed} />
        <UserMenu
          connectedAppsEnabled={connectedAppsEnabled}
          email={user.email}
          locale={locale}
          name={user.name}
        />
      </div>
    </div>
  )
}

export function AppShell({
  user,
  locale,
  connectedAppsEnabled,
  owned,
  organizationDocuments,
  organizationName,
  organizations,
  activeOrgId,
  teamspaces,
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

  const topbarRef = useCallback((node: HTMLDivElement | null) => {
    registerTopbarSlot(node)

    return () => registerTopbarSlot(null)
  }, [])

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
      <CommandPalette hasOrganization={organizationName !== null} />

      {collapsed ? null : (
        <aside
          aria-label={t('navigation')}
          className="group/sidebar hidden w-sidebar shrink-0 bg-surface-nav tablet:block"
        >
          <div className="sticky top-0 h-dvh">
            <NavContent
              connectedAppsEnabled={connectedAppsEnabled}
              activeOrgId={activeOrgId}
              headerAction={
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ButtonIcon
                      aria-label={t('collapseNavigation')}
                      className="opacity-0 transition-opacity group-hover/sidebar:opacity-100 focus-visible:opacity-100"
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
              }
              locale={locale}
              organizationDocuments={organizationDocuments}
              organizationName={organizationName}
              organizations={organizations}
              owned={owned}
              searchRef={desktopSearchRef}
              shared={shared}
              teamspaces={teamspaces}
              trashed={trashed}
              user={user}
            />
          </div>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            'sticky top-0 z-20 flex min-h-11 flex-wrap items-center gap-1 bg-surface-app px-3 py-1.5',
          )}
        >
          <div className="tablet:hidden">
            <ButtonIcon
              aria-label={t('openNavigation')}
              onClick={() => setMobileOpen(true)}
              size="medium"
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
                    size="medium"
                    variant="ghost"
                  >
                    <CaretRightIcon aria-hidden="true" />
                  </ButtonIcon>
                </TooltipTrigger>
                <TooltipContent>{t('expand')}</TooltipContent>
              </Tooltip>
            </div>
          ) : null}

          <div
            className="flex min-w-0 flex-1 flex-wrap items-center gap-1"
            ref={topbarRef}
          />
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <Sheet onOpenChange={setMobileOpen} open={mobileOpen}>
        <SheetContent
          className="w-[86vw] max-w-80 bg-surface-nav p-0 tablet:w-sidebar"
          side="left"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Leaf</SheetTitle>
            <SheetDescription>{t('mobileDescription')}</SheetDescription>
          </SheetHeader>
          <NavContent
              connectedAppsEnabled={connectedAppsEnabled}
            activeOrgId={activeOrgId}
            locale={locale}
            onNavigate={() => setMobileOpen(false)}
            organizationDocuments={organizationDocuments}
            organizationName={organizationName}
            organizations={organizations}
            owned={owned}
            searchRef={mobileSearchRef}
            shared={shared}
            teamspaces={teamspaces}
            trashed={trashed}
            user={user}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}
