import { toast } from 'sonner'

const fallbackMessage = 'Não foi possível enviar a imagem. Tente de novo.'

async function readErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as { error?: unknown }

    return typeof data.error === 'string' ? data.error : fallbackMessage
  } catch {
    return fallbackMessage
  }
}

export async function uploadEditorFile(file: File): Promise<string> {
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
    const message = await readErrorMessage(response)
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
