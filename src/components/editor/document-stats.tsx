import { useTranslations } from 'next-intl'

import type { TextStats } from './text-stats'

type Props = Readonly<{ stats: TextStats }>

export function DocumentStats({ stats }: Props) {
  const t = useTranslations('editor')

  return (
    <p className="flex flex-wrap items-center gap-2 text-caption text-content">
      <span>{t('words', { count: stats.words })}</span>
      <span aria-hidden="true" className="text-content-muted">
        ·
      </span>
      <span>{t('characters', { count: stats.characters })}</span>
    </p>
  )
}
