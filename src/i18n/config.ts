export const locales = ['pt-BR', 'en-US'] as const

export type AppLocale = (typeof locales)[number]

export const defaultLocale: AppLocale = 'pt-BR'

export const localeCookieName = 'locale'

export const localeCookieMaxAge = 60 * 60 * 24 * 365

export function isAppLocale(value: string | undefined): value is AppLocale {
  return locales.includes(value as AppLocale)
}

export function matchLocale(header: string | null): AppLocale {
  if (!header) {
    return defaultLocale
  }

  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';')
      const quality = params
        .map((param) => param.trim())
        .find((param) => param.startsWith('q='))

      return {
        tag: tag.trim().toLowerCase(),
        quality: quality ? Number(quality.slice(2)) : 1,
      }
    })
    .filter((entry) => entry.tag.length > 0 && !Number.isNaN(entry.quality))
    .sort((a, b) => b.quality - a.quality)

  for (const entry of ranked) {
    const match = locales.find(
      (locale) =>
        locale.toLowerCase() === entry.tag ||
        locale.slice(0, 2) === entry.tag.slice(0, 2),
    )

    if (match) {
      return match
    }
  }

  return defaultLocale
}
