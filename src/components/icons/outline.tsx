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
    <OutlineIcon strokeWidth={1} {...props}>
      <rect height="9.1" rx="1.2" width="12.4" x="1.8" y="3.4" />
      <path d="M5.66 3.4v9.1" />
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

export function SlidersIcon(props: IconProps) {
  return (
    <OutlineIcon {...props}>
      <path d="M2.75 5.25h1.5" />
      <path d="M7.75 5.25h5.5" />
      <circle cx="6" cy="5.25" r="1.5" />
      <path d="M2.75 10.75h4.5" />
      <path d="M10.75 10.75h2.5" />
      <circle cx="9" cy="10.75" r="1.5" />
    </OutlineIcon>
  )
}

export function GripIcon(props: IconProps) {
  return (
    <svg
      fill="currentColor"
      height="1em"
      viewBox="0 0 16 16"
      width="1em"
      {...props}
    >
      <circle cx="6" cy="4" r="1.15" />
      <circle cx="10" cy="4" r="1.15" />
      <circle cx="6" cy="8" r="1.15" />
      <circle cx="10" cy="8" r="1.15" />
      <circle cx="6" cy="12" r="1.15" />
      <circle cx="10" cy="12" r="1.15" />
    </svg>
  )
}

export function EyeIcon(props: IconProps) {
  return (
    <OutlineIcon {...props}>
      <path d="M1.75 8S4.15 3.75 8 3.75 14.25 8 14.25 8 11.85 12.25 8 12.25 1.75 8 1.75 8Z" />
      <circle cx="8" cy="8" r="1.9" />
    </OutlineIcon>
  )
}

export function EyeOffIcon(props: IconProps) {
  return (
    <OutlineIcon {...props}>
      <path d="M6.6 4.05A6.7 6.7 0 0 1 8 3.9c3.85 0 6.25 4.1 6.25 4.1a12.2 12.2 0 0 1-2.2 2.75" />
      <path d="M4.55 5.15A11.9 11.9 0 0 0 1.75 8s2.4 4.1 6.25 4.1c1.03 0 1.95-.3 2.75-.73" />
      <path d="M9.4 9.4a2 2 0 0 1-2.8-2.8" />
      <path d="m2.6 2.6 10.8 10.8" />
    </OutlineIcon>
  )
}
