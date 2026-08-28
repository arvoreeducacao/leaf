import { ClassValue } from 'clsx'

import { cn } from '@/shared/utils'

export function CoinLogo({ className }: { className?: ClassValue }) {
  return (
    <div className={cn('relative size-4 shrink-0', className)}>
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 16 16"
      >
        <g>
          <circle cx="8" cy="8" fill="#FFE3B1" r="8" />
          <circle cx="8.00001" cy="8" fill="#FFC517" r="6" />
          <path
            clipRule="evenodd"
            d="M6.39052 10.7222L6.79506 9.52103H9.2557L9.66496 10.7222H11.3889L8.81269 4H7.23326L4.66668 10.7222H6.39052ZM8.80275 8.18126H7.2474L8.01299 5.91277H8.03235L8.80275 8.18126Z"
            fill="#FFE3B1"
            fillRule="evenodd"
          />
        </g>
      </svg>
    </div>
  )
}
