import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core'

import { createCalloutBlock } from './callout-block'

export const leafSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    callout: createCalloutBlock(),
  },
})

export type LeafSchema = typeof leafSchema
