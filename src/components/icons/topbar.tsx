import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function StrokeIcon({ children, viewBox = '0 0 20 20', ...props }: IconProps) {
  return (
    <svg
      fill="none"
      height="1em"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.25}
      viewBox={viewBox}
      width="1em"
      {...props}
    >
      {children}
    </svg>
  )
}

const starOutline =
  'M10 2.9 11.764 7.923 17.085 8.048 12.853 11.277 14.381 16.377 10 13.35 5.619 16.377 7.147 11.277 2.915 8.048 8.236 7.923z'

export function TeamspaceIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M2.465 16.075V5.274a1.35 1.35 0 0 1 1.35-1.35h6.345a1.35 1.35 0 0 1 1.35 1.35v10.801" />
      <path d="M2.465 16.075h15.07V8.298a1.35 1.35 0 0 0-1.35-1.35H11.51" />
      <path d="M5.48 16.075v-2.5h2.515v2.5" />
      <g fill="currentColor" stroke="none">
        <circle cx="5.48" cy="6.96" r=".675" />
        <circle cx="8.495" cy="6.96" r=".675" />
        <circle cx="5.48" cy="9.978" r=".675" />
        <circle cx="8.495" cy="9.978" r=".675" />
        <circle cx="14.525" cy="9.978" r=".675" />
        <circle cx="14.525" cy="12.99" r=".675" />
      </g>
    </StrokeIcon>
  )
}

export function LinkIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M9.2 5.905l1.852-1.853a3.151 3.151 0 0 1 4.456 0l.367.368a3.151 3.151 0 0 1 0 4.456l-1.852 1.853" />
      <path d="M12.538 7.39l-5.448 5.448" />
      <path d="M10.8 14.095l-1.852 1.853a3.151 3.151 0 0 1-4.456 0l-.367-.368a3.151 3.151 0 0 1 0-4.456l1.852-1.853" />
    </StrokeIcon>
  )
}

export function CommentIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M4.5 3.755h11A1.5 1.5 0 0 1 17 5.255v7.5a1.5 1.5 0 0 1-1.5 1.5H9.8l-3.487 2.682v-2.682H4.5a1.5 1.5 0 0 1-1.5-1.5v-7.5a1.5 1.5 0 0 1 1.5-1.5z" />
      <path d="M6.5 7.505h7" />
      <path d="M6.5 10.505h5" />
    </StrokeIcon>
  )
}

export function StarIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d={starOutline} />
    </StrokeIcon>
  )
}

export function StarFilledIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d={starOutline} fill="currentColor" />
    </StrokeIcon>
  )
}

export function MoreIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <g fill="currentColor" stroke="none">
        <circle cx="4" cy="10" r="1.375" />
        <circle cx="10" cy="10" r="1.375" />
        <circle cx="16" cy="10" r="1.375" />
      </g>
    </StrokeIcon>
  )
}

export function ExpandDiagonalIcon(props: IconProps) {
  return (
    <StrokeIcon viewBox="0 0 16 16" {...props}>
      <path d="M8.912 3.088h4v4" />
      <path d="M12.912 3.088 8.8 7.2" />
      <path d="M7.088 12.912h-4v-4" />
      <path d="M3.088 12.912 7.2 8.8" />
    </StrokeIcon>
  )
}
