'use client'

import { useTranslations } from 'next-intl'

import { AlertIcon, CheckCircleIcon } from '@/components/icons'
import type { ImportStream } from '@/components/editor/use-import-stream'

const phaseKeys = {
  assets: 'phaseAssets',
  pages: 'phasePages',
  reading: 'phaseReading',
} as const

type Props = Readonly<{ stream: ImportStream }>

export function ImportProgress({ stream }: Props) {
  const t = useTranslations('archiveImport')
  const { error, progress, running, summary } = stream
  const percent =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      {running || (!summary && !error) ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-body-small text-content-strong">
              {progress ? t(phaseKeys[progress.phase]) : t('reading')}
            </span>
            {progress ? (
              <span className="text-body-small text-content">
                {progress.total > 0
                  ? t('progressCount', {
                      done: progress.done,
                      total: progress.total,
                    })
                  : t('readingCount', { done: progress.done })}
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
}
