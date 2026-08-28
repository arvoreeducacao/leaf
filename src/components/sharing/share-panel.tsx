'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { toast } from 'sonner'

import { ClipboardIcon, GlobeIcon, TrashIcon } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ButtonIcon } from '@/components/ui/button-icon'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import type { ShareRole } from '@/db/schema'
import {
  disablePublicLink,
  enablePublicLink,
  inviteToDocument,
  loadShareState,
  removeShare,
  updateShareRole,
} from '@/lib/share-actions'
import type {
  SharePerson,
  ShareResult,
  ShareState,
} from '@/lib/share-actions'

type Props = Readonly<{
  documentId: string
  canManage: boolean
}>

const roleLabels: Record<ShareRole, string> = {
  viewer: 'Pode ver',
  editor: 'Pode editar',
}

function publicUrlFor(token: string) {
  if (typeof window === 'undefined') {
    return `/share/${token}`
  }

  return `${window.location.origin}/share/${token}`
}

export function SharePanel({ documentId, canManage }: Props) {
  const emailFieldId = useId()
  const roleFieldId = useId()
  const inviteErrorId = useId()
  const publicSwitchId = useId()
  const publicLinkId = useId()

  const [state, setState] = useState<ShareState | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<ShareRole>('viewer')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    const result = await loadShareState(documentId)

    if (result.ok) {
      setState(result.state)
    } else {
      setLoadError(result.error)
    }

    setLoading(false)
  }, [documentId])

  useEffect(() => {
    void load()
  }, [load])

  async function run(action: () => Promise<ShareResult>, success: string) {
    setPending(true)
    const result = await action()
    setPending(false)

    if (!result.ok) {
      toast.error(result.error)

      return result
    }

    setState(result.state)
    setStatus(success)

    return result
  }

  async function submitInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setInviteError(null)

    const email = inviteEmail.trim()

    if (email.length === 0) {
      setInviteError('Digite um email válido.')

      return
    }

    setPending(true)
    const result = await inviteToDocument(documentId, email, inviteRole)
    setPending(false)

    if (!result.ok) {
      setInviteError(result.error)

      return
    }

    setState(result.state)
    setInviteEmail('')
    setStatus('Convite enviado')
    toast.success('Convite enviado')
  }

  async function removePerson(person: SharePerson) {
    const result = await run(
      () => removeShare(documentId, person.id),
      'Acesso removido',
    )

    if (!result.ok) {
      return
    }

    toast.success('Acesso removido', {
      action: {
        label: 'Desfazer',
        onClick: () => {
          void run(
            () => inviteToDocument(documentId, person.email, person.role),
            'Acesso restaurado',
          )
        },
      },
    })
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copiado')
    } catch {
      toast.error('Não foi possível copiar o link')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4" data-testid="share-panel-loading">
        {canManage ? <Skeleton className="h-12 w-full" /> : null}
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-10 w-2/3" />
        <span className="sr-only">Carregando compartilhamento</span>
      </div>
    )
  }

  if (loadError || !state) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-body-small text-gray-700" role="alert">
          {loadError ?? 'Não foi possível carregar o compartilhamento.'}
        </p>
        <Button onClick={() => void load()} type="button" variant="secondary">
          Tentar de novo
        </Button>
      </div>
    )
  }

  const isOwner = state.role === 'owner'
  const publicUrl = state.publicToken ? publicUrlFor(state.publicToken) : null

  return (
    <div className="flex flex-col gap-6">
      <span aria-live="polite" className="sr-only">
        {status}
      </span>

      {isOwner ? (
        <form className="flex flex-col gap-3" onSubmit={submitInvite}>
          <div className="flex flex-col gap-3 tablet:flex-row tablet:items-end">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Label htmlFor={emailFieldId}>Email</Label>
              <Input
                aria-describedby={inviteError ? inviteErrorId : undefined}
                aria-invalid={inviteError ? true : undefined}
                autoComplete="email"
                className="max-w-full"
                disabled={pending}
                id={emailFieldId}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="nome@escola.com.br"
                type="email"
                value={inviteEmail}
              />
            </div>
            <div className="flex flex-col gap-2 tablet:w-[180px]">
              <Label htmlFor={roleFieldId}>Papel</Label>
              <Select
                disabled={pending}
                onValueChange={(value) => setInviteRole(value as ShareRole)}
                value={inviteRole}
              >
                <SelectTrigger id={roleFieldId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">{roleLabels.viewer}</SelectItem>
                  <SelectItem value="editor">{roleLabels.editor}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {inviteError ? (
            <p
              className="rounded-large bg-error-50 p-3 text-body-small text-error-700"
              id={inviteErrorId}
              role="alert"
            >
              {inviteError}
            </p>
          ) : null}

          <Button
            aria-busy={pending}
            className="w-full tablet:w-auto tablet:self-end"
            disabled={pending}
            type="submit"
          >
            Convidar
          </Button>
        </form>
      ) : null}

      {isOwner ? <Separator /> : null}

      <section className="flex flex-col gap-3">
        <h3 className="font-bold text-body-small text-gray-700">Com acesso</h3>

        <ul className="flex flex-col gap-2">
          <li className="flex min-w-0 items-center gap-2 py-1">
            <span
              className="min-w-0 flex-1 truncate text-body-small text-gray-900"
              title={state.ownerEmail}
            >
              {state.ownerEmail}
            </span>
            <Badge variant="info">Dono</Badge>
          </li>

          {state.people.map((person) => (
            <li
              className="flex min-w-0 flex-wrap items-center gap-2 py-1"
              key={person.id}
            >
              <span
                className="min-w-0 flex-1 truncate text-body-small text-gray-900"
                title={person.email}
              >
                {person.email}
              </span>

              {isOwner ? (
                <>
                  <Select
                    disabled={pending}
                    onValueChange={(value) =>
                      void run(
                        () => updateShareRole(documentId, person.id, value),
                        'Papel atualizado',
                      )
                    }
                    value={person.role}
                  >
                    <SelectTrigger
                      aria-label={`Papel de ${person.email}`}
                      className="h-12 w-[160px] shrink-0 desktop:h-10"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">
                        {roleLabels.viewer}
                      </SelectItem>
                      <SelectItem value="editor">
                        {roleLabels.editor}
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <ButtonIcon
                    aria-label={`Remover acesso de ${person.email}`}
                    disabled={pending}
                    onClick={() => void removePerson(person)}
                    size="large"
                    variant="ghost"
                  >
                    <TrashIcon aria-hidden="true" />
                  </ButtonIcon>
                </>
              ) : (
                <Badge variant="info">{roleLabels[person.role]}</Badge>
              )}
            </li>
          ))}
        </ul>

        {state.people.length === 0 ? (
          <p className="text-body-small text-gray-700">
            Ninguém foi convidado ainda
          </p>
        ) : null}

        {isOwner ? null : (
          <p className="text-body-small text-gray-700">
            Só o dono pode alterar o compartilhamento
          </p>
        )}
      </section>

      {isOwner ? (
        <>
          <Separator />

          <section className="flex flex-col gap-3">
            <div className="flex min-h-11 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <GlobeIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-gray-600"
                />
                <Label
                  className="font-bold text-body-small text-gray-900"
                  htmlFor={publicSwitchId}
                >
                  Ativar link público
                </Label>
              </div>
              <Switch
                checked={state.publicToken !== null}
                disabled={pending}
                id={publicSwitchId}
                onCheckedChange={(checked) =>
                  void run(
                    () =>
                      checked
                        ? enablePublicLink(documentId)
                        : disablePublicLink(documentId),
                    checked ? 'Link público ativado' : 'Link público desativado',
                  )
                }
              />
            </div>

            <p className="text-body-small text-gray-700">
              Qualquer pessoa com o link pode ver este documento. Desativar
              invalida o link atual para sempre
            </p>

            {publicUrl ? (
              <div className="flex flex-col gap-2 tablet:flex-row tablet:items-end">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Label htmlFor={publicLinkId}>Link público</Label>
                  <Input
                    className="max-w-full"
                    id={publicLinkId}
                    onFocus={(event) => event.currentTarget.select()}
                    readOnly
                    value={publicUrl}
                  />
                </div>
                <Button
                  className="w-full tablet:w-auto"
                  onClick={() => void copyLink(publicUrl)}
                  type="button"
                  variant="secondary"
                >
                  <ClipboardIcon aria-hidden="true" />
                  Copiar
                </Button>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  )
}
