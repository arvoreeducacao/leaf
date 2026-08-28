import './globals.css'

import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'

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

export const metadata: Metadata = {
  title: 'Leaf',
  description: 'Editor de documentos da Árvore',
}

type Props = Readonly<{
  children: React.ReactNode
}>

export default function RootLayout({ children }: Props) {
  return (
    <html lang="pt-BR">
      <body className={`${averta.variable} font-sans antialiased min-h-dvh`}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
