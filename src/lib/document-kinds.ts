import type { Document } from '@/db/schema'

export const UNLISTED_DOCUMENT_KINDS: ReadonlyArray<Document['kind']> = [
  'row',
  'template',
]
