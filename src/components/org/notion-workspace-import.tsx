'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

import {
  notionConnectHref,
  notionImportParam,
  notionStatusParam,
} from '@/components/app/notion-import-params'
import { ImportDestinationPicker } from '@/components/editor/import-destination-picker'
import { ImportProgress } from '@/components/editor/import-progress'
import { useImportStream } from '@/components/editor/use-import-stream'
import { AlertIcon, CheckCircleIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type {
  ImportDestinationsResult,
  NotionPersonalImportState,
} from '@/lib/import-actions'
import type { NotionWorkspaceImportState } from '@/lib/notion/already-imported'

type Props = Readonly<{
  connection: NotionPersonalImportState
  footprint: NotionWorkspaceImportState
  destinations: ImportDestinationsResult
}>

const flow = 'workspace'

function ConnectFailedAlert() {
  const t = useTranslations('notionWorkspaceImport')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (searchParams.get(notionImportParam) !== flow) {
      return
    }

    setFailed(searchParams.get(notionStatusParam) === 'failed')

    const next = new URLSearchParams(searchParams)
    next.delete(notionImportParam)
    next.delete(notionStatusParam)
    const query = next.toString()

    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  if (!failed) {
    return null
  }

  return (
    <p
      className="flex items-start gap-2 text-body-small text-danger"
      role="alert"
    >
      <AlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {t('failedConnect')}
    </p>
  )
}

function ToggleRow({
  checked,
  onCheckedChange,
  title,
  hint,
}: Readonly<{
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  title: string
  hint?: string
}>) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-large px-3 py-2 transition-colors hover:bg-surface-hover has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-offset-2">
      <Switch checked={checked} className="mt-1" onCheckedChange={onCheckedChange} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body-small text-content-strong">{title}</span>
        {hint ? (
          <span className="text-body-small text-content">{hint}</span>
        ) : null}
      </span>
    </label>
  )
}

export function NotionWorkspaceImport({
  connection,
  footprint,
  destinations,
}: Props) {
  const t = useTranslations('notionWorkspaceImport')
  const tCommon = useTranslations('common')
  const format = useFormatter()
  const pathname = usePathname()
  const stream = useImportStream()
  const [destination, setDestination] = useState<string | null>(
    destinations.suggested,
  )
  const [withComments, setWithComments] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)

  const connectHref = notionConnectHref(pathname, flow)
  const needsAcknowledgement = footprint.byOthers !== null
  const canStart =
    connection.state === 'connected' &&
    destination !== null &&
    destination !== 'private' &&
    (!needsAcknowledgement || acknowledged)

  function begin() {
    void stream.start(
      '/api/import/notion/link',
      JSON.stringify({
        acknowledgeDuplicates: acknowledged,
        comments: withComments,
        destination,
        workspace: true,
      }),
      { 'Content-Type': 'application/json' },
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="font-bold text-heading-medium text-content-strong">
          {t('title')}
        </h2>
        <p className="text-body-small text-content">{t('description')}</p>
      </div>

      <Suspense fallback={null}>
        <ConnectFailedAlert />
      </Suspense>

      {connection.state === 'unavailable' ? (
        <p className="text-body-small text-content">{t('unavailable')}</p>
      ) : stream.started ? (
        <div className="flex flex-col gap-4">
          <ImportProgress stream={stream} />
          {stream.running ? (
            <div>
              <Button
                onClick={stream.abort}
                type="button"
                variant="secondary"
              >
                {tCommon('cancel')}
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-small text-content">
            {connection.state === 'connected' ? (
              <span className="flex items-center gap-1.5 text-content-strong">
                <CheckCircleIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-positive"
                />
                {connection.workspaceName
                  ? t('connectedTo', { workspace: connection.workspaceName })
                  : t('connected')}
              </span>
            ) : null}
            <a
              className="text-brand underline-offset-2 hover:underline"
              href={connectHref}
            >
              {connection.state === 'connected' ? t('reconnect') : t('connect')}
            </a>
          </p>

          {connection.state === 'connected' ? (
            <>
              <ImportDestinationPicker
                destination={destination}
                destinations={destinations}
                onChange={setDestination}
              />

              <ToggleRow
                checked={withComments}
                hint={t('withCommentsHint')}
                onCheckedChange={setWithComments}
                title={t('withComments')}
              />

              {footprint.byMe ? (
                <p className="text-body-small text-content">
                  {t('byMeHint', { count: footprint.byMe.documents })}
                </p>
              ) : null}

              {footprint.byOthers ? (
                <div className="flex flex-col gap-2 rounded-large bg-warn-surface p-4">
                  <p className="flex items-start gap-2 text-body-small text-content-strong">
                    <AlertIcon
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-warn"
                    />
                    {footprint.byOthers.latestAt
                      ? t('byOthersWarningDated', {
                          count: footprint.byOthers.documents,
                          date: format.dateTime(footprint.byOthers.latestAt, {
                            dateStyle: 'medium',
                          }),
                        })
                      : t('byOthersWarning', {
                          count: footprint.byOthers.documents,
                        })}
                  </p>
                  <ToggleRow
                    checked={acknowledged}
                    onCheckedChange={setAcknowledged}
                    title={t('acknowledge')}
                  />
                </div>
              ) : null}

              <div>
                <Button disabled={!canStart} onClick={begin} type="button">
                  {t('start')}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </section>
  )
}
