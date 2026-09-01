'use client'

import { useTranslations } from 'next-intl'

import { CloudOffIcon } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { useOnlineStatus } from '@/shared/hooks/use-online-status'

export function OfflineBanner() {
  const t = useTranslations('offline')
  const online = useOnlineStatus()

  if (online) {
    return null
  }

  return (
    <Badge role="status" variant="warning">
      <CloudOffIcon aria-hidden="true" />
      {t('banner')}
    </Badge>
  )
}
