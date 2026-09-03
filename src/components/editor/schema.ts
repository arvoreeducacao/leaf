import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core'
import { withMultiColumn } from '@blocknote/xl-multi-column'

import { createCalloutBlock } from './callout-block'
import { createDatabaseBlock } from './database-block'
import { createEmbedBlock } from './embed-block'

export const leafSchema = withMultiColumn(
  BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      callout: createCalloutBlock(),
      database: createDatabaseBlock(),
      embed: createEmbedBlock(),
    },
  }),
)

export type LeafSchema = typeof leafSchema
