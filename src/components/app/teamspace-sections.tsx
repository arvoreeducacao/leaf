'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { DocumentTree } from '@/components/app/document-tree'
import { SidebarSection } from '@/components/app/sidebar-section'
import { sidebarHeading } from '@/components/app/sidebar-styles'
import { TeamspaceFormDialog } from '@/components/app/teamspace-form-dialog'
import { AddIcon, PadlockIcon, UsersIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { ButtonIcon } from '@/components/ui/button-icon'
import type { TeamspaceSection } from '@/lib/teamspaces'
import { joinTeamspace } from '@/lib/teamspace-actions'
import { cn } from '@/shared/utils'

type Props = Readonly<{
  teamspaces: ReadonlyArray<TeamspaceSection>
  canCreate: boolean
  onNavigate?: () => void
}>

export function TeamspaceSections({ teamspaces, canCreate, onNavigate }: Props) {
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
      title={t('sectionTitle')}
    >
      {teamspaces.length === 0 ? (
        <p className="px-1.5 py-1 text-body-small text-content-disabled">
          {t('sectionEmpty')}
        </p>
      ) : null}

      {teamspaces.map((teamspace) => (
        <div className="group/teamspace flex flex-col" key={teamspace.id}>
          <div className={cn(sidebarHeading, 'gap-1.5 text-content')}>
            {teamspace.access === 'closed' ? (
              <PadlockIcon
                aria-label={t('accessClosed')}
                className="size-3.5 shrink-0"
                role="img"
              />
            ) : (
              <UsersIcon
                aria-label={t('accessOpen')}
                className="size-3.5 shrink-0"
                role="img"
              />
            )}
            <h3 className="min-w-0 flex-1 truncate font-medium">
              {teamspace.name}
            </h3>
            {teamspace.role === null ? (
              <Button
                className="h-6 px-1.5 text-caption tablet:opacity-0 tablet:group-focus-within/teamspace:opacity-100 tablet:group-hover/teamspace:opacity-100"
                disabled={pending}
                onClick={() => handleJoin(teamspace.id)}
                size="sm"
                type="button"
                variant="ghost"
              >
                {t('join')}
              </Button>
            ) : null}
          </div>

          <DocumentTree
            emptyLabel={t('empty')}
            nodes={teamspace.documents}
            onNavigate={onNavigate}
          />
        </div>
      ))}

      {canCreate ? (
        <TeamspaceFormDialog onOpenChange={setCreating} open={creating} />
      ) : null}
    </SidebarSection>
  )
}
