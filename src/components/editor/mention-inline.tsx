import { createReactInlineContentSpec } from '@blocknote/react'

import { mentionClassName, mentionConfig, mentionLabel } from './mention-config'

export const mentionInlineContent = createReactInlineContentSpec(
  mentionConfig,
  {
    render: ({ inlineContent }) => (
      <span
        className={mentionClassName}
        data-mention-id={inlineContent.props.mentionId}
        data-user-id={inlineContent.props.userId}
      >
        {mentionLabel(inlineContent.props.name)}
      </span>
    ),
    toExternalHTML: ({ inlineContent }) => (
      <span data-user-id={inlineContent.props.userId}>
        {mentionLabel(inlineContent.props.name)}
      </span>
    ),
  },
)
