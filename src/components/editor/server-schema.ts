import {
  BlockNoteSchema,
  createBlockSpec,
  defaultBlockSpecs,
} from '@blocknote/core'
import { withMultiColumn } from '@blocknote/xl-multi-column'

import { calloutConfig } from './callout-config'
import { databaseConfig } from './database-config'

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

const createServerDatabaseBlock = createBlockSpec(databaseConfig, {
  render: () => {
    const dom = document.createElement('div')

    return { dom }
  },
  toExternalHTML: (block) => {
    const dom = document.createElement('p')
    const link = document.createElement('a')
    const href = `/doc/${block.props.databaseId}`

    link.setAttribute('href', href)
    link.textContent = href
    dom.appendChild(link)

    return { dom }
  },
})

export const leafServerSchema = withMultiColumn(
  BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      callout: createServerCalloutBlock(),
      database: createServerDatabaseBlock(),
    },
  }),
)
