'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useId, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { uploadEditorFile } from '@/components/editor/upload-file'
import { TrashIcon, UploadIcon, UserIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UserAvatar } from '@/components/ui/user-avatar'
import {
  removeAccountAvatar,
  saveAccountName,
  setAccountAvatar,
} from '@/lib/account-actions'
import {
  avatarGallerySeeds,
  avatarUrlFor,
  generatedAvatarUrl,
  normalizeAvatar,
} from '@/lib/avatar'
import { MAX_DISPLAY_NAME_LENGTH } from '@/lib/display-name'
import { cn } from '@/shared/utils'

type Props = Readonly<{
  userId: string
  name: string
  email: string
  image: string | null
}>

export function AccountForm({ userId, name, email, image }: Props) {
  const t = useTranslations('account')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [currentName, setCurrentName] = useState(name)
  const [currentImage, setCurrentImage] = useState(image)
  const [link, setLink] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const nameId = useId()
  const emailId = useId()
  const linkId = useId()
  const linkErrorId = useId()
  const busy = pending || uploading
  const currentUrl = avatarUrlFor(userId, currentImage)

  function applyAvatar(value: string) {
    startTransition(async () => {
      const result = await setAccountAvatar(value)

      if (!result.ok) {
        toast.error(result.error)

        return
      }

      setCurrentImage(value)
      toast.success(t('avatarSaved'))
      router.refresh()
    })
  }

  function clearAvatar() {
    startTransition(async () => {
      const result = await removeAccountAvatar()

      if (!result.ok) {
        toast.error(result.error)

        return
      }

      setCurrentImage(null)
      toast.success(t('avatarRemoved'))
      router.refresh()
    })
  }

  function submitName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    startTransition(async () => {
      const result = await saveAccountName(currentName)

      if (!result.ok) {
        toast.error(result.error)

        return
      }

      toast.success(t('nameSaved'))
      router.refresh()
    })
  }

  function submitLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const value = normalizeAvatar(link)

    if (!value || value.startsWith('/')) {
      setLinkError(t('linkInvalid'))

      return
    }

    setLinkError(null)
    setLink('')
    applyAvatar(value)
  }

  async function upload(file: File) {
    setUploading(true)

    try {
      const url = await uploadEditorFile(file, t('uploadFailed'))

      applyAvatar(url)
    } catch {
      return
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <UserIcon aria-hidden="true" className="size-6 shrink-0 text-brand" />
          <h1 className="font-bold text-heading-large text-content-strong">
            {t('title')}
          </h1>
        </div>
        <p className="text-body-medium text-content">{t('subtitle')}</p>
      </header>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <UserAvatar
            className="size-20"
            email={email}
            image={currentImage}
            name={currentName}
            userId={userId}
          />
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-body-small text-content">
              {currentImage ? t('avatarHintChosen') : t('avatarHint')}
            </p>
            {currentImage ? (
              <div>
                <Button
                  className="text-content-subtle"
                  disabled={busy}
                  onClick={clearAvatar}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <TrashIcon aria-hidden="true" />
                  {t('avatarReset')}
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <Tabs className="gap-4" defaultValue="gallery">
          <TabsList className="h-10 min-w-0 gap-4 overflow-x-auto">
            <TabsTrigger value="gallery">{t('tabGallery')}</TabsTrigger>
            <TabsTrigger value="upload">{t('tabUpload')}</TabsTrigger>
            <TabsTrigger value="link">{t('tabLink')}</TabsTrigger>
          </TabsList>

          <TabsContent value="gallery">
            <ul className="grid grid-cols-5 gap-2 tablet:grid-cols-8">
              {avatarGallerySeeds.map((seed) => {
                const url = generatedAvatarUrl(seed)
                const selected = currentUrl === url

                return (
                  <li key={seed}>
                    <button
                      aria-label={t('pickFace', { name: seed })}
                      aria-pressed={selected}
                      className={cn(
                        'aspect-square w-full cursor-pointer overflow-hidden rounded-circular outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
                        selected && 'ring-2 ring-ring',
                      )}
                      disabled={busy}
                      onClick={() => applyAvatar(url)}
                      type="button"
                    >
                      <img alt="" className="size-full" src={url} />
                    </button>
                  </li>
                )
              })}
            </ul>
          </TabsContent>

          <TabsContent value="upload">
            <div className="flex flex-col gap-2">
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
                type="file"
              />
              <Button
                aria-busy={uploading}
                className="w-full tablet:w-auto"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                type="button"
                variant="secondary"
              >
                <UploadIcon aria-hidden="true" />
                {t('uploadButton')}
              </Button>
              <p className="text-body-small text-content">{t('uploadHint')}</p>
            </div>
          </TabsContent>

          <TabsContent value="link">
            <form className="flex flex-col gap-2" onSubmit={submitLink}>
              <Label htmlFor={linkId}>{t('linkLabel')}</Label>
              <div className="flex flex-col gap-2 tablet:flex-row">
                <Input
                  aria-describedby={linkError ? linkErrorId : undefined}
                  aria-invalid={linkError ? true : undefined}
                  autoComplete="off"
                  className="max-w-full"
                  disabled={busy}
                  id={linkId}
                  onChange={(event) => setLink(event.target.value)}
                  placeholder="https://"
                  value={link}
                />
                <Button
                  className="w-full tablet:w-auto"
                  disabled={busy || link.trim().length === 0}
                  type="submit"
                  variant="secondary"
                >
                  {t('linkApply')}
                </Button>
              </div>
              {linkError ? (
                <p
                  className="rounded-large bg-danger-surface p-3 text-body-small text-danger"
                  id={linkErrorId}
                  role="alert"
                >
                  {linkError}
                </p>
              ) : null}
            </form>
          </TabsContent>
        </Tabs>
      </section>

      <Separator />

      <section className="flex flex-col gap-4">
        <form
          className="flex flex-col gap-3 tablet:flex-row tablet:items-end"
          onSubmit={submitName}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Label htmlFor={nameId}>{t('nameLabel')}</Label>
            <Input
              className="max-w-full"
              disabled={pending}
              id={nameId}
              maxLength={MAX_DISPLAY_NAME_LENGTH}
              onChange={(event) => setCurrentName(event.target.value)}
              value={currentName}
            />
          </div>
          <Button
            aria-busy={pending}
            className="w-full tablet:w-auto"
            disabled={pending || currentName.trim() === name.trim()}
            type="submit"
            variant="secondary"
          >
            {t('nameSave')}
          </Button>
        </form>
        <p className="text-body-small text-content">{t('nameHint')}</p>

        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor={emailId}>{t('emailLabel')}</Label>
          <Input
            className="max-w-full"
            disabled
            id={emailId}
            readOnly
            value={email}
          />
          <p className="text-body-small text-content">{t('emailHint')}</p>
        </div>
      </section>
    </div>
  )
}
