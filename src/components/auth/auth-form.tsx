'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'

import { AlertIcon, LeafIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth-client'
import { emailDomainErrorCode } from '@/lib/email-domain'

type Mode = 'login' | 'signup'

type Props = Readonly<{
  mode: Mode
  restrictedDomain: string | null
}>

const switchHref = {
  login: '/signup',
  signup: '/login',
} as const

export function AuthForm({ mode, restrictedDomain }: Props) {
  const t = useTranslations('auth')
  const router = useRouter()
  const nameId = useId()
  const emailId = useId()
  const emailHintId = useId()
  const passwordId = useId()
  const passwordHintId = useId()
  const errorId = useId()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (mode === 'signup' && password.length < 8) {
      setError(t('passwordTooShort'))
      return
    }

    setPending(true)

    const result =
      mode === 'signup'
        ? await authClient.signUp.email({
            name: name.trim() || email.split('@')[0],
            email: email.trim().toLowerCase(),
            password,
          })
        : await authClient.signIn.email({
            email: email.trim().toLowerCase(),
            password,
          })

    if (result.error) {
      setPending(false)
      setError(
        result.error.code === emailDomainErrorCode
          ? t('domainRestricted', { domain: restrictedDomain ?? '' })
          : t(mode === 'signup' ? 'signupFailed' : 'loginFailed'),
      )
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-surface-sunken px-4 py-8">
      <div className="w-full max-w-110 rounded-xlarge border border-line-subtle bg-surface-card p-6 shadow-down-medium tablet:p-8">
        <div className="flex items-center gap-2 text-brand">
          <LeafIcon aria-hidden="true" className="size-6" />
          <span className="font-bold text-heading-medium text-content-strong">
            Leaf
          </span>
        </div>

        <h1 className="mt-6 font-bold text-heading-large text-content-strong">
          {t(mode === 'signup' ? 'signupTitle' : 'loginTitle')}
        </h1>
        <p className="mt-2 text-body-small text-content">
          {t(mode === 'signup' ? 'signupSubtitle' : 'loginSubtitle')}
        </p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
          {mode === 'signup' ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor={nameId}>{t('nameLabel')}</Label>
              <Input
                autoComplete="name"
                className="max-w-full"
                disabled={pending}
                id={nameId}
                name="name"
                onChange={(event) => setName(event.target.value)}
                type="text"
                value={name}
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor={emailId}>{t('emailLabel')}</Label>
            <Input
              aria-describedby={
                [restrictedDomain ? emailHintId : null, error ? errorId : null]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              aria-invalid={error ? true : undefined}
              autoComplete="email"
              className="max-w-full"
              disabled={pending}
              id={emailId}
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
            {restrictedDomain ? (
              <p className="text-body-small text-content" id={emailHintId}>
                {t('domainHint', { domain: restrictedDomain })}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={passwordId}>{t('passwordLabel')}</Label>
            <Input
              aria-describedby={
                [mode === 'signup' ? passwordHintId : null, error ? errorId : null]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              aria-invalid={error ? true : undefined}
              autoComplete={
                mode === 'signup' ? 'new-password' : 'current-password'
              }
              className="max-w-full"
              disabled={pending}
              id={passwordId}
              minLength={8}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            {mode === 'signup' ? (
              <p className="text-body-small text-content" id={passwordHintId}>
                {t('passwordHint')}
              </p>
            ) : null}
          </div>

          {error ? (
            <p
              className="flex items-start gap-2 rounded-large bg-danger-surface p-3 text-body-small text-danger"
              id={errorId}
              role="alert"
            >
              <AlertIcon aria-hidden="true" className="mt-1 size-4 shrink-0" />
              {error}
            </p>
          ) : null}

          <Button
            aria-busy={pending}
            className="w-full"
            disabled={pending}
            type="submit"
          >
            {t(mode === 'signup' ? 'signupSubmit' : 'loginSubmit')}
          </Button>
        </form>

        <p className="mt-6 text-body-small text-content">
          {t(mode === 'signup' ? 'signupSwitchText' : 'loginSwitchText')}{' '}
          <Link
            className="font-bold text-link underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
            href={switchHref[mode]}
          >
            {t(mode === 'signup' ? 'signupSwitchLabel' : 'loginSwitchLabel')}
          </Link>
        </p>
      </div>
    </main>
  )
}
