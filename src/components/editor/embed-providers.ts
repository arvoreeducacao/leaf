export type EmbedProviderId =
  | 'canva'
  | 'codepen'
  | 'codesandbox'
  | 'figma'
  | 'googleDocument'
  | 'googleDrive'
  | 'googleForm'
  | 'googlePresentation'
  | 'googleSpreadsheet'
  | 'loom'
  | 'miro'
  | 'spotify'
  | 'typeform'
  | 'vimeo'
  | 'youtube'

export type EmbedSource = Readonly<{
  provider: EmbedProviderId
  label: string
  embedUrl: string
  ratio: number
  height: number | null
  allowFullScreen: boolean
}>

const wideRatio = 16 / 9
const boardRatio = 16 / 10
const pageRatio = 3 / 4
const sheetRatio = 4 / 3

function parseUrl(value: string): URL | null {
  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return null
  }

  try {
    const url = new URL(trimmed)

    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null
  } catch {
    return null
  }
}

function isHost(url: URL, ...hosts: Array<string>) {
  const host = url.hostname.replace(/^www\./u, '').toLowerCase()

  return hosts.some((candidate) => host === candidate)
}

function isHostOrSubdomain(url: URL, domain: string) {
  const host = url.hostname.toLowerCase()

  return host === domain || host.endsWith(`.${domain}`)
}

function segments(url: URL) {
  return url.pathname.split('/').filter((part) => part.length > 0)
}

function idPattern(value: string | undefined) {
  return value !== undefined && /^[A-Za-z0-9_-]{4,}$/u.test(value)
}

function youtube(url: URL): EmbedSource | null {
  if (!isHost(url, 'youtube.com', 'm.youtube.com', 'youtu.be')) {
    return null
  }

  const path = segments(url)
  const id = isHost(url, 'youtu.be')
    ? path[0]
    : path[0] === 'watch'
      ? (url.searchParams.get('v') ?? undefined)
      : path[0] === 'shorts' || path[0] === 'embed' || path[0] === 'live'
        ? path[1]
        : undefined

  if (!idPattern(id)) {
    return null
  }

  const start = url.searchParams.get('t') ?? url.searchParams.get('start')
  const seconds = start === null ? null : Number.parseInt(start, 10)
  const query =
    seconds !== null && Number.isFinite(seconds) && seconds > 0
      ? `?start=${seconds}`
      : ''

  return {
    provider: 'youtube',
    label: 'YouTube',
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}${query}`,
    ratio: wideRatio,
    height: null,
    allowFullScreen: true,
  }
}

function vimeo(url: URL): EmbedSource | null {
  if (!isHost(url, 'vimeo.com', 'player.vimeo.com')) {
    return null
  }

  const path = segments(url)
  const id = path[0] === 'video' ? path[1] : path[0]

  if (id === undefined || !/^\d+$/u.test(id)) {
    return null
  }

  return {
    provider: 'vimeo',
    label: 'Vimeo',
    embedUrl: `https://player.vimeo.com/video/${id}`,
    ratio: wideRatio,
    height: null,
    allowFullScreen: true,
  }
}

function loom(url: URL): EmbedSource | null {
  if (!isHost(url, 'loom.com')) {
    return null
  }

  const path = segments(url)
  const id = path[0] === 'share' || path[0] === 'embed' ? path[1] : undefined

  if (!idPattern(id)) {
    return null
  }

  return {
    provider: 'loom',
    label: 'Loom',
    embedUrl: `https://www.loom.com/embed/${id}`,
    ratio: wideRatio,
    height: null,
    allowFullScreen: true,
  }
}

const figmaKinds = new Set(['board', 'deck', 'design', 'file', 'proto', 'slides'])

function figma(url: URL): EmbedSource | null {
  if (!isHostOrSubdomain(url, 'figma.com')) {
    return null
  }

  const path = segments(url)

  if (path[0] === undefined || !figmaKinds.has(path[0]) || !idPattern(path[1])) {
    return null
  }

  const embed = new URL(`https://embed.figma.com${url.pathname}`)

  for (const [key, value] of url.searchParams) {
    embed.searchParams.set(key, value)
  }

  embed.searchParams.set('embed-host', 'leaf')

  return {
    provider: 'figma',
    label: 'Figma',
    embedUrl: embed.toString(),
    ratio: boardRatio,
    height: null,
    allowFullScreen: true,
  }
}

function miro(url: URL): EmbedSource | null {
  if (!isHost(url, 'miro.com')) {
    return null
  }

  const path = segments(url)
  const isBoard =
    path[0] === 'app' && (path[1] === 'board' || path[1] === 'live-embed')
  const board = path[2]

  if (!isBoard || board === undefined || !/^[A-Za-z0-9_=-]{4,}$/u.test(board)) {
    return null
  }

  return {
    provider: 'miro',
    label: 'Miro',
    embedUrl: `https://miro.com/app/live-embed/${board}/?embedMode=view_only_without_ui`,
    ratio: boardRatio,
    height: null,
    allowFullScreen: true,
  }
}

function googleDocs(url: URL): EmbedSource | null {
  if (!isHost(url, 'docs.google.com')) {
    return null
  }

  const path = segments(url)
  const kind = path[0]

  if (kind === 'forms') {
    const form = new URL(url.toString())

    form.searchParams.set('embedded', 'true')

    return {
      provider: 'googleForm',
      label: 'Google Forms',
      embedUrl: form.toString(),
      ratio: pageRatio,
      height: null,
      allowFullScreen: false,
    }
  }

  const id = path[1] === 'd' ? path[2] : undefined

  if (!idPattern(id)) {
    return null
  }

  if (kind === 'document') {
    return {
      provider: 'googleDocument',
      label: 'Google Docs',
      embedUrl: `https://docs.google.com/document/d/${id}/preview`,
      ratio: pageRatio,
      height: null,
      allowFullScreen: false,
    }
  }

  if (kind === 'spreadsheets') {
    return {
      provider: 'googleSpreadsheet',
      label: 'Google Sheets',
      embedUrl: `https://docs.google.com/spreadsheets/d/${id}/preview`,
      ratio: sheetRatio,
      height: null,
      allowFullScreen: false,
    }
  }

  if (kind === 'presentation') {
    return {
      provider: 'googlePresentation',
      label: 'Google Slides',
      embedUrl: `https://docs.google.com/presentation/d/${id}/embed?start=false&loop=false`,
      ratio: wideRatio,
      height: null,
      allowFullScreen: true,
    }
  }

  return null
}

function googleDrive(url: URL): EmbedSource | null {
  if (!isHost(url, 'drive.google.com')) {
    return null
  }

  const path = segments(url)
  const id = path[0] === 'file' && path[1] === 'd' ? path[2] : undefined

  if (!idPattern(id)) {
    return null
  }

  return {
    provider: 'googleDrive',
    label: 'Google Drive',
    embedUrl: `https://drive.google.com/file/d/${id}/preview`,
    ratio: sheetRatio,
    height: null,
    allowFullScreen: true,
  }
}

function canva(url: URL): EmbedSource | null {
  if (!isHost(url, 'canva.com')) {
    return null
  }

  const path = segments(url)

  if (path[0] !== 'design' || !idPattern(path[1])) {
    return null
  }

  const design = new URL(url.toString())

  design.searchParams.set('embed', '')

  return {
    provider: 'canva',
    label: 'Canva',
    embedUrl: design.toString(),
    ratio: wideRatio,
    height: null,
    allowFullScreen: true,
  }
}

const spotifyKinds = new Set(['album', 'artist', 'episode', 'playlist', 'show', 'track'])

function spotify(url: URL): EmbedSource | null {
  if (!isHost(url, 'open.spotify.com')) {
    return null
  }

  const path = segments(url)
  const kind = path[0] === 'embed' ? path[1] : path[0]
  const id = path[0] === 'embed' ? path[2] : path[1]

  if (kind === undefined || !spotifyKinds.has(kind) || !idPattern(id)) {
    return null
  }

  const compact = kind === 'track' || kind === 'episode'

  return {
    provider: 'spotify',
    label: 'Spotify',
    embedUrl: `https://open.spotify.com/embed/${kind}/${id}`,
    ratio: wideRatio,
    height: compact ? 152 : 380,
    allowFullScreen: false,
  }
}

function typeform(url: URL): EmbedSource | null {
  if (!isHostOrSubdomain(url, 'typeform.com')) {
    return null
  }

  const path = segments(url)
  const id = path[0] === 'to' ? path[1] : undefined

  if (!idPattern(id)) {
    return null
  }

  return {
    provider: 'typeform',
    label: 'Typeform',
    embedUrl: `https://form.typeform.com/to/${id}?typeform-embed=embed-widget`,
    ratio: pageRatio,
    height: null,
    allowFullScreen: false,
  }
}

function codesandbox(url: URL): EmbedSource | null {
  if (!isHost(url, 'codesandbox.io')) {
    return null
  }

  const path = segments(url)
  const id =
    path[0] === 's' || path[0] === 'embed'
      ? path[1]
      : path[0] === 'p' && path[1] === 'sandbox'
        ? path[2]
        : undefined

  if (!idPattern(id)) {
    return null
  }

  return {
    provider: 'codesandbox',
    label: 'CodeSandbox',
    embedUrl: `https://codesandbox.io/embed/${id}`,
    ratio: wideRatio,
    height: null,
    allowFullScreen: true,
  }
}

function codepen(url: URL): EmbedSource | null {
  if (!isHost(url, 'codepen.io')) {
    return null
  }

  const path = segments(url)
  const owner = path[0]
  const id = path[1] === 'pen' || path[1] === 'embed' ? path[2] : undefined

  if (owner === undefined || !idPattern(id)) {
    return null
  }

  return {
    provider: 'codepen',
    label: 'CodePen',
    embedUrl: `https://codepen.io/${owner}/embed/${id}`,
    ratio: wideRatio,
    height: null,
    allowFullScreen: true,
  }
}

const matchers = [
  youtube,
  vimeo,
  loom,
  figma,
  miro,
  googleDocs,
  googleDrive,
  canva,
  spotify,
  typeform,
  codesandbox,
  codepen,
]

export function resolveEmbedSource(value: string): EmbedSource | null {
  const url = parseUrl(value)

  if (url === null) {
    return null
  }

  for (const matcher of matchers) {
    const source = matcher(url)

    if (source !== null) {
      return source
    }
  }

  return null
}

export function isEmbeddableUrl(value: string): boolean {
  return resolveEmbedSource(value) !== null
}

export function embedLinkLabel(value: string): string {
  const url = parseUrl(value)

  return url === null ? value : url.hostname.replace(/^www\./u, '')
}
