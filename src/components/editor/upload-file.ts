import { toast } from 'sonner'

async function readErrorMessage(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { error?: unknown }

    return typeof data.error === 'string' ? data.error : fallback
  } catch {
    return fallback
  }
}

export async function uploadEditorFile(
  file: File,
  fallbackMessage: string,
): Promise<string> {
  const body = new FormData()
  body.append('file', file)

  let response: Response

  try {
    response = await fetch('/api/uploads', { method: 'POST', body })
  } catch {
    toast.error(fallbackMessage)
    throw new Error(fallbackMessage)
  }

  if (!response.ok) {
    const message = await readErrorMessage(response, fallbackMessage)
    toast.error(message)
    throw new Error(message)
  }

  const data = (await response.json()) as { url?: unknown }

  if (typeof data.url !== 'string') {
    toast.error(fallbackMessage)
    throw new Error(fallbackMessage)
  }

  return data.url
}
