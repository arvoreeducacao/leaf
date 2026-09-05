import { DocumentIcon } from '@/components/app/document-icon'
import { LeafMark } from '@/components/app/leaf-mark'
import { readDocumentIcon } from '@/lib/document-icon'
import { cn } from '@/shared/utils'

type MarkSize = 'small' | 'medium' | 'large'

type Props = Readonly<{
  name: string | null
  icon: string | null
  size?: MarkSize
}>

const boxBySize: Record<MarkSize, string> = {
  small: 'size-5 rounded-small text-caption',
  medium: 'size-9 rounded-medium text-body-medium',
  large: 'size-16 rounded-large border border-line-subtle text-heading-large',
}

const iconBySize: Record<MarkSize, string> = {
  small: 'text-[15px]',
  medium: 'text-[22px]',
  large: 'text-[38px]',
}

const leafBySize: Record<MarkSize, string> = {
  small: 'size-3.5',
  medium: 'size-5',
  large: 'size-8',
}

export function OrganizationMark({ name, icon, size = 'small' }: Props) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden bg-surface-subtle font-semibold text-content',
        boxBySize[size],
      )}
    >
      {readDocumentIcon(icon) ? (
        <DocumentIcon className={cn('size-full', iconBySize[size])} icon={icon} />
      ) : name ? (
        name.trim().charAt(0).toUpperCase()
      ) : (
        <LeafMark className={cn('text-brand', leafBySize[size])} />
      )}
    </span>
  )
}
