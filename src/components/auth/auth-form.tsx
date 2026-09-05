'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'

import { LeafMark } from '@/components/app/leaf-mark'
import { GoogleMark } from '@/components/auth/google-mark'
import { AlertIcon, FingerprintIcon, KeyholeIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth-client'
import { emailDomainErrorCode } from '@/lib/email-domain'
import { cn } from '@/shared/utils'

type Mode = 'login' | 'signup'

type Step = 'email' | 'password'

type AuthorizationContinuation = Readonly<{ redirect?: boolean; url?: string }>

type Sso = Readonly<{ providerId: string; providerName: string }>

type Props = Readonly<{
  mode: Mode
  restrictedDomain: string | null
  passwordEnabled: boolean
  googleEnabled: boolean
  sso: Sso | null
  ssoSignOutUrl?: string | null
  errorCode?: string | null
}>

const switchHref = {
  login: '/signup',
  signup: '/login',
} as const

const columns = ['grid-cols-1', 'grid-cols-2', 'grid-cols-3'] as const

export function AuthForm({
  errorCode = null,
  googleEnabled,
  mode,
  passwordEnabled,
  restrictedDomain,
  sso,
  ssoSignOutUrl = null,
}: Props) {
  const t = useTranslations('auth')
  const router = useRouter()
  const nameId = useId()
  const emailId = useId()
  const emailHintId = useId()
  const passwordId = useId()
  const passwordHintId = useId()
  const errorId = useId()

  const [step, setStep] = useState<Step>('email')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(
    errorCode === emailDomainErrorCode
      ? t('ssoDomainBlocked', { domain: restrictedDomain ?? '' })
      : errorCode
        ? t('ssoFailed')
        : null,
  )
  const [domainBlocked, setDomainBlocked] = useState(
    errorCode === emailDomainErrorCode,
  )
  const [pending, setPending] = useState(false)

  function finish(continuation: AuthorizationContinuation | null) {
    if (continuation?.redirect && continuation.url) {
      window.location.assign(continuation.url)
      return
    }

    router.push('/')
    router.refresh()
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (step === 'email') {
      setStep('password')
      return
    }

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

    finish(result.data as AuthorizationContinuation | null)
  }

  async function handleSocial(provider: string) {
    setError(null)
    setDomainBlocked(false)
    setPending(true)

    const result = await authClient.signIn.social({
      callbackURL: '/',
      errorCallbackURL: '/login',
      provider,
    })

    if (result.error) {
      setPending(false)
      setDomainBlocked(result.error.code === emailDomainErrorCode)
      setError(
        result.error.code === emailDomainErrorCode
          ? t('ssoDomainBlocked', { domain: restrictedDomain ?? '' })
          : t('ssoFailed'),
      )
    }
  }

  async function handlePasskey() {
    setError(null)
    setPending(true)

    const result = await authClient.signIn.passkey()

    if (result?.error) {
      setPending(false)
      setError(t('passkeyFailed'))
      return
    }

    finish(null)
  }

  const providers = [
    googleEnabled
      ? {
          icon: <GoogleMark className="size-5" />,
          key: 'google',
          label: 'Google',
          onSelect: () => handleSocial('google'),
        }
      : null,
    sso
      ? {
          icon: <KeyholeIcon className="size-5" />,
          key: 'sso',
          label: sso.providerName,
          onSelect: () => handleSocial(sso.providerId),
        }
      : null,
    {
      icon: <FingerprintIcon className="size-5" />,
      key: 'passkey',
      label: t('passkey'),
      onSelect: handlePasskey,
    },
  ].filter((provider) => provider !== null)

  const title = t(mode === 'signup' ? 'signupTitle' : 'loginTitle')
  const subtitle = t(mode === 'signup' ? 'signupSubtitle' : 'loginSubtitle')

  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-surface-app px-6 py-10">
      <div className="w-full max-w-80">
        <div className="flex flex-col items-center gap-3 text-center">
          <LeafMark aria-hidden="true" className="size-8 text-brand" />
          <h1 className="font-semibold text-content-strong text-heading-large">
            {title}
          </h1>
          <p className="text-body-small text-content">{subtitle}</p>
        </div>

        {passwordEnabled ? (
          <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={emailId}>{t('emailLabel')}</Label>
              <Input
                aria-describedby={
                  [
                    restrictedDomain ? emailHintId : null,
                    error ? errorId : null,
                  ]
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
                placeholder={t('emailPlaceholder')}
                required
                type="email"
                value={email}
              />
              {restrictedDomain ? (
                <p
                  className="text-caption text-content-subtle"
                  id={emailHintId}
                >
                  {t('domainHint', { domain: restrictedDomain })}
                </p>
              ) : null}
            </div>

            {step === 'password' ? (
              <>
                {mode === 'signup' ? (
                  <div className="flex flex-col gap-1.5">
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

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={passwordId}>{t('passwordLabel')}</Label>
                  <Input
                    aria-describedby={
                      [
                        mode === 'signup' ? passwordHintId : null,
                        error ? errorId : null,
                      ]
                        .filter(Boolean)
                        .join(' ') || undefined
                    }
                    aria-invalid={error ? true : undefined}
                    autoComplete={
                      mode === 'signup' ? 'new-password' : 'current-password'
                    }
                    autoFocus
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
                    <p
                      className="text-caption text-content-subtle"
                      id={passwordHintId}
                    >
                      {t('passwordHint')}
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}

            {error ? (
              <p
                className="flex items-start gap-2 rounded-large bg-danger-surface p-3 text-body-small text-danger"
                id={errorId}
                role="alert"
              >
                <AlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
            ) : null}

            <Button
              aria-busy={pending}
              className="w-full"
              disabled={pending}
              size="lg"
              type="submit"
            >
              {step === 'email'
                ? t('continue')
                : t(mode === 'signup' ? 'signupSubmit' : 'loginSubmit')}
            </Button>
          </form>
        ) : null}

        {providers.length > 0 ? (
          <>
            <div className="mt-6 flex items-center gap-3">
              <span aria-hidden="true" className="h-px flex-1 bg-line" />
              <span className="text-caption text-content-subtle">
                {passwordEnabled ? t('continueWith') : t('signInWith')}
              </span>
              <span aria-hidden="true" className="h-px flex-1 bg-line" />
            </div>

            <div
              className={cn(
                'mt-4 grid gap-2',
                columns[Math.min(providers.length, columns.length) - 1],
              )}
            >
              {providers.map((provider) => (
                <Button
                  aria-busy={pending}
                  className="h-auto flex-col gap-1.5 py-3 tablet:h-auto"
                  disabled={pending}
                  key={provider.key}
                  onClick={provider.onSelect}
                  type="button"
                  variant="outline"
                >
                  {provider.icon}
                  <span className="text-caption">{provider.label}</span>
                </Button>
              ))}
            </div>
          </>
        ) : null}

        {!passwordEnabled && error ? (
          <p
            className="mt-4 flex items-start gap-2 rounded-large bg-danger-surface p-3 text-body-small text-danger"
            id={errorId}
            role="alert"
          >
            <AlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        ) : null}

        {domainBlocked && ssoSignOutUrl ? (
          <Button asChild className="mt-2 h-10 w-full" variant="link">
            <a href={ssoSignOutUrl}>{t('ssoSwitchAccount')}</a>
          </Button>
        ) : null}

        {restrictedDomain && !passwordEnabled ? (
          <p className="mt-4 text-center text-caption text-content-subtle">
            {t('ssoDomainHint', { domain: restrictedDomain })}
          </p>
        ) : null}

        {passwordEnabled ? (
          <p className="mt-8 text-center text-body-small text-content">
            {t(mode === 'signup' ? 'signupSwitchText' : 'loginSwitchText')}{' '}
            <Link
              className="font-medium text-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
              href={switchHref[mode]}
            >
              {t(mode === 'signup' ? 'signupSwitchLabel' : 'loginSwitchLabel')}
            </Link>
          </p>
        ) : null}
      </div>
    </main>
  )
}
