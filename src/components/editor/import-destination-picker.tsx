'use client'

import { useTranslations } from 'next-intl'

import { PadlockIcon, TeamIcon, UsersIcon } from '@/components/icons'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { ImportDestinationsResult } from '@/lib/import-actions'
import { cn } from '@/shared/utils'

type OptionProps = Readonly<{
  value: string
  label: string
  hint: string
  icon: React.ReactNode
  checked: boolean
}>

function DestinationOption({ value, label, hint, icon, checked }: OptionProps) {
  return (
    <label
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-3 rounded-large px-3 py-2 transition-colors',
        'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-offset-2',
        checked ? 'bg-brand-surface' : 'hover:bg-surface-hover',
      )}
    >
      <RadioGroupItem value={value} />
      {icon}
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            'truncate text-body-small text-content-strong',
            checked ? 'font-bold' : '',
          )}
        >
          {label}
        </span>
        <span className="text-body-small text-content">{hint}</span>
      </span>
    </label>
  )
}

export function destinationLabel(
  destinations: ImportDestinationsResult | null,
  destination: string | null,
  fallbacks: Readonly<{ organization: string; private: string }>,
): string {
  if (destination === 'organization') {
    return destinations?.organizationName ?? fallbacks.organization
  }

  return (
    destinations?.teamspaces.find((option) => option.value === destination)
      ?.label ?? fallbacks.private
  )
}

type Props = Readonly<{
  destinations: ImportDestinationsResult | null
  destination: string | null
  onChange: (value: string) => void
}>

export function ImportDestinationPicker({
  destinations,
  destination,
  onChange,
}: Props) {
  const t = useTranslations('archiveImport')
  const parentDestination = destinations?.parentDestination ?? 'private'
  const chosen = destinationLabel(destinations, destination, {
    organization: t('destinationOrganization'),
    private: t('destinationPrivate'),
  })

  return (
    <div className="flex flex-col gap-3">
      <p className="text-body-small text-content-strong">
        {t('destinationTitle')}
      </p>

      <RadioGroup
        aria-label={t('destinationLabel')}
        className="flex flex-col gap-1"
        onValueChange={onChange}
        value={destination ?? 'private'}
      >
        <DestinationOption
          checked={destination === 'private'}
          hint={t('destinationPrivateHint')}
          icon={<PadlockIcon aria-hidden="true" className="size-4 shrink-0" />}
          label={t('destinationPrivate')}
          value="private"
        />

        {destinations?.organizationName ? (
          <DestinationOption
            checked={destination === 'organization'}
            hint={t('destinationOrganizationHint')}
            icon={<TeamIcon aria-hidden="true" className="size-4 shrink-0" />}
            label={destinations.organizationName}
            value="organization"
          />
        ) : null}

        {destinations?.teamspaces.map((option) => (
          <DestinationOption
            checked={destination === option.value}
            hint={t('destinationTeamspaceHint')}
            icon={<UsersIcon aria-hidden="true" className="size-4 shrink-0" />}
            key={option.value}
            label={option.label}
            value={option.value}
          />
        ))}
      </RadioGroup>

      <p className="text-body-small text-content">
        {destination === parentDestination
          ? t('destinationUnderParent')
          : t('destinationAtRoot', { place: chosen })}
      </p>
    </div>
  )
}
