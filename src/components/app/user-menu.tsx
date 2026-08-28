'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { ArrowRightIcon } from '@/components/icons'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { authClient } from '@/lib/auth-client'

type Props = Readonly<{
  name: string
  email: string
}>

function initials(name: string, email: string) {
  const source = name.trim() || email
  const parts = source.split(/\s+/).filter(Boolean)

  if (parts.length === 0) {
    return '?'
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function UserMenu({ name, email }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleSignOut() {
    setPending(true)
    const result = await authClient.signOut()

    if (result.error) {
      setPending(false)
      toast.error('Não foi possível sair da conta')
      return
    }

    router.push('/login')
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex w-full items-center gap-3 rounded-large p-2 text-left transition-colors hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-gray-900 focus-visible:outline-offset-2"
          type="button"
        >
          <Avatar className="size-8 shrink-0">
            <AvatarFallback className="bg-primary-200 font-bold text-caption text-gray-900">
              {initials(name, email)}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold text-body-small text-gray-900">
              {name || email}
            </span>
            <span className="block truncate text-caption text-gray-700">
              {email}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Conta</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={pending} onSelect={handleSignOut}>
          <ArrowRightIcon aria-hidden="true" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
