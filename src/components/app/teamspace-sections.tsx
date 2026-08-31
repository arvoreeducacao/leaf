'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { DocumentTree } from '@/components/app/document-tree'
import { TeamspaceFormDialog } from '@/components/app/teamspace-form-dialog'
import { AddIcon, PadlockIcon, UsersIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { ButtonIcon } from '@/components/ui/button-icon'
import type { TeamspaceSection } from '@/lib/teamspaces'
import { joinTeamspace } from '@/lib/teamspace-actions'

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
    <section className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <h2 className="font-bold text-caption text-content uppercase tracking-wide">
          {t('sectionTitle')}
        </h2>
        {canCreate ? (
          <ButtonIcon
            aria-label={t('createTitle')}
            data-testid="create-teamspace"
            onClick={() => setCreating(true)}
            size="medium"
            variant="ghost"
          >
            <AddIcon aria-hidden="true" />
          </ButtonIcon>
        ) : null}
      </div>

      {teamspaces.length === 0 ? (
        <p className="px-3 py-2 text-body-small text-content">
          {t('sectionEmpty')}
        </p>
      ) : null}

      {teamspaces.map((teamspace) => (
        <div className="flex flex-col gap-1" key={teamspace.id}>
          <div className="flex items-center gap-2 px-3 py-1">
            {teamspace.access === 'closed' ? (
              <PadlockIcon
                aria-label={t('accessClosed')}
                className="size-4 shrink-0 text-content"
                role="img"
              />
            ) : (
              <UsersIcon
                aria-label={t('accessOpen')}
                className="size-4 shrink-0 text-content"
                role="img"
              />
            )}
            <h3 className="min-w-0 flex-1 truncate font-bold text-body-small text-content-strong">
              {teamspace.name}
            </h3>
            {teamspace.role === null ? (
              <Button
                className="min-h-11"
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
    </section>
  )
}
