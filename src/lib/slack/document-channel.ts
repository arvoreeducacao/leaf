import { getFormSlack } from '@/lib/form-webhooks'

import type { SlackThreadLink } from './threads'
import { getThreadOfDocument } from './threads'

export type DocumentSlackChannel = Readonly<{
  name: string | null
  url: string
  pushesComments: boolean
}>

export function threadPermalink(link: SlackThreadLink): string {
  const anchor = link.messageTs.replace('.', '')

  return `https://slack.com/archives/${link.channelId}/p${anchor}`
}

export async function getDocumentSlackChannel(
  documentId: string,
): Promise<DocumentSlackChannel | null> {
  const thread = await getThreadOfDocument(documentId)

  if (!thread) {
    return null
  }

  const form = thread.viewId ? await getFormSlack(thread.viewId) : null

  return {
    name: form?.channelName ?? null,
    pushesComments: form === null || form.pushComments,
    url: threadPermalink(thread),
  }
}
