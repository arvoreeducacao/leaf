'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { CommandPalette } from '@/components/app/command-palette'
import { CommandPaletteTrigger } from '@/components/app/command-palette-trigger'
import { DocumentList } from '@/components/app/document-list'
import { DocumentTree } from '@/components/app/document-tree'
import { NewDatabaseButton } from '@/components/app/new-database-button'
import { NewDocumentButton } from '@/components/app/new-document-button'
import { OfflineBanner } from '@/components/app/offline-banner'
import { OfflineSync } from '@/components/app/offline-sync'
import { OrgSwitcher } from '@/components/app/org-switcher'
import type { OrganizationOption } from '@/components/app/org-switcher'
import { RecentDocuments } from '@/components/app/recent-documents'
import { SidebarOverflowLink } from '@/components/app/sidebar-overflow-link'
import { useSidebarPreferences } from '@/components/app/sidebar-preferences-provider'
import { SidebarSection } from '@/components/app/sidebar-section'
import { sidebarIcon, sidebarRow } from '@/components/app/sidebar-styles'
import { TeamspaceSections } from '@/components/app/teamspace-sections'
import { registerTopbarSlot } from '@/components/app/topbar-slot'
import { TrashSection } from '@/components/app/trash-section'
import { useSidebarWidth } from '@/components/app/use-sidebar-width'
import { UserMenu } from '@/components/app/user-menu'
import { HomeIcon, SidebarIcon } from '@/components/icons/outline'
import { ButtonIcon } from '@/components/ui/button-icon'
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
import type { DocumentNode, DocumentSummary } from '@/lib/documents'
import type { TeamspaceSection } from '@/lib/teamspaces'
import { cn } from '@/shared/utils'

type Props = Readonly<{
  user: { name: string; email: string }
  aiEnabled: boolean
  locale: string
  connectedAppsEnabled: boolean
  owned: Array<DocumentNode>
  organizationDocuments: Array<DocumentNode>
  hiddenOwnedDocuments: number
  hiddenOrganizationDocuments: number
  organizationName: string | null
  organizations: Array<OrganizationOption>
  activeOrgId: string | null
  teamspaces: Array<TeamspaceSection>
  recents: Array<DocumentSummary>
  shared: Array<DocumentSummary>
  trashed: Array<DocumentSummary>
  children: React.ReactNode
}>

function NavContent({
  owned,
  organizationDocuments,
  hiddenOwnedDocuments,
  hiddenOrganizationDocuments,
  organizationName,
  organizations,
  activeOrgId,
  teamspaces,
  recents,
  shared,
  trashed,
  user,
  locale,
  connectedAppsEnabled,
  onNavigate,
  headerAction,
}: Readonly<{
  owned: Array<DocumentNode>
  organizationDocuments: Array<DocumentNode>
  hiddenOwnedDocuments: number
  hiddenOrganizationDocuments: number
  organizationName: string | null
  organizations: Array<OrganizationOption>
  activeOrgId: string | null
  teamspaces: Array<TeamspaceSection>
  recents: Array<DocumentSummary>
  shared: Array<DocumentSummary>
  trashed: Array<DocumentSummary>
  user: { name: string; email: string }
  locale: string
  connectedAppsEnabled: boolean
  onNavigate?: () => void
  headerAction?: React.ReactNode
}>) {
  const t = useTranslations('nav')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 items-center gap-1 px-2 pt-2">
        {headerAction}
        <span className="flex-1" />
        <NewDatabaseButton variant="icon" />
        <NewDocumentButton variant="icon" />
      </div>

      <div className="mt-1 flex flex-col px-2">
        <CommandPaletteTrigger />
      </div>

      <div className="mt-1 flex flex-col px-2">
        <Link
          className={cn(sidebarRow, 'font-medium')}
          href="/"
          onClick={onNavigate}
        >
          <HomeIcon aria-hidden="true" className={sidebarIcon} />
          <span className="min-w-0 flex-1 truncate">{t('home')}</span>
        </Link>
      </div>

      <nav
        aria-label={t('documents')}
        className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 pb-2"
      >
        <SidebarSection collapseId="recents" title={t('recentsSection')}>
          <RecentDocuments
            documents={recents}
            hasOrganization={organizationName !== null}
            onNavigate={onNavigate}
          />
        </SidebarSection>

        <SidebarSection collapseId="private" title={t('privateSection')}>
          <DocumentTree
            emptyLabel={t('emptyPrivate')}
            hasOrganization={organizationName !== null}
            nodes={owned}
            onNavigate={onNavigate}
          />
          <SidebarOverflowLink
            hidden={hiddenOwnedDocuments}
            href="/documents?scope=private"
            onNavigate={onNavigate}
          />
          <NewDocumentButton variant="sidebar" />
        </SidebarSection>

        {organizationName ? (
          <TeamspaceSections
            canCreate={true}
            hasOrganization={organizationName !== null}
            onNavigate={onNavigate}
            teamspaces={teamspaces}
          />
        ) : null}

        {organizationName ? (
          <SidebarSection
            collapseId="organization"
            href="/org"
            onNavigate={onNavigate}
            title={t('organizationSection')}
          >
            <DocumentTree
              emptyLabel={t('emptyOrganization')}
              hasOrganization={organizationName !== null}
              nodes={organizationDocuments}
              onNavigate={onNavigate}
            />
            <SidebarOverflowLink
              hidden={hiddenOrganizationDocuments}
              href="/documents"
              onNavigate={onNavigate}
            />
          </SidebarSection>
        ) : null}

        {shared.length > 0 ? (
          <SidebarSection collapseId="shared" title={t('sharedWithMe')}>
            <DocumentList
              documents={shared}
              emptyLabel={t('emptyShared')}
              hasOrganization={organizationName !== null}
              onNavigate={onNavigate}
            />
          </SidebarSection>
        ) : null}
      </nav>

      <div className="flex flex-col gap-0.5 px-2 pt-1 pb-2">
        <TrashSection documents={trashed} />
        <div className="flex min-w-0 items-center gap-1">
          <div className="min-w-0 flex-1">
            <OrgSwitcher
              activeOrgId={activeOrgId}
              onNavigate={onNavigate}
              organizations={organizations}
            />
          </div>
          <UserMenu
            compact
            connectedAppsEnabled={connectedAppsEnabled}
            email={user.email}
            locale={locale}
            name={user.name}
          />
        </div>
      </div>
    </div>
  )
}

export function AppShell({
  user,
  aiEnabled,
  locale,
  connectedAppsEnabled,
  owned,
  organizationDocuments,
  hiddenOwnedDocuments,
  hiddenOrganizationDocuments,
  organizationName,
  organizations,
  activeOrgId,
  teamspaces,
  recents,
  shared,
  trashed,
  children,
}: Props) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const { preferences, update } = useSidebarPreferences()
  const { collapsed } = preferences
  const [mobileOpen, setMobileOpen] = useState(false)
  const {
    handleResizeKeyDown,
    maxWidth,
    minWidth,
    resetWidth,
    resizing,
    sidebarRef,
    startResize,
    width,
  } = useSidebarWidth()
  const collapseRef = useRef<HTMLButtonElement>(null)
  const expandRef = useRef<HTMLButtonElement>(null)
  const toggled = useRef(false)

  const topbarRef = useCallback((node: HTMLDivElement | null) => {
    registerTopbarSlot(node)

    return () => registerTopbarSlot(null)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!toggled.current) {
      return
    }

    const target = collapsed ? expandRef.current : collapseRef.current
    target?.focus()
  }, [collapsed])

  function toggleCollapsed(next: boolean) {
    toggled.current = true
    update({ collapsed: next })
  }

  return (
    <div className="flex min-h-dvh w-full bg-surface-app">
      <CommandPalette
        aiEnabled={aiEnabled}
        hasOrganization={organizationName !== null}
      />
      <OfflineSync />

      {collapsed ? null : (
        <aside
          aria-label={t('navigation')}
          className="group/sidebar relative hidden shrink-0 border-line border-r bg-surface-nav tablet:block"
          ref={sidebarRef}
          style={{ width }}
        >
          <div
            aria-label={t('resizeNavigation')}
            aria-orientation="vertical"
            aria-valuemax={maxWidth}
            aria-valuemin={minWidth}
            aria-valuenow={width}
            className={cn(
              'absolute inset-y-0 -right-1 z-30 w-2 cursor-col-resize touch-none',
              "after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:bg-transparent after:transition-colors after:content-[''] hover:after:bg-line-contrast",
              'focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-0',
              resizing && 'after:bg-line-contrast',
            )}
            onDoubleClick={resetWidth}
            onKeyDown={handleResizeKeyDown}
            onPointerDown={startResize}
            role="separator"
            tabIndex={0}
          />
          <div className="sticky top-0 h-dvh">
            <NavContent
              connectedAppsEnabled={connectedAppsEnabled}
              activeOrgId={activeOrgId}
              headerAction={
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ButtonIcon
                      aria-label={t('collapseNavigation')}
                      onClick={() => toggleCollapsed(true)}
                      ref={collapseRef}
                      size="medium"
                      variant="ghost"
                    >
                      <SidebarIcon aria-hidden="true" />
                    </ButtonIcon>
                  </TooltipTrigger>
                  <TooltipContent>{t('collapse')}</TooltipContent>
                </Tooltip>
              }
              locale={locale}
              hiddenOrganizationDocuments={hiddenOrganizationDocuments}
              hiddenOwnedDocuments={hiddenOwnedDocuments}
              organizationDocuments={organizationDocuments}
              organizationName={organizationName}
              organizations={organizations}
              owned={owned}
              recents={recents}
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
              <SidebarIcon aria-hidden="true" />
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
                    <SidebarIcon aria-hidden="true" />
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

          <OfflineBanner />
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
            hiddenOrganizationDocuments={hiddenOrganizationDocuments}
            hiddenOwnedDocuments={hiddenOwnedDocuments}
            organizationDocuments={organizationDocuments}
            organizationName={organizationName}
            organizations={organizations}
            owned={owned}
            recents={recents}
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
