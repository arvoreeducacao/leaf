'use client'

import { AlertIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'

type Props = Readonly<{
  error: Error & { digest?: string }
  reset: () => void
}>

export default function AppError({ reset }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-content flex-col items-center gap-4 px-4 py-10 text-center tablet:px-8">
      <AlertIcon aria-hidden="true" className="size-10 text-error-700" />
      <h1 className="font-bold text-heading-large text-gray-900">
        Algo deu errado
      </h1>
      <p className="max-w-[440px] text-body-medium text-gray-700">
        Não conseguimos carregar esta parte do Leaf
      </p>
      <Button onClick={reset} type="button">
        Tentar de novo
      </Button>
    </div>
  )
}
