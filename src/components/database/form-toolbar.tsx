'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  AddIcon,
  EyeIcon,
  LightningIcon,
  SettingsIcon,
  TrashIcon,
} from '@/components/icons'
import { Button } from '@/components/ui/button'
import { ButtonIcon } from '@/components/ui/button-icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { DatabaseProperty, DatabaseView } from '@/db/schema'
import {
  type AutomationKind,
  type FormAutomation,
  type FormConfig,
  TITLE_QUESTION_ID,
  automationAccepts,
  automationKinds,
} from '@/lib/database/forms'
import type { PropertyValue } from '@/lib/database/values'
import {
  clearFormWebhook,
  setFormChannel,
  setFormThreadOptions,
  setFormWebhook,
} from '@/lib/form-actions'
import type { FormSlackLink } from '@/lib/form-webhooks'
import { cn } from '@/shared/utils'

import { FilterValueInput } from './filter-value-input'
import { FormLinkPanel } from './form-link-panel'

type Props = Readonly<{
  view: DatabaseView
  properties: ReadonlyArray<DatabaseProperty>
  config: FormConfig
  canEdit: boolean
  notifying: boolean
  slackLink: FormSlackLink | null
  slackBotReady: boolean
  previewing: boolean
  onChange: (config: FormConfig) => void
  onTokenChange: (token: string | null) => void
  onNotifyingChange: (notifying: boolean) => void
  onSlackLinkChange: (link: FormSlackLink | null) => void
  onPreviewingChange: (previewing: boolean) => void
}>

const sectionTitle = 'font-medium text-caption text-content-subtle'

export function FormToolbar({
  view,
  properties,
  config,
  canEdit,
  notifying,
  slackLink,
  slackBotReady,
  previewing,
  onChange,
  onTokenChange,
  onNotifyingChange,
  onSlackLinkChange,
  onPreviewingChange,
}: Props) {
  const t = useTranslations('form')
  const tDatabase = useTranslations('database')
  const [busy, setBusy] = useState(false)
  const [webhook, setWebhook] = useState('')
  const [channel, setChannel] = useState('')

  const byId = new Map(properties.map((property) => [property.id, property]))

  function nameOf(propertyId: string) {
    return propertyId === TITLE_QUESTION_ID
      ? tDatabase('titleColumn')
      : (byId.get(propertyId)?.name ?? propertyId)
  }

  function setAutomations(automations: ReadonlyArray<FormAutomation>) {
    onChange({ ...config, automations })
  }

  function patchAutomation(index: number, value: PropertyValue) {
    setAutomations(
      config.automations.map((automation, position) =>
        position === index ? { ...automation, value } : automation,
      ),
    )
  }

  function automationTargets(kind: AutomationKind) {
    return properties.filter((property) =>
      automationAccepts(kind, property.type),
    )
  }

  async function changeWebhook(url: string | null) {
    setBusy(true)

    try {
      const result =
        url === null
          ? await clearFormWebhook(view.id)
          : await setFormWebhook(view.id, url)

      if (!result.ok) {
        toast.error(result.error)

        return
      }

      setWebhook('')
      onNotifyingChange(url !== null)
      onSlackLinkChange(
        url === null
          ? null
          : {
              channelId: null,
              channelName: null,
              pullThread: true,
              pushComments: true,
              url,
              viewId: view.id,
            },
      )
    } catch {
      toast.error(tDatabase('saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function connectChannel(reference: string) {
    setBusy(true)

    try {
      const result = await setFormChannel(view.id, reference)

      if (!result.ok) {
        toast.error(result.error)

        return
      }

      setChannel('')
      onNotifyingChange(true)
      onSlackLinkChange({
        channelId: reference,
        channelName: reference.replace(/^#/, ''),
        pullThread: true,
        pushComments: true,
        url: null,
        viewId: view.id,
      })
    } catch {
      toast.error(tDatabase('saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function changeThreadOption(
    pullThread: boolean,
    pushComments: boolean,
  ) {
    if (!slackLink) {
      return
    }

    setBusy(true)

    try {
      const result = await setFormThreadOptions(
        view.id,
        pullThread,
        pushComments,
      )

      if (!result.ok) {
        toast.error(result.error)

        return
      }

      onSlackLinkChange({ ...slackLink, pullThread, pushComments })
    } catch {
      toast.error(tDatabase('saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {canEdit ? (
        <Popover>
          <PopoverTrigger asChild>
            <ButtonIcon
              aria-label={t('automationsSection')}
              size="medium"
              variant="ghost"
            >
              <LightningIcon
                aria-hidden="true"
                className={
                  config.automations.length > 0 ? 'text-brand' : undefined
                }
              />
            </ButtonIcon>
          </PopoverTrigger>
          <PopoverContent align="end" className="flex w-90 flex-col gap-3 p-3">
            <div className="flex flex-col gap-1">
              <h3 className={sectionTitle}>{t('automationsSection')}</h3>
              <p className="text-body-small text-content">
                {t('automationsHint')}
              </p>
            </div>

            {config.automations.length === 0 ? (
              <p className="text-body-small text-content-subtle">
                {t('noAutomations')}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {config.automations.map((automation, index) => (
                  <li
                    className="flex items-center gap-2 rounded-large border border-line-muted bg-surface-card px-2 py-1.5"
                    key={`${automation.kind}-${automation.propertyId}-${index}`}
                  >
                    <LightningIcon
                      aria-hidden="true"
                      className="size-4 shrink-0 text-content-subtle"
                    />
                    <span className="min-w-0 flex-1 text-body-small text-content-strong">
                      {t(`automationLine_${automation.kind}`, {
                        property: nameOf(automation.propertyId),
                      })}
                    </span>

                    {automation.kind === 'presetValue' ? (
                      <div className="w-32 shrink-0">
                        <FilterValueInput
                          label={t('automationValue')}
                          onChange={(value) => patchAutomation(index, value)}
                          operator="is"
                          people={[]}
                          property={byId.get(automation.propertyId) ?? null}
                          value={automation.value}
                        />
                      </div>
                    ) : null}

                    <ButtonIcon
                      aria-label={t('removeAutomation')}
                      onClick={() =>
                        setAutomations(
                          config.automations.filter(
                            (_, position) => position !== index,
                          ),
                        )
                      }
                      size="small"
                      type="button"
                      variant="ghost"
                    >
                      <TrashIcon aria-hidden="true" />
                    </ButtonIcon>
                  </li>
                ))}
              </ul>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="self-start" type="button" variant="secondary">
                  <AddIcon aria-hidden="true" className="size-4" />
                  {t('addAutomation')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {automationKinds.map((kind) => {
                  const targets = automationTargets(kind)

                  return (
                    <div key={kind}>
                      <DropdownMenuLabel>
                        {t(`automation_${kind}`)}
                      </DropdownMenuLabel>
                      {targets.length === 0 ? (
                        <DropdownMenuItem disabled>
                          {t('automationNoTarget')}
                        </DropdownMenuItem>
                      ) : (
                        targets.map((property) => (
                          <DropdownMenuItem
                            key={`${kind}-${property.id}`}
                            onSelect={() =>
                              setAutomations([
                                ...config.automations,
                                { kind, propertyId: property.id, value: null },
                              ])
                            }
                          >
                            {property.name}
                          </DropdownMenuItem>
                        ))
                      )}
                      <DropdownMenuSeparator />
                    </div>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </PopoverContent>
        </Popover>
      ) : null}

      {canEdit ? (
        <Popover>
          <PopoverTrigger asChild>
            <ButtonIcon
              aria-label={t('formSettings')}
              size="medium"
              variant="ghost"
            >
              <SettingsIcon aria-hidden="true" />
            </ButtonIcon>
          </PopoverTrigger>
          <PopoverContent align="end" className="flex w-90 flex-col gap-4 p-3">
            <section className="flex flex-col gap-2">
              <h3 className={sectionTitle}>{t('responsesSection')}</h3>
              <label className="flex items-center justify-between gap-2">
                <span className="text-body-small text-content-strong">
                  {t('acceptingResponses')}
                </span>
                <Switch
                  checked={config.accepting}
                  onCheckedChange={(checked) =>
                    onChange({ ...config, accepting: checked })
                  }
                />
              </label>
            </section>

            <section className="flex flex-col gap-2">
              <h3 className={sectionTitle}>{t('sendScreen')}</h3>

              <label className="flex flex-col gap-1">
                <span className="text-body-small text-content">
                  {t('submitLabel')}
                </span>
                <Input
                  className="max-w-none"
                  onChange={(event) =>
                    onChange({ ...config, submitLabel: event.target.value })
                  }
                  placeholder={t('submit')}
                  value={config.submitLabel}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-body-small text-content">
                  {t('successMessage')}
                </span>
                <Textarea
                  className="max-w-none"
                  onChange={(event) =>
                    onChange({ ...config, successMessage: event.target.value })
                  }
                  placeholder={t('defaultSuccess')}
                  value={config.successMessage}
                />
              </label>
            </section>

            <section className="flex flex-col gap-2">
              <h3 className={cn(sectionTitle, 'flex items-center gap-1')}>
                {t('slackSection')}
              </h3>
              <p className="text-body-small text-content">{t('slackHint')}</p>

              <label className="flex items-center justify-between gap-2">
                <span className="text-body-small text-content-strong">
                  {t('slackEnabled')}
                </span>
                <Switch
                  checked={config.notify}
                  onCheckedChange={(checked) =>
                    onChange({ ...config, notify: checked })
                  }
                />
              </label>

              {notifying ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 text-body-small text-content">
                      {slackLink?.channelName
                        ? t('slackChannelConfigured', {
                            channel: slackLink.channelName,
                          })
                        : t('slackConfigured')}
                    </span>
                    <Button
                      disabled={busy}
                      onClick={() => void changeWebhook(null)}
                      type="button"
                      variant="secondary"
                    >
                      {t('slackRemove')}
                    </Button>
                  </div>

                  {slackLink?.channelId ? (
                    <>
                      <label className="flex items-center justify-between gap-2">
                        <span className="text-body-small text-content-strong">
                          {t('slackPullThread')}
                        </span>
                        <Switch
                          checked={slackLink.pullThread}
                          disabled={busy}
                          onCheckedChange={(checked) =>
                            void changeThreadOption(
                              checked,
                              slackLink.pushComments,
                            )
                          }
                        />
                      </label>
                      <label className="flex items-center justify-between gap-2">
                        <span className="text-body-small text-content-strong">
                          {t('slackPushComments')}
                        </span>
                        <Switch
                          checked={slackLink.pushComments}
                          disabled={busy}
                          onCheckedChange={(checked) =>
                            void changeThreadOption(
                              slackLink.pullThread,
                              checked,
                            )
                          }
                        />
                      </label>
                    </>
                  ) : null}
                </div>
              ) : slackBotReady ? (
                <div className="flex items-end gap-2">
                  <label className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-body-small text-content">
                      {t('slackChannel')}
                    </span>
                    <Input
                      className="max-w-none"
                      disabled={busy}
                      onChange={(event) => setChannel(event.target.value)}
                      placeholder={t('slackChannelPlaceholder')}
                      value={channel}
                    />
                  </label>
                  <Button
                    disabled={busy || channel.trim().length === 0}
                    onClick={() => void connectChannel(channel)}
                    type="button"
                    variant="secondary"
                  >
                    {t('slackSave')}
                  </Button>
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <label className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-body-small text-content">
                      {t('slackWebhook')}
                    </span>
                    <Input
                      className="max-w-none"
                      disabled={busy}
                      onChange={(event) => setWebhook(event.target.value)}
                      placeholder="https://hooks.slack.com/services/..."
                      type="url"
                      value={webhook}
                    />
                  </label>
                  <Button
                    disabled={busy || webhook.trim().length === 0}
                    onClick={() => void changeWebhook(webhook)}
                    type="button"
                    variant="secondary"
                  >
                    {t('slackSave')}
                  </Button>
                </div>
              )}
            </section>
          </PopoverContent>
        </Popover>
      ) : null}

      <Button
        aria-pressed={previewing}
        className={cn('font-regular', previewing ? 'bg-surface-hover' : '')}
        onClick={() => onPreviewingChange(!previewing)}
        size="sm"
        type="button"
        variant="ghost"
      >
        <EyeIcon aria-hidden="true" className="size-4" />
        {t('preview')}
      </Button>

      {canEdit ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button className="ml-1.5 font-regular" size="sm" type="button">
              {t('shareForm')}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-90 p-3">
            <FormLinkPanel onTokenChange={onTokenChange} view={view} />
          </PopoverContent>
        </Popover>
      ) : null}
    </>
  )
}
