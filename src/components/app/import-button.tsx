'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { NotionImportDialog } from '@/components/app/notion-import-dialog'
import { FileUploadIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { importMarkdown } from '@/lib/markdown/import-action'
import {
  MARKDOWN_EXTENSIONS,
  MAX_MARKDOWN_BYTES,
  MAX_MARKDOWN_LABEL,
} from '@/lib/markdown/limits'
import {
  MAX_ZIP_BYTES,
  MAX_ZIP_LABEL,
  ZIP_EXTENSIONS,
} from '@/lib/notion/limits'
import { cn } from '@/shared/utils'

const acceptedExtensions = [...MARKDOWN_EXTENSIONS, ...ZIP_EXTENSIONS]

export function ImportButton() {
  const t = useTranslations('importFile')
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [pending, startTransition] = useTransition()

  function handleMarkdown(file: File) {
    if (file.size > MAX_MARKDOWN_BYTES) {
      toast.error(t('tooLarge', { limit: MAX_MARKDOWN_LABEL }))

      return
    }

    startTransition(async () => {
      try {
        const text = await file.text()
        const result = await importMarkdown(file.name, text)

        if (result.ok) {
          toast.success(t('markdownImported'))
          router.push(`/doc/${result.id}`)

          return
        }

        toast.error(result.error)
      } catch (error) {
        if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
          throw error
        }

        toast.error(t('failed'))
      }
    })
  }

  function handleFile(file: File | undefined) {
    if (!file) {
      return
    }

    const name = file.name.toLowerCase()

    if (ZIP_EXTENSIONS.some((extension) => name.endsWith(extension))) {
      if (file.size > MAX_ZIP_BYTES) {
        toast.error(t('tooLarge', { limit: MAX_ZIP_LABEL }))

        return
      }

      setZipFile(file)

      return
    }

    if (MARKDOWN_EXTENSIONS.some((extension) => name.endsWith(extension))) {
      handleMarkdown(file)

      return
    }

    toast.error(t('wrongType'))
  }

  return (
    <div
      className="flex flex-col gap-1"
      onDragEnter={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setDragging(false)
        }
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)

        if (!pending) {
          handleFile(event.dataTransfer.files[0])
        }
      }}
    >
      <input
        accept={acceptedExtensions.join(',')}
        aria-hidden="true"
        className="sr-only"
        onChange={(event) => {
          handleFile(event.target.files?.[0])
          event.target.value = ''
        }}
        ref={inputRef}
        tabIndex={-1}
        type="file"
      />

      <Button
        aria-busy={pending}
        aria-disabled={pending}
        className={cn(
          'w-full',
          dragging && 'border-brand-strong bg-brand-surface text-content-strong',
          pending &&
            'cursor-not-allowed bg-muted text-content-muted hover:border-line-strong hover:text-content-muted',
        )}
        onClick={() => {
          if (pending) {
            return
          }

          inputRef.current?.click()
        }}
        type="button"
        variant="secondary"
      >
        <FileUploadIcon aria-hidden="true" />
        {t('button')}
      </Button>

      <p className="min-h-6 px-3 text-body-small text-content">
        {pending
          ? t('importing')
          : dragging
            ? t('dragging')
            : t('hint')}
      </p>

      <span aria-live="polite" className="sr-only">
        {pending ? t('importing') : ''}
      </span>

      <NotionImportDialog
        file={zipFile}
        onOpenChange={(open) => {
          if (!open) {
            setZipFile(null)
          }
        }}
      />
    </div>
  )
}
