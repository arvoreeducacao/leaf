'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  AlertIcon,
  CheckCircleIcon,
  PadlockIcon,
  TeamIcon,
  UsersIcon,
} from '@/components/icons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { listImportDestinations } from '@/lib/import-actions'
import type { ImportDestinationsResult } from '@/lib/import-actions'
import type { ImportEvent, ImportSummary } from '@/lib/notion/import'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { cn } from '@/shared/utils'

type Props = Readonly<{
  file: File | null
  parentId: string
  onOpenChange: (open: boolean) => void
}>

type Progress = Readonly<{
  phase: 'assets' | 'pages'
  done: number
  total: number
}>

const phaseKeys: Record<Progress['phase'], 'phaseAssets' | 'phasePages'> = {
  assets: 'phaseAssets',
  pages: 'phasePages',
}

function DestinationOption({
  value,
  label,
  hint,
  icon,
  checked,
}: Readonly<{
  value: string
  label: string
  hint: string
  icon: React.ReactNode
  checked: boolean
}>) {
  return (
    <label
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-3 rounded-large px-3 py-2 transition-colors',
        'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-offset-2',
        checked ? 'bg-brand-surface' : 'hover:bg-surface-hover',
      )}
    >
      <RadioGroupItem value={value} />
      {icon}
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            'truncate text-body-small text-content-strong',
            checked ? 'font-bold' : '',
          )}
        >
          {label}
        </span>
        <span className="text-body-small text-content">{hint}</span>
      </span>
    </label>
  )
}

export function ArchiveImportDialog({ file, parentId, onOpenChange }: Props) {
  const t = useTranslations('archiveImport')
  const tCommon = useTranslations('common')
  const title = t('title')
  const description = t('description')
  const router = useRouter()
  const isMobile = useIsMobile()
  const startedFor = useRef<File | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [destinations, setDestinations] =
    useState<ImportDestinationsResult | null>(null)
  const [destination, setDestination] = useState<string | null>(null)
  const [started, setStarted] = useState(false)

  const closeOrAbort = useCallback(
    (open: boolean) => {
      if (!open && abortRef.current && running) {
        abortRef.current.abort()
      }

      onOpenChange(open)
    },
    [onOpenChange, running],
  )

  const run = useCallback(
    async (target: File, chosen: string) => {
      const controller = new AbortController()
      abortRef.current = controller

      startedFor.current = target
      setStarted(true)
      setRunning(true)
      setProgress(null)
      setSummary(null)
      setError(null)

      const body = new FormData()
      body.append('file', target)
      body.append('parentId', parentId)
      body.append('destination', chosen)

      try {
        const response = await fetch('/api/import/notion', {
          body,
          method: 'POST',
          signal: controller.signal,
        })

        if (!response.ok || !response.body) {
          const payload: unknown = await response.json().catch(() => null)
          const message =
            payload && typeof payload === 'object' && 'error' in payload
              ? String((payload as { error: unknown }).error)
              : t('failed')

          setError(message)
          setRunning(false)

          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (line.trim().length === 0) {
              continue
            }

            const event = JSON.parse(line) as ImportEvent

            if (event.type === 'progress') {
              setProgress({
                done: event.done,
                phase: event.phase,
                total: event.total,
              })
            }

            if (event.type === 'done') {
              setSummary(event.summary)
              router.refresh()
            }

            if (event.type === 'error') {
              setError(event.error)
            }
          }
        }
      } catch {
        setError(controller.signal.aborted ? t('cancelled') : t('failed'))
      } finally {
        setRunning(false)
        router.refresh()
      }
    },
    [parentId, router, t],
  )

  useEffect(() => {
    if (!file) {
      startedFor.current = null
      setDestinations(null)
      setDestination(null)
      setStarted(false)
      setProgress(null)
      setSummary(null)
      setError(null)

      return
    }

    if (startedFor.current === file) {
      return
    }

    let active = true

    void listImportDestinations(parentId).then((result) => {
      if (!active) {
        return
      }

      setDestinations(result)
      setDestination((current) => current ?? result.suggested)
    })

    return () => {
      active = false
    }
  }, [file, parentId])

  const percent =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0

  const parentDestination = destinations?.parentDestination ?? 'private'
  const chosenLabel =
    destination === 'organization'
      ? (destinations?.organizationName ?? t('destinationOrganization'))
      : (destinations?.teamspaces.find(
          (option) => option.value === destination,
        )?.label ?? t('destinationPrivate'))

  const picker = (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <p className="text-body-small text-content-strong">
        {t('destinationTitle')}
      </p>

      <RadioGroup
        aria-label={t('destinationLabel')}
        className="flex flex-col gap-1"
        onValueChange={setDestination}
        value={destination ?? 'private'}
      >
        <DestinationOption
          checked={destination === 'private'}
          hint={t('destinationPrivateHint')}
          icon={<PadlockIcon aria-hidden="true" className="size-4 shrink-0" />}
          label={t('destinationPrivate')}
          value="private"
        />

        {destinations?.organizationName ? (
          <DestinationOption
            checked={destination === 'organization'}
            hint={t('destinationOrganizationHint')}
            icon={<TeamIcon aria-hidden="true" className="size-4 shrink-0" />}
            label={destinations.organizationName}
            value="organization"
          />
        ) : null}

        {destinations?.teamspaces.map((option) => (
          <DestinationOption
            checked={destination === option.value}
            hint={t('destinationTeamspaceHint')}
            icon={<UsersIcon aria-hidden="true" className="size-4 shrink-0" />}
            key={option.value}
            label={option.label}
            value={option.value}
          />
        ))}
      </RadioGroup>

      <p className="text-body-small text-content">
        {destination === parentDestination
          ? t('destinationUnderParent')
          : t('destinationAtRoot', { place: chosenLabel })}
      </p>
    </div>
  )

  const body = (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      {started && (running || (!summary && !error)) ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-body-small text-content-strong">
              {progress ? t(phaseKeys[progress.phase]) : t('reading')}
            </span>
            {progress ? (
              <span className="text-body-small text-content">
                {t('progressCount', {
                  done: progress.done,
                  total: progress.total,
                })}
              </span>
            ) : null}
          </div>
          <div
            aria-label={t('progressLabel')}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={percent}
            className="h-2 w-full overflow-hidden rounded-pill bg-surface-hover"
            role="progressbar"
          >
            <div
              className="h-full rounded-pill bg-brand-strong transition-all duration-200 motion-reduce:transition-none"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      ) : null}

      {summary ? (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-body-small text-content-strong">
            <CheckCircleIcon
              aria-hidden="true"
              className="size-4 shrink-0 text-positive"
            />
            {t('summary', { assets: summary.assets, pages: summary.pages })}
          </p>

          {summary.warnings.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-large bg-warn-surface p-4">
              <p className="flex items-center gap-2 font-bold text-body-small text-content-strong">
                <AlertIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-warn"
                />
                {t('warningsTitle')}
              </p>
              <ul className="flex list-disc flex-col gap-1 ps-4">
                {summary.warnings.map((warning) => (
                  <li className="text-body-small text-content" key={warning}>
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p
          className="flex items-start gap-2 text-body-small text-danger"
          role="alert"
        >
          <AlertIcon aria-hidden="true" className="mt-1 size-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <span aria-live="polite" className="sr-only">
        {summary
          ? t('doneAnnounce', { count: summary.pages })
          : error
            ? t('errorAnnounce', { error })
            : ''}
      </span>
    </div>
  )

  const actions = !started ? (
    <div className="flex flex-col gap-2 tablet:flex-row-reverse">
      <Button
        className="w-full tablet:w-auto"
        disabled={!file || !destination || destinations === null}
        onClick={() => {
          if (file && destination) {
            void run(file, destination)
          }
        }}
        type="button"
      >
        {t('startImport')}
      </Button>
      <Button
        className="w-full tablet:w-auto"
        onClick={() => onOpenChange(false)}
        type="button"
        variant="secondary"
      >
        {tCommon('cancel')}
      </Button>
    </div>
  ) : summary?.rootId ? (
    <Button
      className="w-full tablet:w-auto"
      onClick={() => {
        onOpenChange(false)
        router.push(`/doc/${summary.rootId}`)
      }}
      type="button"
    >
      {t('openDocument')}
    </Button>
  ) : running ? (
    <Button
      className="w-full tablet:w-auto"
      onClick={() => abortRef.current?.abort()}
      type="button"
      variant="secondary"
    >
      {t('cancelImport')}
    </Button>
  ) : error && file ? (
    <Button
      className="w-full tablet:w-auto"
      onClick={() => void run(file, destination ?? 'private')}
      type="button"
      variant="secondary"
    >
      {tCommon('tryAgain')}
    </Button>
  ) : null

  if (isMobile) {
    return (
      <Sheet onOpenChange={closeOrAbort} open={file !== null}>
        <SheetContent
          className="max-h-[85dvh] overflow-hidden"
          showClose={false}
          side="bottom"
        >
          <SheetHeader
            className="shrink-0"
            subtitle={description}
            title={title}
            type="close"
          />
          <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-6">
            {started ? body : picker}
            {actions ? <div className="flex flex-col gap-2">{actions}</div> : null}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog onOpenChange={closeOrAbort} open={file !== null}>
      <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden tablet:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-content">
            {description}
          </DialogDescription>
        </DialogHeader>
        {started ? body : picker}
        {actions ? (
          <DialogFooter className="shrink-0">{actions}</DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
