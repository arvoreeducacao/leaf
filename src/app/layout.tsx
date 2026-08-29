import './globals.css'

import type { Metadata, Viewport } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import localFont from 'next/font/local'

import { ThemeProvider } from '@/components/app/theme-provider'
import { Toaster } from '@/components/ui/sonner'

const averta = localFont({
  src: [
    {
      path: '../../public/font/Averta-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/font/Averta-Bold.otf',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-averta',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata')

  return {
    title: t('title'),
    description: t('description'),
  }
}

type Props = Readonly<{
  children: React.ReactNode
}>

export default async function RootLayout({ children }: Props) {
  const locale = await getLocale()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${averta.variable} font-sans antialiased min-h-dvh`}>
        <ThemeProvider>
          <NextIntlClientProvider>
            {children}
            <Toaster />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
