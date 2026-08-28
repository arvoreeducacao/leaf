'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { HierarchyIcon, PageIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { listMoveTargets, moveDocument } from '@/lib/document-actions'
import type { MoveTarget } from '@/lib/document-actions'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { cn } from '@/shared/utils'

type Props = Readonly<{
  documentId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}>

const title = 'Mover para outra página'

const description = 'Escolha em qual página este documento vai ficar'

const rootValue = 'raiz'

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

export function MoveDocumentDialog({ documentId, open, onOpenChange }: Props) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const searchId = useId()

  const [targets, setTargets] = useState<Array<MoveTarget> | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(rootValue)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    const result = await listMoveTargets(documentId)

    if (result.ok) {
      setTargets(result.targets)
      setSelected(result.currentParentId ?? rootValue)
    } else {
      setLoadError(result.error)
    }

    setLoading(false)
  }, [documentId])

  useEffect(() => {
    if (!open) {
      return
    }

    setQuery('')
    void load()
  }, [open, load])

  const filtered = useMemo(() => {
    if (!targets) {
      return []
    }

    const term = normalize(query.trim())

    if (term.length === 0) {
      return targets
    }

    return targets.filter((target) => normalize(target.path).includes(term))
  }, [targets, query])

  async function submit() {
    setPending(true)
    const result = await moveDocument(
      documentId,
      selected === rootValue ? null : selected,
    )
    setPending(false)

    if (!result.ok) {
      toast.error(result.error)

      return
    }

    toast.success('Documento movido')
    onOpenChange(false)
    router.refresh()
  }

  const body = (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={searchId}>Buscar página de destino</Label>
        <Input
          autoComplete="off"
          id={searchId}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Digite parte do nome"
          type="search"
          value={query}
        />
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ) : null}

      {loadError ? (
        <div className="flex flex-col items-start gap-2" role="alert">
          <p className="text-body-small text-error-700">{loadError}</p>
          <Button onClick={() => void load()} type="button" variant="secondary">
            Tentar de novo
          </Button>
        </div>
      ) : null}

      {!loading && !loadError ? (
        <RadioGroup
          aria-label="Destino do documento"
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
          onValueChange={setSelected}
          value={selected}
        >
          <MoveOption
            checked={selected === rootValue}
            hint="Fora de qualquer página"
            icon={<HierarchyIcon aria-hidden="true" className="size-4 shrink-0" />}
            label="Raiz"
            value={rootValue}
          />

          {filtered.map((target) => (
            <MoveOption
              checked={selected === target.id}
              hint={target.path}
              icon={<PageIcon aria-hidden="true" className="size-4 shrink-0" />}
              key={target.id}
              label={target.title}
              value={target.id}
            />
          ))}

          {targets?.length === 0 ? (
            <p className="px-3 py-2 text-body-small text-gray-700">
              Você ainda não tem outra página para receber este documento
            </p>
          ) : null}

          {filtered.length === 0 && query.trim().length > 0 ? (
            <p className="px-3 py-2 text-body-small text-gray-700">
              Nenhuma página com esse nome
            </p>
          ) : null}
        </RadioGroup>
      ) : null}
    </div>
  )

  const actions = (
    <>
      <Button
        className="w-full tablet:w-auto"
        disabled={pending}
        onClick={() => onOpenChange(false)}
        type="button"
        variant="secondary"
      >
        Cancelar
      </Button>
      <Button
        aria-busy={pending}
        className="w-full tablet:w-auto"
        disabled={pending || loading || loadError !== null}
        onClick={() => void submit()}
        type="button"
      >
        Mover
      </Button>
    </>
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
          <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-6">
            {body}
            <div className="flex flex-col gap-2">{actions}</div>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden tablet:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-gray-700">
            {description}
          </DialogDescription>
        </DialogHeader>
        {body}
        <DialogFooter className="shrink-0">{actions}</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MoveOption({
  value,
  label,
  hint,
  icon,
  checked,
}: Readonly<{
  value: string
  label: string
  hint: string
  icon: React.ReactNode
  checked: boolean
}>) {
  return (
    <label
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-3 rounded-large px-3 py-2 transition-colors',
        'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gray-900 has-[:focus-visible]:outline-offset-2',
        checked ? 'bg-primary-100' : 'hover:bg-gray-100',
      )}
    >
      <RadioGroupItem value={value} />
      {icon}
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            'truncate text-body-small text-gray-900',
            checked ? 'font-bold' : '',
          )}
        >
          {label}
        </span>
        {hint === label ? null : (
          <span className="truncate text-body-small text-gray-700">{hint}</span>
        )}
      </span>
    </label>
  )
}
