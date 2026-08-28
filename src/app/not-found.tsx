import Link from 'next/link'

import { LeafIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh w-full items-center justify-center px-4 py-8">
      <div className="flex w-full max-w-[440px] flex-col items-center gap-4 text-center">
        <LeafIcon aria-hidden="true" className="size-10 text-primary-700" />
        <h1 className="font-bold text-heading-large text-gray-900">
          Página não encontrada
        </h1>
        <p className="text-body-medium text-gray-700">
          O documento não existe ou você não tem acesso a ele
        </p>
        <Button asChild>
          <Link href="/">Voltar para o início</Link>
        </Button>
      </div>
    </main>
  )
}
