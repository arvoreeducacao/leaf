import { PageIcon, TableIcon } from '@/components/icons/outline'
import { cn } from '@/shared/utils'

type Props = Readonly<{
  icon: string | null | undefined
  kind?: 'page' | 'database' | 'row'
  className?: string
}>

const remoteIcon = /^(https?:)?\/\//

export function DocumentIcon({
  icon,
  kind = 'page',
  className = 'size-4',
}: Props) {
  const value = icon?.trim()

  if (value && remoteIcon.test(value)) {
    return (
      <img
        alt=""
        className={cn('shrink-0 rounded-small object-cover', className)}
        src={value}
      />
    )
  }

  if (value) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex shrink-0 items-center justify-center leading-none',
          className,
        )}
      >
        {value}
      </span>
    )
  }

  const Fallback = kind === 'database' ? TableIcon : PageIcon

  return <Fallback aria-hidden="true" className={cn('shrink-0', className)} />
}
