import { defaultProps } from '@blocknote/core'
import { createReactBlockSpec } from '@blocknote/react'

import { IdeaIcon } from '@/components/icons'

export const createCalloutBlock = createReactBlockSpec(
  {
    type: 'callout',
    content: 'inline',
    propSchema: {
      backgroundColor: defaultProps.backgroundColor,
      textColor: defaultProps.textColor,
      textAlignment: defaultProps.textAlignment,
    },
  },
  {
    render: ({ contentRef }) => (
      <aside className="flex w-full items-start gap-3 rounded-large bg-gray-100 px-4 py-3 text-body-medium text-gray-900">
        <IdeaIcon
          aria-hidden="true"
          className="mt-1 size-5 shrink-0 text-gray-700"
        />
        <div className="min-w-0 flex-1" ref={contentRef} />
      </aside>
    ),
    toExternalHTML: ({ contentRef }) => (
      <blockquote>
        <p ref={contentRef} />
      </blockquote>
    ),
  }
)
