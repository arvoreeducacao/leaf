import { defaultProps } from '@blocknote/core'

export const calloutConfig = {
  type: 'callout' as const,
  content: 'inline' as const,
  propSchema: {
    backgroundColor: defaultProps.backgroundColor,
    textColor: defaultProps.textColor,
    textAlignment: defaultProps.textAlignment,
    icon: { default: '' },
  },
}
