export function authorNameOf(name: string | null, email: string | null) {
  const trimmed = name?.trim() ?? ''

  if (trimmed.length > 0) {
    return trimmed
  }

  return email && email.length > 0 ? email : null
}
