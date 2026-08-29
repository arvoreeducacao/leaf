import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'

import { isAppLocale, localeCookieName, matchLocale } from './config'

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const stored = cookieStore.get(localeCookieName)?.value
  const locale = isAppLocale(stored)
    ? stored
    : matchLocale((await headers()).get('accept-language'))

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
