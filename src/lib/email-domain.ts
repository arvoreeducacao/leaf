export const emailDomainErrorCode = 'EMAIL_DOMAIN_NOT_ALLOWED'

export type EmailDomainPolicy = Readonly<{
  active: boolean
  domains: ReadonlyArray<string>
  primaryDomain: string | null
}>

export function parseAllowedDomains(
  raw: string | null | undefined,
): ReadonlyArray<string> {
  const parsed = (raw ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase().replace(/^@+/, ''))
    .filter((entry) => entry.length > 0)

  return [...new Set(parsed)]
}

export function emailDomainPolicy(
  raw: string | null | undefined = process.env.LEAF_ALLOWED_EMAIL_DOMAINS,
): EmailDomainPolicy {
  const domains = parseAllowedDomains(raw)

  return {
    active: domains.length > 0,
    domains,
    primaryDomain: domains[0] ?? null,
  }
}

export function isEmailDomainAllowed(
  email: unknown,
  domains: ReadonlyArray<string>,
): boolean {
  if (domains.length === 0) {
    return true
  }

  if (typeof email !== 'string') {
    return false
  }

  const normalized = email.trim().toLowerCase()
  const separator = normalized.lastIndexOf('@')

  if (separator < 1 || separator === normalized.length - 1) {
    return false
  }

  return domains.includes(normalized.slice(separator + 1))
}
