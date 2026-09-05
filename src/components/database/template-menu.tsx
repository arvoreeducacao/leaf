'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { DocumentIcon } from '@/components/app/document-icon'
import {
  AddIcon,
  EditIcon,
  EllipsisVerticalIcon,
  FlagIcon,
  StackIcon,
  TrashIcon,
} from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import {
  createDatabaseTemplate,
  deleteDatabaseTemplate,
  duplicateDatabaseTemplate,
  setDefaultDatabaseTemplate,
} from '@/lib/database-actions'
import type { DatabaseRow } from '@/lib/database/views'

type Props = Readonly<{
  databaseId: string
  databaseTitle: string
  templates: ReadonlyArray<DatabaseRow>
  defaultTemplateId: string | null
  onUseTemplate: (templateId: string) => void
}>

export function TemplateMenu({
  databaseId,
  databaseTitle,
  templates,
  defaultTemplateId,
  onUseTemplate,
}: Props) {
  const t = useTranslations('database')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [openActionsFor, setOpenActionsFor] = useState<string | null>(null)

  const run = (
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    after?: () => void,
  ) => {
    startTransition(async () => {
      const result = await action()

      if (!result.ok) {
        toast.error(result.error)

        return
      }

      after?.()
      router.refresh()
    })
  }

  return (
    <DropdownMenuContent align="end" className="w-80">
      <DropdownMenuLabel>
        {t('templates', { title: databaseTitle })}
      </DropdownMenuLabel>
      {templates.length === 0 ? (
        <p className="px-2 pb-2 text-body-small text-content-subtle">
          {t('templatesEmpty')}
        </p>
      ) : (
        templates.map((template) => (
          <div className="flex items-center gap-0.5 pr-1" key={template.id}>
            <DropdownMenuItem
              className="min-w-0 flex-1"
              disabled={pending}
              onSelect={() => onUseTemplate(template.id)}
            >
              <DocumentIcon
                className="size-4 shrink-0 text-content-subtle"
                icon={template.icon}
              />
              <span className="truncate">{template.title}</span>
              {template.id === defaultTemplateId ? (
                <Badge className="ml-auto shrink-0">
                  {t('templateDefault')}
                </Badge>
              ) : null}
            </DropdownMenuItem>
            <DropdownMenuSub
              onOpenChange={(open) =>
                setOpenActionsFor(open ? template.id : null)
              }
              open={openActionsFor === template.id}
            >
              <DropdownMenuSubTrigger
                aria-label={t('templateMenu', { title: template.title })}
                className="w-7 shrink-0 justify-center px-0 [&>svg:last-child]:hidden"
                onClick={() => setOpenActionsFor(template.id)}
              >
                <EllipsisVerticalIcon
                  aria-hidden="true"
                  className="size-4 text-content-subtle"
                />
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  onSelect={() => router.push(`/doc/${template.id}`)}
                >
                  <EditIcon aria-hidden="true" />
                  {t('editTemplate')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={pending}
                  onSelect={() =>
                    run(() =>
                      setDefaultDatabaseTemplate(
                        databaseId,
                        template.id === defaultTemplateId ? null : template.id,
                      ),
                    )
                  }
                >
                  <FlagIcon aria-hidden="true" />
                  {template.id === defaultTemplateId
                    ? t('unsetDefaultTemplate')
                    : t('setDefaultTemplate')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={pending}
                  onSelect={() =>
                    run(() => duplicateDatabaseTemplate(template.id))
                  }
                >
                  <StackIcon aria-hidden="true" />
                  {t('duplicateTemplate')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={pending}
                  onSelect={() =>
                    run(
                      () => deleteDatabaseTemplate(template.id),
                      () => toast.success(t('templateDeleted')),
                    )
                  }
                  variant="destructive"
                >
                  <TrashIcon aria-hidden="true" />
                  {t('deleteTemplate')}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </div>
        ))
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem
        disabled={pending}
        onSelect={() =>
          startTransition(async () => {
            const result = await createDatabaseTemplate(databaseId)

            if (!result.ok) {
              toast.error(result.error)

              return
            }

            router.push(`/doc/${result.id}`)
          })
        }
      >
        <AddIcon aria-hidden="true" />
        {t('newTemplate')}
      </DropdownMenuItem>
    </DropdownMenuContent>
  )
}
