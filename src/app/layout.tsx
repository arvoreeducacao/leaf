import './globals.css'

import type { Metadata, Viewport } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'

import { ServiceWorkerRegistration } from '@/components/app/service-worker-registration'
import { ThemeProvider } from '@/components/app/theme-provider'
import { Toaster } from '@/components/ui/sonner'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#191919' },
  ],
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata')

  return {
    title: t('title'),
    description: t('description'),
    applicationName: 'Leaf',
    manifest: '/manifest.webmanifest',
    icons: {
      icon: [
        { url: '/icon.svg', type: 'image/svg+xml' },
        { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      ],
      apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    },
    appleWebApp: {
      capable: true,
      title: 'Leaf',
      statusBarStyle: 'default',
    },
  }
}

type Props = Readonly<{
  children: React.ReactNode
}>

export default async function RootLayout({ children }: Props) {
  const locale = await getLocale()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-dvh font-sans">
        <ThemeProvider>
          <NextIntlClientProvider>
            {children}
            <Toaster />
            <ServiceWorkerRegistration />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
