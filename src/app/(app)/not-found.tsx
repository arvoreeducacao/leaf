import Link from 'next/link'

import { PageCancelIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'

export default function AppNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-content flex-col items-center gap-4 px-4 py-10 text-center tablet:px-8">
      <PageCancelIcon aria-hidden="true" className="size-10 text-gray-600" />
      <h1 className="font-bold text-heading-large text-gray-900">
        Documento não encontrado
      </h1>
      <p className="max-w-110 text-body-medium text-gray-700">
        Ele não existe, está na lixeira ou você não tem acesso a ele
      </p>
      <Button asChild>
        <Link href="/">Voltar para o início</Link>
      </Button>
    </div>
  )
}
