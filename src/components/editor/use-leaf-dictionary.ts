'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useMemo } from 'react'

import type { CalloutMenuItem, DatabaseMenuItem } from './dictionary'
import { createLeafDictionary, toReadOnlyDictionary } from './dictionary'

export function useLeafDictionary(readOnly: boolean) {
  const locale = useLocale()
  const t = useTranslations('blocknote')

  return useMemo(() => {
    const dictionary = createLeafDictionary(locale, {
      placeholder: t('placeholder'),
      heading: t('headingPlaceholder'),
      toggleListItem: t('toggleListPlaceholder'),
      listItem: t('listPlaceholder'),
    })

    const calloutItem: CalloutMenuItem = {
      title: t('calloutTitle'),
      subtext: t('calloutSubtext'),
      aliases: t('calloutAliases')
        .split(',')
        .map((alias) => alias.trim())
        .filter(Boolean),
      group: dictionary.slash_menu.paragraph.group ?? '',
    }

    const databaseItem: DatabaseMenuItem = {
      title: t('databaseTitle'),
      subtext: t('databaseSubtext'),
      aliases: t('databaseAliases')
        .split(',')
        .map((alias) => alias.trim())
        .filter(Boolean),
      group: dictionary.slash_menu.table.group ?? '',
    }

    return {
      calloutItem,
      databaseItem,
      dictionary: readOnly ? toReadOnlyDictionary(dictionary) : dictionary,
    }
  }, [locale, readOnly, t])
}
