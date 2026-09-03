import { createReactBlockSpec } from '@blocknote/react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { BrowserIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { embedConfig } from './embed-config'
import { embedLinkLabel, resolveEmbedSource } from './embed-providers'

type EmbedViewProps = Readonly<{
  url: string
  caption: string
  editable: boolean
  onChange: (url: string) => void
}>

function EmbedLink({ url }: Readonly<{ url: string }>) {
  return (
    <a
      className="inline-flex min-w-0 items-center gap-2 text-body-small text-content-subtle hover:text-content-strong"
      href={url}
      rel="noreferrer noopener"
      target="_blank"
    >
      <BrowserIcon aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">{embedLinkLabel(url)}</span>
    </a>
  )
}

function EmbedForm({ onChange }: Readonly<{ onChange: (url: string) => void }>) {
  const t = useTranslations('embed')
  const [value, setValue] = useState('')

  return (
    <form
      className="flex w-full flex-col gap-3 rounded-medium bg-surface-subtle px-4 py-4 sm:flex-row sm:items-center"
      onSubmit={(event) => {
        event.preventDefault()
        onChange(value.trim())
      }}
    >
      <Input
        aria-label={t('placeholder')}
        className="flex-1"
        onChange={(event) => setValue(event.target.value)}
        placeholder={t('placeholder')}
        type="url"
        value={value}
      />
      <Button disabled={value.trim().length === 0} size="sm" type="submit">
        {t('confirm')}
      </Button>
    </form>
  )
}

function EmbedView({ url, caption, editable, onChange }: EmbedViewProps) {
  const t = useTranslations('embed')
  const [interactive, setInteractive] = useState(false)
  const source = resolveEmbedSource(url)

  if (url.length === 0) {
    return editable ? (
      <EmbedForm onChange={onChange} />
    ) : (
      <p className="text-body-small text-content-subtle">{t('empty')}</p>
    )
  }

  if (source === null) {
    return (
      <div className="flex w-full items-center justify-between gap-3 rounded-medium border border-line-soft px-4 py-3">
        <EmbedLink url={url} />
        <span className="shrink-0 text-caption text-content-subtle">
          {t('unsupported')}
        </span>
      </div>
    )
  }

  return (
    <figure className="m-0 flex w-full flex-col gap-2">
      <div
        className="relative w-full overflow-hidden rounded-medium border border-line-soft bg-surface-subtle"
        style={
          source.height === null
            ? { aspectRatio: source.ratio }
            : { height: source.height }
        }
      >
        <iframe
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen={source.allowFullScreen}
          className="absolute inset-0 size-full border-0"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-presentation"
          src={source.embedUrl}
          title={source.label}
        />
        {editable && !interactive ? (
          <button
            className="absolute inset-0 flex items-end justify-center bg-transparent pb-4 text-body-small text-transparent transition-colors hover:bg-surface-hover hover:text-content-subtle"
            onClick={() => setInteractive(true)}
            type="button"
          >
            {t('activate')}
          </button>
        ) : null}
      </div>
      <figcaption className="flex items-center gap-3">
        {caption.length > 0 ? (
          <span className="min-w-0 flex-1 truncate text-body-small text-content-subtle">
            {caption}
          </span>
        ) : null}
        <EmbedLink url={url} />
      </figcaption>
    </figure>
  )
}

export const createEmbedBlock = createReactBlockSpec(embedConfig, {
  render: ({ block, editor }) => (
    <div
      className="leaf-embed-block w-full"
      contentEditable={false}
      suppressContentEditableWarning
    >
      <EmbedView
        caption={block.props.caption}
        editable={editor.isEditable}
        onChange={(url) => editor.updateBlock(block, { props: { url } })}
        url={block.props.url}
      />
    </div>
  ),
  toExternalHTML: ({ block }) => (
    <p>
      <a href={block.props.url}>
        {block.props.caption.length > 0 ? block.props.caption : block.props.url}
      </a>
    </p>
  ),
})
