import {
  BlockNoteSchema,
  createBlockSpec,
  defaultBlockSpecs,
} from '@blocknote/core'

import { calloutConfig } from './callout-config'

const createServerCalloutBlock = createBlockSpec(calloutConfig, {
  render: () => {
    const dom = document.createElement('aside')
    const contentDOM = document.createElement('div')

    dom.appendChild(contentDOM)

    return { dom, contentDOM }
  },
  toExternalHTML: () => {
    const dom = document.createElement('blockquote')
    const contentDOM = document.createElement('p')

    dom.appendChild(contentDOM)

    return { dom, contentDOM }
  },
})

export const leafServerSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    callout: createServerCalloutBlock(),
  },
})
