'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState } from 'react'

import { DocumentIcon } from '@/components/app/document-icon'
import { ArrowRightIcon, GraphIcon, ReplyIcon } from '@/components/icons'
import { LocalGraph } from '@/components/links/local-graph'
import {
  linkCount,
  useDocumentLinks,
} from '@/components/links/use-document-links'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import type { LinkedDocument } from '@/lib/document-link-graph'
import { useIsMobile } from '@/shared/hooks/use-mobile'

type Props = Readonly<{
  documentId: string
  title: string
}>

type SectionProps = Readonly<{
  heading: string
  icon: React.ReactNode
  items: ReadonlyArray<LinkedDocument>
  testId: string
  onNavigate: () => void
}>

function LinkSection({ heading, icon, items, testId, onNavigate }: SectionProps) {
  const t = useTranslations('links')

  if (items.length === 0) {
    return null
  }

  return (
    <section className="flex flex-col gap-0.5" data-testid={testId}>
      <h3 className="flex h-6 items-center gap-1.5 px-2 text-caption font-medium text-content-subtle">
        {icon}
        {heading}
        <span className="tabular-nums text-content-tertiary">{items.length}</span>
      </h3>
      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              className="flex flex-col gap-0.5 rounded-large px-2 py-1.5 outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring"
              href={`/doc/${item.id}`}
              onClick={onNavigate}
            >
              <span className="flex min-w-0 items-center gap-1.5 text-body-small font-medium text-content-strong">
                <DocumentIcon
                  className="size-4.5 shrink-0 text-[15px]"
                  icon={item.icon}
                  kind={item.kind}
                />
                <span className="min-w-0 truncate">{item.title}</span>
                {item.relation !== 'citation' ? (
                  <span className="shrink-0 text-caption font-normal text-content-tertiary">
                    {t(item.relation)}
                  </span>
                ) : null}
              </span>
              {item.context ? (
                <span className="line-clamp-3 pl-6 text-caption text-content-subtle">
                  {item.context}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function LinksPanel({ documentId, title }: Props) {
  const t = useTranslations('links')
  const tCommon = useTranslations('common')
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const { state, reload } = useDocumentLinks(documentId)
  const count = linkCount(state)

  const body = (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 pb-6 pt-3">
      {state.status === 'loading' ? (
        <div className="flex flex-col gap-3 px-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : null}

      {state.status === 'failed' ? (
        <div className="flex flex-col items-start gap-2 px-2 text-body-small text-content-subtle">
          <p>{t('failed')}</p>
          <Button onClick={() => void reload()} size="sm" type="button" variant="outline">
            {tCommon('tryAgain')}
          </Button>
        </div>
      ) : null}

      {state.status === 'ready' && count === 0 ? (
        <div className="flex flex-col gap-3 px-2" data-testid="links-empty">
          <div className="rounded-large border border-line bg-surface-card px-4 py-6">
            <LocalGraph incoming={[]} label={t('graphLabel')} outgoing={[]} title={title} />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-body-small font-semibold text-content-strong">{t('empty')}</p>
            <p className="text-body-small text-content-subtle">{t('emptyHint')}</p>
          </div>
          <ol className="list-decimal pl-5 text-body-small text-content">
            <li>{t('emptyStepCopy')}</li>
            <li>{t('emptyStepPaste')}</li>
          </ol>
        </div>
      ) : null}

      {state.status === 'ready' && count !== null && count > 0 ? (
        <>
          <div className="mx-2 rounded-large border border-line bg-surface-card">
            <LocalGraph
              incoming={state.links.incoming}
              label={t('graphLabel')}
              outgoing={state.links.outgoing}
              title={title}
            />
          </div>
          <LinkSection
            heading={t('incoming')}
            icon={<ReplyIcon aria-hidden="true" className="size-3.5" />}
            items={state.links.incoming}
            onNavigate={() => setOpen(false)}
            testId="links-incoming"
          />
          <LinkSection
            heading={t('outgoing')}
            icon={<ArrowRightIcon aria-hidden="true" className="size-3.5" />}
            items={state.links.outgoing}
            onNavigate={() => setOpen(false)}
            testId="links-outgoing"
          />
        </>
      ) : null}
    </div>
  )

  return (
    <>
      <Button
        className="px-1 text-content-subtle"
        data-testid="links-button"
        onClick={() => {
          setOpen(true)
          void reload()
        }}
        size="sm"
        type="button"
        variant="ghost"
      >
        <GraphIcon aria-hidden="true" className="size-5" />
        <span className="sr-only">{t('open')}</span>
        {count !== null && count > 0 ? (
          <>
            <span aria-hidden="true" className="text-caption tabular-nums">
              {count}
            </span>
            <span className="sr-only">{t('openCount', { count })}</span>
          </>
        ) : null}
      </Button>

      <Sheet onOpenChange={setOpen} open={open}>
        <SheetContent
          className={
            isMobile
              ? 'h-[85dvh] pb-[env(safe-area-inset-bottom)]'
              : 'w-full sm:max-w-md'
          }
          data-testid="links-panel"
          showClose={!isMobile}
          side={isMobile ? 'bottom' : 'right'}
        >
          {isMobile ? (
            <SheetHeader
              className="shrink-0"
              subtitle={t('description')}
              title={t('title')}
              type="close"
            />
          ) : (
            <SheetHeader className="shrink-0 gap-2 p-5 pb-0">
              <SheetTitle>{t('title')}</SheetTitle>
              <SheetDescription>{t('description')}</SheetDescription>
            </SheetHeader>
          )}
          {body}
        </SheetContent>
      </Sheet>
    </>
  )
}
