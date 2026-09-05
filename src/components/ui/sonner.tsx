'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

const surface = {
  '--normal-bg': 'var(--tooltip)',
  '--normal-text': 'var(--tooltip-foreground)',
  '--normal-border': 'transparent',
  '--success-bg': 'var(--tooltip)',
  '--success-text': 'var(--tooltip-foreground)',
  '--success-border': 'transparent',
  '--error-bg': 'var(--tooltip)',
  '--error-text': 'var(--tooltip-foreground)',
  '--error-border': 'transparent',
  '--warning-bg': 'var(--tooltip)',
  '--warning-text': 'var(--tooltip-foreground)',
  '--warning-border': 'transparent',
  '--info-bg': 'var(--tooltip)',
  '--info-text': 'var(--tooltip-foreground)',
  '--info-border': 'transparent',
} as React.CSSProperties

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      className="toaster group"
      offset={24}
      position="bottom-center"
      style={surface}
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      {...props}
    />
  )
}

export { Toaster }
