'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
      enableSystem
      storageKey="leaf:theme"
    >
      {children}
    </NextThemesProvider>
  )
}
