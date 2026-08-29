'use server'

import { cookies } from 'next/headers'

import {
  isAppLocale,
  localeCookieMaxAge,
  localeCookieName,
} from '@/i18n/config'

export async function setUserLocale(locale: string) {
  if (!isAppLocale(locale)) {
    return
  }

  const cookieStore = await cookies()

  cookieStore.set(localeCookieName, locale, {
    maxAge: localeCookieMaxAge,
    path: '/',
    sameSite: 'lax',
  })
}
