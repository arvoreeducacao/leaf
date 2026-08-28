'use client'

import { FileUploadIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function ImportButton() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-disabled="true"
          className="w-full cursor-not-allowed border-alpha-200 bg-gray-100 text-gray-700 hover:border-alpha-200 hover:text-gray-700"
          onClick={(event) => event.preventDefault()}
          type="button"
          variant="secondary"
        >
          <FileUploadIcon aria-hidden="true" />
          Importar markdown
        </Button>
      </TooltipTrigger>
      <TooltipContent>Em breve</TooltipContent>
    </Tooltip>
  )
}
