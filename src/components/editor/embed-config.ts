export const embedConfig = {
  type: 'embed' as const,
  content: 'none' as const,
  propSchema: {
    url: { default: '' },
    caption: { default: '' },
  },
}
