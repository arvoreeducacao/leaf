import { createReactBlockSpec } from '@blocknote/react'
import dynamic from 'next/dynamic'

import { databaseConfig } from './database-config'

const DatabaseEmbed = dynamic(
  () => import('@/components/database/database-embed'),
  { ssr: false },
)

export const createDatabaseBlock = createReactBlockSpec(databaseConfig, {
  render: ({ block }) => (
    <div
      className="leaf-database-block w-full"
      contentEditable={false}
      suppressContentEditableWarning
    >
      <DatabaseEmbed databaseId={block.props.databaseId} />
    </div>
  ),
  toExternalHTML: ({ block }) => (
    <p>
      <a href={`/doc/${block.props.databaseId}`}>
        {`/doc/${block.props.databaseId}`}
      </a>
    </p>
  ),
})
