'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--surface-card)',
          '--normal-text': 'var(--content-strong)',
          '--normal-border': 'var(--line-muted)',
          '--border-radius': 'var(--radius-lg)',
          '--success-bg': 'var(--positive-surface-strong)',
          '--success-text': 'var(--content-strong)',
          '--success-border': 'var(--positive-surface-strong)',
          '--error-bg': 'var(--danger-surface-strong)',
          '--error-text': 'var(--content-strong)',
          '--error-border': 'var(--danger-surface-strong)',
          '--warning-bg': 'var(--warn-surface-strong)',
          '--warning-text': 'var(--content-strong)',
          '--warning-border': 'var(--warn-surface-strong)',
        } as React.CSSProperties
      }
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      toastOptions={{
        style: {
          borderRadius: 'var(--radius-lg)',
          padding: '12px 14px',
          gap: '12px',
          fontSize: '14px',
          fontFamily: 'var(--font-ui)',
          boxShadow: 'var(--elevation-medium)',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
