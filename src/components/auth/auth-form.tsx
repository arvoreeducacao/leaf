'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'

import { AlertIcon, LeafIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth-client'

type Mode = 'login' | 'signup'

type Props = Readonly<{ mode: Mode }>

const copy = {
  login: {
    title: 'Entrar na sua conta',
    subtitle: 'Use o email e a senha da sua conta',
    submit: 'Entrar',
    submitting: 'Entrando',
    switchText: 'Ainda não tem conta?',
    switchLabel: 'Criar conta',
    switchHref: '/signup',
  },
  signup: {
    title: 'Criar sua conta',
    subtitle: 'Comece a escrever seus documentos',
    submit: 'Criar conta',
    submitting: 'Criando conta',
    switchText: 'Já tem conta?',
    switchLabel: 'Entrar',
    switchHref: '/login',
  },
} as const

export function AuthForm({ mode }: Props) {
  const router = useRouter()
  const nameId = useId()
  const emailId = useId()
  const passwordId = useId()
  const errorId = useId()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const texts = copy[mode]

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (mode === 'signup' && password.length < 8) {
      setError('A senha precisa de pelo menos 8 caracteres.')
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
        mode === 'signup'
          ? 'Não foi possível criar a conta. Confira os dados e tente de novo.'
          : 'Email ou senha incorretos.',
      )
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-gray-100 px-4 py-8">
      <div className="w-full max-w-110 rounded-xlarge border border-alpha-100 bg-white p-6 shadow-down-medium tablet:p-8">
        <div className="flex items-center gap-2 text-primary-700">
          <LeafIcon aria-hidden="true" className="size-6" />
          <span className="font-bold text-heading-medium text-gray-900">
            Leaf
          </span>
        </div>

        <h1 className="mt-6 font-bold text-heading-large text-gray-900">
          {texts.title}
        </h1>
        <p className="mt-2 text-body-small text-gray-700">
          {texts.subtitle}
        </p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
          {mode === 'signup' ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor={nameId}>Nome (opcional)</Label>
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
            <Label htmlFor={emailId}>Email</Label>
            <Input
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
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={passwordId}>Senha</Label>
            <Input
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
              <p className="text-caption text-gray-700">
                Mínimo de 8 caracteres
              </p>
            ) : null}
          </div>

          {error ? (
            <p
              className="flex items-start gap-2 rounded-large bg-error-50 p-3 text-body-small text-error-700"
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
            {texts.submit}
          </Button>
        </form>

        <p className="mt-6 text-body-small text-gray-700">
          {texts.switchText}{' '}
          <Link
            className="font-bold text-primary-900 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-gray-900 focus-visible:outline-offset-2"
            href={texts.switchHref}
          >
            {texts.switchLabel}
          </Link>
        </p>
      </div>
    </main>
  )
}
