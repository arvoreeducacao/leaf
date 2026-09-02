'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { DocumentTree } from '@/components/app/document-tree'
import {
  SidebarCollapseMarker,
  SidebarSection,
} from '@/components/app/sidebar-section'
import { sidebarHeading } from '@/components/app/sidebar-styles'
import { TeamspaceFormDialog } from '@/components/app/teamspace-form-dialog'
import { useSidebarCollapse } from '@/components/app/use-sidebar-collapse'
import { AddIcon, PadlockIcon, UsersIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { ButtonIcon } from '@/components/ui/button-icon'
import type { TeamspaceSection } from '@/lib/teamspaces'
import { joinTeamspace } from '@/lib/teamspace-actions'
import { cn } from '@/shared/utils'

type Props = Readonly<{
  teamspaces: ReadonlyArray<TeamspaceSection>
  canCreate: boolean
  hasOrganization: boolean
  onNavigate?: () => void
}>

export function TeamspaceSections({
  teamspaces,
  canCreate,
  hasOrganization,
  onNavigate,
}: Props) {
  const t = useTranslations('teamspace')
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [pending, startTransition] = useTransition()

  if (!canCreate && teamspaces.length === 0) {
    return null
  }

  function handleJoin(teamspaceId: string) {
    startTransition(async () => {
      const result = await joinTeamspace(teamspaceId)

      if (!result.ok) {
        toast.error(result.error)

        return
      }

      toast.success(t('joined'))
      router.refresh()
    })
  }

  return (
    <SidebarSection
      action={
        canCreate ? (
          <ButtonIcon
            aria-label={t('createTitle')}
            data-testid="create-teamspace"
            onClick={() => setCreating(true)}
            size="small"
            variant="ghost"
          >
            <AddIcon aria-hidden="true" />
          </ButtonIcon>
        ) : null
      }
      collapseId="teamspaces"
      title={t('sectionTitle')}
    >
      {teamspaces.length === 0 ? (
        <p className="px-1.5 py-1 text-body-small text-content-disabled">
          {t('sectionEmpty')}
        </p>
      ) : null}

      {teamspaces.map((teamspace) => (
        <TeamspaceGroup
          hasOrganization={hasOrganization}
          key={teamspace.id}
          onJoin={handleJoin}
          onNavigate={onNavigate}
          pending={pending}
          teamspace={teamspace}
        />
      ))}

      {canCreate ? (
        <TeamspaceFormDialog onOpenChange={setCreating} open={creating} />
      ) : null}
    </SidebarSection>
  )
}

function TeamspaceGroup({
  teamspace,
  hasOrganization,
  pending,
  onJoin,
  onNavigate,
}: Readonly<{
  teamspace: TeamspaceSection
  hasOrganization: boolean
  pending: boolean
  onJoin: (teamspaceId: string) => void
  onNavigate?: () => void
}>) {
  const t = useTranslations('teamspace')
  const contentId = useId()
  const { collapsed, toggle } = useSidebarCollapse(`teamspace:${teamspace.id}`)
  const AccessIcon = teamspace.access === 'closed' ? PadlockIcon : UsersIcon

  return (
    <div className="group/teamspace flex flex-col">
      <div className="flex items-center gap-0.5">
        <h3 className="min-w-0 flex-1">
          <button
            aria-controls={contentId}
            aria-expanded={!collapsed}
            className={cn(
              sidebarHeading,
              'w-full cursor-pointer text-left transition-colors hover:bg-surface-hover hover:text-content focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1',
            )}
            onClick={toggle}
            type="button"
          >
            <SidebarCollapseMarker
              collapsed={collapsed}
              groupName="teamspace"
              icon={AccessIcon}
            />
            <span className="min-w-0 flex-1 truncate font-medium">
              {teamspace.name}
            </span>
            <span className="sr-only">
              {teamspace.access === 'closed'
                ? t('accessClosed')
                : t('accessOpen')}
            </span>
          </button>
        </h3>
        {teamspace.role === null ? (
          <Button
            className="h-6 px-1.5 text-caption tablet:opacity-0 tablet:group-focus-within/teamspace:opacity-100 tablet:group-hover/teamspace:opacity-100"
            disabled={pending}
            onClick={() => onJoin(teamspace.id)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {t('join')}
          </Button>
        ) : null}
      </div>

      <div hidden={collapsed} id={contentId}>
        <DocumentTree
          emptyLabel={t('empty')}
          hasOrganization={hasOrganization}
          nodes={teamspace.documents}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  )
}
