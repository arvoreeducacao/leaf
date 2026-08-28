'use client'

import { ShareIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type Props = Readonly<{
  documentId: string
  canShare: boolean
}>

export function ShareButton({ canShare }: Props) {
  if (!canShare) {
    return null
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-disabled="true"
          className="cursor-not-allowed border-alpha-200 bg-gray-100 text-gray-700 hover:border-alpha-200 hover:text-gray-700"
          onClick={(event) => event.preventDefault()}
          type="button"
          variant="secondary"
        >
          <ShareIcon aria-hidden="true" />
          Compartilhar
        </Button>
      </TooltipTrigger>
      <TooltipContent>Em breve</TooltipContent>
    </Tooltip>
  )
}
