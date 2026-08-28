'use client'

import { Toaster as Sonner, type ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--color-gray-100)',
          '--normal-text': 'var(--color-gray-900)',
          '--normal-border': 'var(--color-gray-100)',
          '--border-radius': 'var(--radius-xlarge)',
          '--success-bg': 'var(--color-success-200)',
          '--success-text': 'var(--color-gray-900)',
          '--success-border': 'var(--color-success-200)',
          '--error-bg': 'var(--color-error-200)',
          '--error-text': 'var(--color-gray-900)',
          '--error-border': 'var(--color-error-200)',
          '--warning-bg': 'var(--color-warning-200)',
          '--warning-text': 'var(--color-gray-900)',
          '--warning-border': 'var(--color-warning-200)',
        } as React.CSSProperties
      }
      theme="light"
      toastOptions={{
        style: {
          borderRadius: 'var(--radius-xlarge)',
          padding: '16px',
          gap: '12px',
          fontSize: '14px',
          fontFamily: 'var(--font-averta)',
          boxShadow: 'var(--shadow-down-large)',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
