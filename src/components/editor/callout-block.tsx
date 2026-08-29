import { createReactBlockSpec } from '@blocknote/react'

import { IdeaIcon } from '@/components/icons'

import { calloutConfig } from './callout-config'

export const createCalloutBlock = createReactBlockSpec(calloutConfig, {
  render: ({ contentRef }) => (
    <aside className="flex w-full items-start gap-3 rounded-large bg-surface-subtle px-4 py-3 text-body-medium text-content-strong">
      <IdeaIcon
        aria-hidden="true"
        className="mt-1 size-5 shrink-0 text-content"
      />
      <div className="min-w-0 flex-1" ref={contentRef} />
    </aside>
  ),
  toExternalHTML: ({ contentRef }) => (
    <blockquote>
      <p ref={contentRef} />
    </blockquote>
  ),
})
