'use client'

import { useTranslations } from 'next-intl'
import { useId, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { UnsplashPicker } from '@/components/app/unsplash-picker'
import { uploadEditorFile } from '@/components/editor/upload-file'
import { TrashIcon, UploadIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  type CoverInput,
  removeDocumentCover,
  setDocumentCover,
} from '@/lib/document-actions'
import {
  coverGradients,
  gradientCoverValue,
  isHttpsImageUrl,
} from '@/lib/document-cover'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { cn } from '@/shared/utils'

type Props = Readonly<{
  documentId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  currentCover: string | null
  unsplashEnabled: boolean
  onApplied: () => void
}>

export function CoverPicker({
  documentId,
  open,
  onOpenChange,
  currentCover,
  unsplashEnabled,
  onApplied,
}: Props) {
  const t = useTranslations('cover')
  const isMobile = useIsMobile()
  const [pending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [link, setLink] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const linkId = useId()
  const linkErrorId = useId()
  const busy = pending || uploading

  function apply(input: CoverInput) {
    startTransition(async () => {
      const result = await setDocumentCover(documentId, input)

      if (!result.ok) {
        toast.error(result.error)

        return
      }

      onOpenChange(false)
      onApplied()
    })
  }

  function remove() {
    startTransition(async () => {
      const result = await removeDocumentCover(documentId)

      if (!result.ok) {
        toast.error(result.error)

        return
      }

      onOpenChange(false)
      onApplied()
      toast.success(t('removed'))
    })
  }

  async function upload(file: File) {
    setUploading(true)

    try {
      const url = await uploadEditorFile(file, t('uploadFailed'))

      apply({ cover: url })
    } catch {
      setUploading(false)

      return
    }

    setUploading(false)
  }

  function submitLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const value = link.trim()

    if (!isHttpsImageUrl(value)) {
      setLinkError(t('linkInvalid'))

      return
    }

    setLinkError(null)
    apply({ cover: value })
  }

  const removeButton = currentCover ? (
    <Button
      className="text-content-subtle"
      disabled={busy}
      onClick={remove}
      size="sm"
      type="button"
      variant="ghost"
    >
      <TrashIcon aria-hidden="true" />
      {t('remove')}
    </Button>
  ) : null

  const body = (
    <Tabs className="gap-4" defaultValue="gallery">
      <div className="flex items-end justify-between gap-2">
        <TabsList className="h-10 min-w-0 flex-1 gap-4 overflow-x-auto">
          <TabsTrigger value="gallery">{t('tabGallery')}</TabsTrigger>
          <TabsTrigger value="upload">{t('tabUpload')}</TabsTrigger>
          <TabsTrigger value="link">{t('tabLink')}</TabsTrigger>
          <TabsTrigger value="unsplash">{t('tabUnsplash')}</TabsTrigger>
        </TabsList>
        {removeButton}
      </div>

      <TabsContent value="gallery">
        <p className="mb-2 text-caption text-content-subtle">
          {t('galleryColors')}
        </p>
        <ul className="grid grid-cols-3 gap-2 tablet:grid-cols-4">
          {coverGradients.map((gradient) => {
            const value = gradientCoverValue(gradient.id)
            const selected = currentCover === value

            return (
              <li key={gradient.id}>
                <button
                  aria-label={t(`gradients.${gradient.id}`)}
                  aria-pressed={selected}
                  className={cn(
                    'h-14 w-full cursor-pointer rounded-large border border-line-soft outline-none transition-transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card disabled:cursor-not-allowed disabled:opacity-60',
                    selected && 'ring-2 ring-ring ring-offset-2 ring-offset-surface-card',
                  )}
                  disabled={busy}
                  onClick={() => apply({ cover: value })}
                  style={{ background: gradient.css }}
                  type="button"
                />
              </li>
            )
          })}
        </ul>
      </TabsContent>

      <TabsContent value="upload">
        <div className="flex flex-col items-start gap-2">
          <input
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]

              event.target.value = ''

              if (file) {
                void upload(file)
              }
            }}
            ref={fileRef}
            tabIndex={-1}
            type="file"
          />
          <Button
            className="w-full"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            type="button"
            variant="outline"
          >
            <UploadIcon aria-hidden="true" />
            {uploading ? t('uploading') : t('uploadPick')}
          </Button>
          <p className="text-caption text-content-subtle">{t('uploadHint')}</p>
        </div>
      </TabsContent>

      <TabsContent value="link">
        <form className="flex flex-col gap-2" onSubmit={submitLink}>
          <label className="sr-only" htmlFor={linkId}>
            {t('linkLabel')}
          </label>
          <Input
            aria-describedby={linkError ? linkErrorId : undefined}
            aria-invalid={linkError ? true : undefined}
            autoComplete="off"
            className="max-w-none"
            id={linkId}
            inputMode="url"
            onChange={(event) => {
              setLink(event.target.value)
              setLinkError(null)
            }}
            placeholder={t('linkPlaceholder')}
            value={link}
          />
          {linkError ? (
            <p className="text-caption text-danger" id={linkErrorId} role="alert">
              {linkError}
            </p>
          ) : null}
          <Button
            className="w-full"
            disabled={busy || link.trim().length === 0}
            type="submit"
          >
            {t('linkSubmit')}
          </Button>
          <p className="text-caption text-content-subtle">{t('linkHint')}</p>
        </form>
      </TabsContent>

      <TabsContent value="unsplash">
        <UnsplashPicker
          disabled={busy}
          enabled={unsplashEnabled}
          onPick={(photo) =>
            apply({
              cover: photo.coverUrl,
              credit: photo.credit,
              unsplashDownloadLocation: photo.downloadLocation,
            })
          }
        />
      </TabsContent>
    </Tabs>
  )

  if (isMobile) {
    return (
      <Sheet onOpenChange={onOpenChange} open={open}>
        <SheetContent
          className="max-h-[85dvh] overflow-hidden"
          showClose={false}
          side="bottom"
        >
          <SheetHeader
            className="shrink-0"
            subtitle={t('pickerDescription')}
            title={t('pickerTitle')}
            type="close"
          />
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">{body}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden tablet:max-w-135">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t('pickerTitle')}</DialogTitle>
          <DialogDescription className="text-content">
            {t('pickerDescription')}
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">{body}</div>
      </DialogContent>
    </Dialog>
  )
}
