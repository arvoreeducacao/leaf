'use client'

import { useTranslations } from 'next-intl'
import { useDeferredValue, useId, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { uploadEditorFile } from '@/components/editor/upload-file'
import { SearchIcon, TrashIcon, UploadIcon } from '@/components/icons'
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
  type EmojiEntry,
  emojiGroups,
  randomEmoji,
  searchEmojis,
} from '@/lib/document-emojis'
import { isUploadedIconPath, readDocumentIcon } from '@/lib/document-icon'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { cn } from '@/shared/utils'

export type IconPickerResult = { ok: true } | { ok: false; error: string }

type Props = Readonly<{
  title: string
  description: string
  removedMessage: string
  open: boolean
  onOpenChange: (open: boolean) => void
  currentIcon: string | null
  onApply: (icon: string) => Promise<IconPickerResult>
  onRemove: () => Promise<IconPickerResult>
  onApplied: () => void
}>

function isHttpsUrl(value: string) {
  const source = readDocumentIcon(value)

  return source?.kind === 'image' && !isUploadedIconPath(value)
}

export function IconPicker({
  title,
  description,
  removedMessage,
  open,
  onOpenChange,
  currentIcon,
  onApply,
  onRemove,
  onApplied,
}: Props) {
  const t = useTranslations('icon')
  const isMobile = useIsMobile()
  const [pending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [query, setQuery] = useState('')
  const [link, setLink] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const searchId = useId()
  const linkId = useId()
  const linkErrorId = useId()
  const busy = pending || uploading
  const deferredQuery = useDeferredValue(query)
  const results = useMemo(
    () => searchEmojis(deferredQuery),
    [deferredQuery],
  )
  const searching = deferredQuery.trim().length > 0

  function apply(icon: string) {
    startTransition(async () => {
      const result = await onApply(icon)

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
      const result = await onRemove()

      if (!result.ok) {
        toast.error(result.error)

        return
      }

      onOpenChange(false)
      onApplied()
      toast.success(removedMessage)
    })
  }

  async function upload(file: File) {
    setUploading(true)

    try {
      const url = await uploadEditorFile(file, t('uploadFailed'))

      apply(url)
    } catch {
      setUploading(false)

      return
    }

    setUploading(false)
  }

  function submitLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const value = link.trim()

    if (!isHttpsUrl(value)) {
      setLinkError(t('linkInvalid'))

      return
    }

    setLinkError(null)
    apply(value)
  }

  function emojiButton(entry: EmojiEntry) {
    const selected = currentIcon === entry.emoji

    return (
      <li key={entry.emoji}>
        <button
          aria-pressed={selected}
          className={cn(
            'flex size-9 cursor-pointer items-center justify-center rounded-medium text-[22px] leading-none outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
            selected && 'bg-surface-hover ring-2 ring-ring',
          )}
          data-emoji={entry.emoji}
          disabled={busy}
          onClick={() => apply(entry.emoji)}
          title={entry.keywords[0] ?? entry.emoji}
          type="button"
        >
          {entry.emoji}
        </button>
      </li>
    )
  }

  const removeButton = currentIcon ? (
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
    <Tabs className="gap-4" defaultValue="emoji">
      <div className="flex items-end justify-between gap-2">
        <TabsList className="h-10 min-w-0 flex-1 gap-4 overflow-x-auto">
          <TabsTrigger value="emoji">{t('tabEmoji')}</TabsTrigger>
          <TabsTrigger value="upload">{t('tabUpload')}</TabsTrigger>
          <TabsTrigger value="link">{t('tabLink')}</TabsTrigger>
        </TabsList>
        {removeButton}
      </div>

      <TabsContent className="flex flex-col gap-3" value="emoji">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <label className="sr-only" htmlFor={searchId}>
              {t('searchLabel')}
            </label>
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-content-subtle"
            />
            <Input
              autoComplete="off"
              className="max-w-none pl-9"
              id={searchId}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('searchPlaceholder')}
              type="search"
              value={query}
            />
          </div>
          <Button
            disabled={busy}
            onClick={() => apply(randomEmoji())}
            type="button"
            variant="outline"
          >
            {t('random')}
          </Button>
        </div>

        <div className="-mr-1 max-h-72 overflow-y-auto pr-1">
          {searching ? (
            results.length > 0 ? (
              <ul className="grid grid-cols-8 gap-0.5 tablet:grid-cols-10">
                {results.map(emojiButton)}
              </ul>
            ) : (
              <p className="py-6 text-center text-body-small text-content-subtle">
                {t('searchEmpty', { query: query.trim() })}
              </p>
            )
          ) : (
            emojiGroups.map((group) => (
              <section className="mb-3" key={group.id}>
                <h3 className="mb-1 text-caption text-content-subtle">
                  {t(`groups.${group.id}`)}
                </h3>
                <ul className="grid grid-cols-8 gap-0.5 tablet:grid-cols-10">
                  {group.emojis.map(emojiButton)}
                </ul>
              </section>
            ))
          )}
        </div>
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
            subtitle={description}
            title={title}
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-content">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">{body}</div>
      </DialogContent>
    </Dialog>
  )
}
