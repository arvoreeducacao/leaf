'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'

import { DocumentIcon } from '@/components/app/document-icon'
import { Skeleton } from '@/components/ui/skeleton'
import { previewTrail } from '@/lib/document-preview'

import { docLinkPreviewClass } from './doc-link-icons'
import { useDocumentPreview } from './use-doc-preview'

type Props = Readonly<{ documentId: string }>

const shell =
  'block w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-large border border-line bg-surface-card px-4 py-3 text-left shadow-down-large'

function PreviewSkeleton() {
  return (
    <div className={shell}>
      <Skeleton className="size-6 rounded-small" />
      <Skeleton className="mt-2.5 h-3 w-28" />
      <Skeleton className="mt-2 h-4 w-44" />
      <Skeleton className="mt-3 h-3 w-full" />
      <Skeleton className="mt-1.5 h-3 w-4/5" />
    </div>
  )
}

export function DocLinkPreview({ documentId }: Props) {
  const t = useTranslations('editor')
  const tDocument = useTranslations('document')
  const state = useDocumentPreview(documentId)

  if (state.status === 'loading') {
    return <PreviewSkeleton />
  }

  if (state.status === 'missing') {
    return (
      <div className={shell}>
        <p className="text-body-small text-content-subtle">
          {t('linkPreviewMissing')}
        </p>
      </div>
    )
  }

  const { preview } = state
  const trail = previewTrail(preview.trail)

  return (
    <Link
      className={`${docLinkPreviewClass} ${shell}`}
      href={`/doc/${preview.id}`}
    >
      <DocumentIcon
        className="size-6"
        icon={preview.icon}
        kind={preview.kind}
      />
      {trail.length > 0 ? (
        <p className="mt-2.5 truncate text-caption text-content-subtle">
          {trail}
        </p>
      ) : null}
      <p className="mt-0.5 truncate font-semibold text-body-small text-content-strong">
        {preview.title || tDocument('untitled')}
      </p>
      {preview.excerpt.length > 0 ? (
        <p className="mt-2 line-clamp-4 whitespace-pre-line text-body-small text-content-subtle">
          {preview.excerpt}
        </p>
      ) : (
        <p className="mt-2 text-body-small text-content-disabled">
          {t('linkPreviewEmpty')}
        </p>
      )}
    </Link>
  )
}
