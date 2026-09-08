const canonicalSourceUrl = 'https://github.com/arvoreeducacao/leaf'

export function sourceUrl(): string {
  return process.env.NEXT_PUBLIC_LEAF_SOURCE_URL?.trim() || canonicalSourceUrl
}
