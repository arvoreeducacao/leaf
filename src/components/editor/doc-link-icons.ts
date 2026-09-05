import { readDocumentIcon } from '@/lib/document-icon'

export type LinkedDocumentIcon = Readonly<{
  id: string
  icon: string | null
  kind: 'page' | 'database' | 'row' | 'template'
}>

const idPattern = /^[A-Za-z0-9_-]{1,64}$/

const pageGlyph =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2H5a1.75 1.75 0 0 0-1.75 1.75v8.5A1.75 1.75 0 0 0 5 14h6a1.75 1.75 0 0 0 1.75-1.75V5.25z"/><path d="M9.5 2v3.25h3.25"/><path d="M5.75 8.75h4.5"/><path d="M5.75 11.25h3"/></svg>'

const tableGlyph =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect height="12" rx="1.75" width="12" x="2" y="2"/><path d="M2 5.75h12"/><path d="M6.5 5.75V14"/></svg>'

const frame =
  'display:inline-block;width:1.05em;height:1.05em;vertical-align:-.17em;margin-right:.32em;background-repeat:no-repeat;background-position:center;background-size:contain;'

const maskFrame =
  'display:inline-block;width:1.05em;height:1.05em;vertical-align:-.17em;margin-right:.32em;background-color:currentColor;opacity:.62;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain;'

export function cssQuoted(value: string): string {
  return `"${value.replace(/[\\"]/g, (char) => `\\${char}`).replace(/\r?\n/g, ' ')}"`
}

function glyphUrl(kind: LinkedDocumentIcon['kind']): string {
  const svg = kind === 'database' ? tableGlyph : pageGlyph

  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function selectorFor(id: string): string {
  return `.leaf-editor a[href$="/doc/${id}"]`
}

function ruleFor(target: LinkedDocumentIcon): string {
  const selector = selectorFor(target.id)
  const source = readDocumentIcon(target.icon)

  if (source?.kind === 'text') {
    return `${selector}::before{content:${cssQuoted(source.text)};margin-right:.32em;}`
  }

  if (source?.kind === 'image') {
    const url = `${selector}::before{content:"";${frame}background-image:url(${cssQuoted(source.url)});}`

    return source.fromNotionLibrary
      ? `${url}.dark ${selector}::before{filter:brightness(1.5);}`
      : url
  }

  return `${selector}::before{content:"";${maskFrame}-webkit-mask-image:url(${cssQuoted(glyphUrl(target.kind))});mask-image:url(${cssQuoted(glyphUrl(target.kind))});}`
}

export const docLinkPreviewClass = 'leaf-doc-link-preview'

const iconResets = [
  '.leaf-editor .leaf-database-block a[href]::before{content:none;}',
  `.leaf-editor a.${docLinkPreviewClass}::before{content:none;}`,
].join('')

export function documentLinkIconRules(
  targets: ReadonlyArray<LinkedDocumentIcon>,
): string {
  const rules = targets
    .filter((target) => idPattern.test(target.id))
    .map(ruleFor)
    .join('')

  return rules.length > 0 ? `${rules}${iconResets}` : ''
}

const rowBox = 'display:block;padding:0.2em 0.3em;margin:0 -0.3em;'

export function documentLinkRowRules(
  blockIds: ReadonlyArray<string>,
): string {
  return blockIds
    .filter((blockId) => idPattern.test(blockId))
    .map((blockId) => {
      const line = `.leaf-editor .bn-block-outer[data-id="${blockId}"]>.bn-block>.bn-block-content>.bn-inline-content`

      return `${line}{flex:1;}${line}>a{${rowBox}}`
    })
    .join('')
}
