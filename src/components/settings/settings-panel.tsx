import { Label } from '@/components/ui/label'
import { cn } from '@/shared/utils'

export function SettingsHeader({
  description,
  title,
}: Readonly<{ description?: string; title: string }>) {
  return (
    <header className="flex flex-col gap-1.5">
      <h1 className="font-semibold text-content-strong text-heading-large">
        {title}
      </h1>
      {description ? (
        <p className="max-w-prose-leaf text-body-small text-content">
          {description}
        </p>
      ) : null}
    </header>
  )
}

export function SettingsPanel({
  children,
  className,
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  return (
    <div
      className={cn(
        'mt-2 flex flex-col divide-y divide-line-subtle',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function SettingsSection({
  action,
  children,
  className,
  description,
  title,
}: Readonly<{
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  description?: string
  title?: string
}>) {
  return (
    <section className={cn('flex flex-col gap-3 py-6', className)}>
      {title ? (
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 className="font-semibold text-body-medium text-content-strong">
              {title}
            </h2>
            {description ? (
              <p className="max-w-prose-leaf text-caption text-content">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function SettingsRow({
  children,
  className,
  control,
  description,
  htmlFor,
  title,
}: Readonly<{
  children?: React.ReactNode
  className?: string
  control?: React.ReactNode
  description?: string
  htmlFor?: string
  title?: string
}>) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 py-2.5 tablet:flex-row tablet:items-center tablet:justify-between tablet:gap-8',
        className,
      )}
    >
      {title || description ? (
        <div className="flex min-w-0 flex-col gap-0.5">
          {!title ? null : htmlFor ? (
            <Label
              className="font-medium text-body-small text-content-strong"
              htmlFor={htmlFor}
            >
              {title}
            </Label>
          ) : (
            <span className="font-medium text-body-small text-content-strong">
              {title}
            </span>
          )}
          {description ? (
            <p className="max-w-prose-leaf text-caption text-content">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}
      {control ? (
        <div className="flex shrink-0 items-center gap-2">{control}</div>
      ) : null}
      {children}
    </div>
  )
}

export function SettingsList({
  children,
  className,
  label,
}: Readonly<{
  children: React.ReactNode
  className?: string
  label?: string
}>) {
  return (
    <ul
      aria-label={label}
      className={cn(
        'flex flex-col divide-y divide-line-subtle border-line-subtle border-t border-b',
        className,
      )}
    >
      {children}
    </ul>
  )
}

export function SettingsListItem({
  children,
  className,
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  return (
    <li
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-3 py-2.5',
        className,
      )}
    >
      {children}
    </li>
  )
}

export function SettingsHint({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <p className="max-w-prose-leaf text-caption text-content">{children}</p>
  )
}
