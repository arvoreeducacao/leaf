'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useId, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { uploadEditorFile } from '@/components/editor/upload-file'
import { TrashIcon, UploadIcon } from '@/components/icons'
import {
  SettingsRow,
  SettingsSection,
} from '@/components/settings/settings-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    <>
      <SettingsSection>
        <div className="flex flex-wrap items-center gap-4">
          <UserAvatar
            className="size-16"
            email={email}
            image={currentImage}
            name={currentName}
            userId={userId}
          />
          <div className="flex min-w-0 flex-col items-start gap-1">
            <p className="max-w-prose-leaf text-caption text-content">
              {currentImage ? t('avatarHintChosen') : t('avatarHint')}
            </p>
            {currentImage ? (
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
            ) : null}
          </div>
        </div>

        <Tabs className="gap-3" defaultValue="gallery">
          <TabsList className="h-9 min-w-0 gap-4 overflow-x-auto">
            <TabsTrigger value="gallery">{t('tabGallery')}</TabsTrigger>
            <TabsTrigger value="upload">{t('tabUpload')}</TabsTrigger>
            <TabsTrigger value="link">{t('tabLink')}</TabsTrigger>
          </TabsList>

          <TabsContent value="gallery">
            <ul className="grid grid-cols-6 gap-2 tablet:grid-cols-8">
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
                className="w-full tablet:w-auto tablet:self-start"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                type="button"
                variant="secondary"
              >
                <UploadIcon aria-hidden="true" />
                {t('uploadButton')}
              </Button>
              <p className="text-caption text-content">{t('uploadHint')}</p>
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
      </SettingsSection>

      <SettingsSection>
        <SettingsRow
          description={t('nameHint')}
          htmlFor={nameId}
          title={t('nameLabel')}
        >
          <form
            className="flex w-full shrink-0 flex-col gap-2 tablet:w-80 tablet:flex-row"
            onSubmit={submitName}
          >
            <Input
              className="max-w-full"
              disabled={pending}
              id={nameId}
              maxLength={MAX_DISPLAY_NAME_LENGTH}
              onChange={(event) => setCurrentName(event.target.value)}
              value={currentName}
            />
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
        </SettingsRow>

        <SettingsRow
          control={
            <Input
              className="w-full tablet:w-80"
              disabled
              id={emailId}
              readOnly
              value={email}
            />
          }
          description={t('emailHint')}
          htmlFor={emailId}
          title={t('emailLabel')}
        />
      </SettingsSection>
    </>
  )
}
