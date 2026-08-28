'use client'

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
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [pending, startTransition] = useTransition()

  function handleMarkdown(file: File) {
    if (file.size > MAX_MARKDOWN_BYTES) {
      toast.error(`O arquivo passa de ${MAX_MARKDOWN_LABEL}`)

      return
    }

    startTransition(async () => {
      try {
        const text = await file.text()
        const result = await importMarkdown(file.name, text)

        if (result.ok) {
          toast.success('Markdown importado')
          router.push(`/doc/${result.id}`)

          return
        }

        toast.error(result.error)
      } catch (error) {
        if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
          throw error
        }

        toast.error('Não foi possível importar o arquivo')
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
        toast.error(`O arquivo passa de ${MAX_ZIP_LABEL}`)

        return
      }

      setZipFile(file)

      return
    }

    if (MARKDOWN_EXTENSIONS.some((extension) => name.endsWith(extension))) {
      handleMarkdown(file)

      return
    }

    toast.error('Escolha um arquivo markdown ou um zip exportado do Notion')
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
          dragging && 'border-primary-800 bg-primary-100 text-gray-900',
          pending &&
            'cursor-not-allowed bg-muted text-gray-600 hover:border-gray-600 hover:text-gray-600',
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
        Importar arquivo
      </Button>

      <p className="min-h-6 px-3 text-body-small text-gray-700">
        {pending
          ? 'Importando o arquivo'
          : dragging
            ? 'Solte o arquivo aqui'
            : 'Markdown ou zip do Notion'}
      </p>

      <span aria-live="polite" className="sr-only">
        {pending ? 'Importando o arquivo' : ''}
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
