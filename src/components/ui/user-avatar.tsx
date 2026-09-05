import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { avatarUrlFor } from '@/lib/avatar'
import { cn } from '@/shared/utils'

type Props = Readonly<{
  userId: string
  name: string
  email?: string
  image?: string | null
  className?: string
}>

export function userInitials(name: string, email?: string): string {
  const source = name.trim() || email?.trim() || ''
  const parts = source.split(/\s+/u).filter(Boolean)

  if (parts.length === 0) {
    return '?'
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toLocaleUpperCase()
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toLocaleUpperCase()
}

export function UserAvatar({ userId, name, email, image, className }: Props) {
  return (
    <Avatar className={cn('size-5 shrink-0', className)}>
      <AvatarImage alt="" src={avatarUrlFor(userId, image)} />
      <AvatarFallback className="bg-surface-subtle font-semibold text-[10px] text-content">
        {userInitials(name, email)}
      </AvatarFallback>
    </Avatar>
  )
}
