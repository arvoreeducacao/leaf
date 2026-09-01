import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core'

import { createCalloutBlock } from './callout-block'
import { createDatabaseBlock } from './database-block'

export const leafSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    callout: createCalloutBlock(),
    database: createDatabaseBlock(),
  },
})

export type LeafSchema = typeof leafSchema
