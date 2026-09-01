'use client'

import { useTranslations } from 'next-intl'
import { useEffect } from 'react'

import { Button } from '@/components/ui/button'

export function OfflineRetry() {
  const t = useTranslations('offline')

  useEffect(() => {
    function goBackToLeaf() {
      window.location.replace('/')
    }

    window.addEventListener('online', goBackToLeaf)

    return () => {
      window.removeEventListener('online', goBackToLeaf)
    }
  }, [])

  return (
    <Button onClick={() => window.location.reload()} type="button">
      {t('retry')}
    </Button>
  )
}
