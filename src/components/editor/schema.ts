import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
} from '@blocknote/core'
import { withMultiColumn } from '@blocknote/xl-multi-column'

import { createCalloutBlock } from './callout-block'
import { createDatabaseBlock } from './database-block'
import { createEmbedBlock } from './embed-block'
import { mentionInlineContent } from './mention-inline'

export const leafSchema = withMultiColumn(
  BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      callout: createCalloutBlock(),
      database: createDatabaseBlock(),
      embed: createEmbedBlock(),
    },
    inlineContentSpecs: {
      ...defaultInlineContentSpecs,
      mention: mentionInlineContent,
    },
  }),
)

export type LeafSchema = typeof leafSchema
