export const databaseConfig = {
  type: 'database' as const,
  content: 'none' as const,
  propSchema: {
    databaseId: { default: '' },
  },
}
