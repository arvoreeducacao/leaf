import { createReactBlockSpec } from '@blocknote/react'

import { IdeaIcon } from '@/components/icons'

import { calloutConfig } from './callout-config'

export const createCalloutBlock = createReactBlockSpec(calloutConfig, {
  render: ({ block, contentRef }) => (
    <aside className="flex w-full items-start gap-3 rounded-medium bg-surface-subtle px-4 py-4 text-body-medium text-content-strong">
      {block.props.icon ? (
        <span aria-hidden="true" className="mt-0.5 shrink-0 leading-none">
          {block.props.icon}
        </span>
      ) : (
        <IdeaIcon
          aria-hidden="true"
          className="mt-0.5 size-4.5 shrink-0 text-content"
        />
      )}
      <div className="min-w-0 flex-1" ref={contentRef} />
    </aside>
  ),
  toExternalHTML: ({ contentRef }) => (
    <blockquote>
      <p ref={contentRef} />
    </blockquote>
  ),
})
