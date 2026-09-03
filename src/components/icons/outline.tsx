import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function OutlineIcon({ children, ...props }: IconProps) {
  return (
    <svg
      fill="none"
      height="1em"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      viewBox="0 0 16 16"
      width="1em"
      {...props}
    >
      {children}
    </svg>
  )
}

export function SidebarIcon(props: IconProps) {
  return (
    <OutlineIcon {...props}>
      <rect height="10.5" rx="2.25" width="12.5" x="1.75" y="2.75" />
      <path d="M6.25 2.75v10.5" />
    </OutlineIcon>
  )
}

export function ComposeIcon(props: IconProps) {
  return (
    <OutlineIcon {...props}>
      <path d="M13.25 7.5v4.75A1.75 1.75 0 0 1 11.5 14H4a1.75 1.75 0 0 1-1.75-1.75v-7.5A1.75 1.75 0 0 1 4 3h4.75" />
      <path d="M11.3 1.95a1.34 1.34 0 0 1 1.9 1.9L8.5 8.55l-2.5.6.6-2.5z" />
    </OutlineIcon>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <OutlineIcon {...props}>
      <circle cx="7.25" cy="7.25" r="4.5" />
      <path d="m10.6 10.6 2.9 2.9" />
    </OutlineIcon>
  )
}

export function HomeIcon(props: IconProps) {
  return (
    <svg
      fill="currentColor"
      height="1em"
      viewBox="0 0 16 16"
      width="1em"
      {...props}
    >
      <path d="M8.62 1.5a1 1 0 0 0-1.24 0L.7 6.87a.85.85 0 0 0 .53 1.51h1.1V13a1.4 1.4 0 0 0 1.4 1.4h2.5v-3.05a.55.55 0 0 1 .55-.55h2.44a.55.55 0 0 1 .55.55V14.4h2.5a1.4 1.4 0 0 0 1.4-1.4V8.38h1.1a.85.85 0 0 0 .53-1.51z" />
    </svg>
  )
}

export function PageIcon(props: IconProps) {
  return (
    <OutlineIcon {...props}>
      <path d="M9.5 2H5a1.75 1.75 0 0 0-1.75 1.75v8.5A1.75 1.75 0 0 0 5 14h6a1.75 1.75 0 0 0 1.75-1.75V5.25z" />
      <path d="M9.5 2v3.25h3.25" />
      <path d="M5.75 8.75h4.5" />
      <path d="M5.75 11.25h3" />
    </OutlineIcon>
  )
}

export function TableIcon(props: IconProps) {
  return (
    <OutlineIcon {...props}>
      <rect height="12" rx="1.75" width="12" x="2" y="2" />
      <path d="M2 5.75h12" />
      <path d="M6.5 5.75V14" />
    </OutlineIcon>
  )
}

export function TrashIcon(props: IconProps) {
  return (
    <OutlineIcon {...props}>
      <path d="M2.75 4.25h10.5" />
      <path d="M6.25 4.25v-1a1.25 1.25 0 0 1 1.25-1.25h1a1.25 1.25 0 0 1 1.25 1.25v1" />
      <path d="M12.2 4.25l-.52 8.3A1.5 1.5 0 0 1 10.18 14H5.82a1.5 1.5 0 0 1-1.5-1.45L3.8 4.25" />
    </OutlineIcon>
  )
}

export function RestoreIcon(props: IconProps) {
  return (
    <OutlineIcon {...props}>
      <path d="M2 8a6 6 0 1 0 2-4.47L2 5.33" />
      <path d="M2 2v3.33h3.33" />
    </OutlineIcon>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <OutlineIcon {...props}>
      <path d="M8 3.25v9.5" />
      <path d="M3.25 8h9.5" />
    </OutlineIcon>
  )
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <OutlineIcon {...props}>
      <path d="m6 3.5 4.5 4.5L6 12.5" />
    </OutlineIcon>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <OutlineIcon {...props}>
      <path d="m3.5 6 4.5 4.5L12.5 6" />
    </OutlineIcon>
  )
}

export function LockIcon(props: IconProps) {
  return (
    <OutlineIcon {...props}>
      <rect height="7.25" rx="1.75" width="10" x="3" y="6.75" />
      <path d="M5.25 6.75v-2a2.75 2.75 0 0 1 5.5 0v2" />
    </OutlineIcon>
  )
}

export function PeopleIcon(props: IconProps) {
  return (
    <OutlineIcon {...props}>
      <circle cx="6" cy="5.5" r="2.75" />
      <path d="M1.75 13.5a4.25 4.25 0 0 1 8.5 0" />
      <path d="M10.75 3.1a2.75 2.75 0 0 1 0 4.8" />
      <path d="M11.7 9.9a4.25 4.25 0 0 1 2.55 3.6" />
    </OutlineIcon>
  )
}

export function EllipsisIcon(props: IconProps) {
  return (
    <svg
      fill="currentColor"
      height="1em"
      viewBox="0 0 16 16"
      width="1em"
      {...props}
    >
      <circle cx="3.4" cy="8" r="1.15" />
      <circle cx="8" cy="8" r="1.15" />
      <circle cx="12.6" cy="8" r="1.15" />
    </svg>
  )
}
