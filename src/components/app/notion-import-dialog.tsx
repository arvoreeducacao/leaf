'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { AlertIcon, CheckCircleIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import type { ImportEvent, ImportSummary } from '@/lib/notion/import'
import { useIsMobile } from '@/shared/hooks/use-mobile'

type Props = Readonly<{
  file: File | null
  onOpenChange: (open: boolean) => void
}>

type Progress = Readonly<{
  phase: 'assets' | 'pages'
  done: number
  total: number
}>

const title = 'Importar do Notion'

const description = 'As páginas do zip viram documentos com a mesma hierarquia'

function plural(total: number, one: string, many: string) {
  return `${total} ${total === 1 ? one : many}`
}

const phaseLabels: Record<Progress['phase'], string> = {
  assets: 'Enviando imagens e anexos',
  pages: 'Criando páginas',
}

export function NotionImportDialog({ file, onOpenChange }: Props) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const startedFor = useRef<File | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async (target: File) => {
      const controller = new AbortController()
      abortRef.current = controller

      setRunning(true)
      setProgress(null)
      setSummary(null)
      setError(null)

      const body = new FormData()
      body.append('file', target)

      try {
        const response = await fetch('/api/import/notion', {
          body,
          method: 'POST',
          signal: controller.signal,
        })

        if (!response.ok || !response.body) {
          const payload: unknown = await response.json().catch(() => null)
          const message =
            payload && typeof payload === 'object' && 'error' in payload
              ? String((payload as { error: unknown }).error)
              : 'Não foi possível importar o arquivo'

          setError(message)
          setRunning(false)

          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (line.trim().length === 0) {
              continue
            }

            const event = JSON.parse(line) as ImportEvent

            if (event.type === 'progress') {
              setProgress({
                done: event.done,
                phase: event.phase,
                total: event.total,
              })
            }

            if (event.type === 'done') {
              setSummary(event.summary)
              router.refresh()
            }

            if (event.type === 'error') {
              setError(event.error)
            }
          }
        }
      } catch {
        setError(
          controller.signal.aborted
            ? 'Importação cancelada. As páginas criadas até aqui continuam na sua lista.'
            : 'Não foi possível importar o arquivo',
        )
      } finally {
        setRunning(false)
        router.refresh()
      }
    },
    [router],
  )

  useEffect(() => {
    if (!file || startedFor.current === file) {
      return
    }

    startedFor.current = file
    void run(file)
  }, [file, run])

  const percent =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0

  const body = (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      {running || (!summary && !error) ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-body-small text-gray-900">
              {progress ? phaseLabels[progress.phase] : 'Lendo o arquivo'}
            </span>
            {progress ? (
              <span className="text-caption text-gray-700">
                {progress.done} de {progress.total}
              </span>
            ) : null}
          </div>
          <div
            aria-label="Progresso da importação"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={percent}
            className="h-2 w-full overflow-hidden rounded-pill bg-gray-200"
            role="progressbar"
          >
            <div
              className="h-full rounded-pill bg-primary-800 transition-all duration-200 motion-reduce:transition-none"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      ) : null}

      {summary ? (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-body-small text-gray-900">
            <CheckCircleIcon
              aria-hidden="true"
              className="size-4 shrink-0 text-success-600"
            />
            {plural(summary.pages, 'página criada', 'páginas criadas')} e{' '}
            {plural(summary.assets, 'arquivo enviado', 'arquivos enviados')}
          </p>

          {summary.warnings.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-large bg-warning-50 p-4">
              <p className="flex items-center gap-2 font-bold text-body-small text-gray-900">
                <AlertIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-warning-800"
                />
                Avisos da importação
              </p>
              <ul className="flex list-disc flex-col gap-1 ps-4">
                {summary.warnings.map((warning) => (
                  <li className="text-body-small text-gray-700" key={warning}>
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p
          className="flex items-start gap-2 text-body-small text-error-700"
          role="alert"
        >
          <AlertIcon aria-hidden="true" className="mt-1 size-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <span aria-live="polite" className="sr-only">
        {summary
          ? `Importação concluída com ${summary.pages} páginas`
          : error
            ? `Erro na importação: ${error}`
            : ''}
      </span>
    </div>
  )

  const actions = summary?.rootId ? (
    <Button
      className="w-full tablet:w-auto"
      onClick={() => {
        onOpenChange(false)
        router.push(`/doc/${summary.rootId}`)
      }}
      type="button"
    >
      Abrir documento
    </Button>
  ) : running ? (
    <Button
      className="w-full tablet:w-auto"
      onClick={() => abortRef.current?.abort()}
      type="button"
      variant="secondary"
    >
      Cancelar importação
    </Button>
  ) : error && file ? (
    <Button
      className="w-full tablet:w-auto"
      onClick={() => void run(file)}
      type="button"
      variant="secondary"
    >
      Tentar de novo
    </Button>
  ) : null

  if (isMobile) {
    return (
      <Sheet onOpenChange={onOpenChange} open={file !== null}>
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
            {actions ? <div className="flex flex-col gap-2">{actions}</div> : null}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={file !== null}>
      <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-gray-700">
            {description}
          </DialogDescription>
        </DialogHeader>
        {body}
        {actions ? (
          <DialogFooter className="shrink-0">{actions}</DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
