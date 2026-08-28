import Link from 'next/link'

import { LeafIcon, PageCancelIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'

export default function ShareNotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="flex items-center gap-2 border-alpha-200 border-b px-4 py-3 tablet:px-8">
        <LeafIcon aria-hidden="true" className="size-5 text-primary-700" />
        <span className="font-bold text-body-medium text-gray-900">Leaf</span>
      </header>
      <main className="mx-auto flex w-full max-w-content flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center tablet:px-8">
        <PageCancelIcon aria-hidden="true" className="size-10 text-gray-600" />
        <h1 className="font-bold text-heading-large text-gray-900">
          Link indisponível
        </h1>
        <p className="max-w-110 text-body-medium text-gray-700">
          Este link foi desativado ou o documento não está mais público
        </p>
        <Button asChild>
          <Link href="/">Ir para o Leaf</Link>
        </Button>
      </main>
    </div>
  )
}
