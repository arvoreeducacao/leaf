import type { ImportEvent } from '@/lib/notion/import'

export const IMPORT_KEEPALIVE_MS = 20_000

export const importStreamHeaders = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/x-ndjson; charset=utf-8',
  'X-Accel-Buffering': 'no',
} as const

type Options = Readonly<{
  failure: string
  keepAliveMs?: number
  onDone?: () => void
}>

export function importEventStream(
  events: AsyncIterable<ImportEvent>,
  options: Options,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const keepAliveMs = options.keepAliveMs ?? IMPORT_KEEPALIVE_MS

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(event: ImportEvent) {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }

      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode('\n'))
      }, keepAliveMs)

      try {
        for await (const event of events) {
          send(event)

          if (event.type === 'done') {
            options.onDone?.()
          }
        }
      } catch {
        send({ error: options.failure, type: 'error' })
      } finally {
        clearInterval(keepAlive)
        controller.close()
      }
    },
  })
}
