import { isUploadedIconPath } from '@/lib/document-icon'
import { type IconPack, parseIconPack } from '@/lib/icon-pack'
import { storage } from '@/lib/storage'

export type IconPackEnv = Readonly<Record<string, string | undefined>>

export type IconPackSource =
  | Readonly<{ kind: 'storage'; key: string }>
  | Readonly<{ kind: 'url'; url: string }>

type Loader = (source: IconPackSource) => Promise<string | null>

const uploadPathPrefix = '/api/uploads/'
const maxManifestBytes = 5 * 1024 * 1024
const fetchTimeoutMs = 5000
const freshForMs = 10 * 60 * 1000
const retryAfterFailureMs = 60 * 1000

export function iconPackSource(
  env: IconPackEnv = process.env,
): IconPackSource | null {
  const value = env.LEAF_ICON_PACK_URL?.trim()

  if (!value) {
    return null
  }

  if (value.startsWith('/')) {
    return isUploadedIconPath(value)
      ? { kind: 'storage', key: value.slice(uploadPathPrefix.length) }
      : null
  }

  try {
    const url = new URL(value)

    return url.protocol === 'https:' ? { kind: 'url', url: url.toString() } : null
  } catch {
    return null
  }
}

export function isIconPackEnabled(env: IconPackEnv = process.env) {
  return iconPackSource(env) !== null
}

function decodeManifest(bytes: Uint8Array): string | null {
  return bytes.byteLength <= maxManifestBytes
    ? new TextDecoder().decode(bytes)
    : null
}

async function readManifest(source: IconPackSource): Promise<string | null> {
  if (source.kind === 'storage') {
    const object = await storage.get(source.key)

    if (!object || !Buffer.isBuffer(object.body)) {
      return null
    }

    return decodeManifest(object.body)
  }

  const response = await fetch(source.url, {
    signal: AbortSignal.timeout(fetchTimeoutMs),
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    return null
  }

  const declaredLength = Number(response.headers.get('content-length'))

  if (declaredLength > maxManifestBytes) {
    return null
  }

  return decodeManifest(new Uint8Array(await response.arrayBuffer()))
}

export function createIconPackLoader(
  load: Loader = readManifest,
  now: () => number = Date.now,
) {
  let cached: Readonly<{ key: string; pack: IconPack | null; expiresAt: number }> | null =
    null
  let inFlight: Promise<IconPack | null> | null = null

  async function refresh(source: IconPackSource, key: string) {
    let pack: IconPack | null = null

    try {
      const text = await load(source)

      pack = text === null ? null : parseIconPack(JSON.parse(text))
    } catch {
      pack = null
    }

    const previous = cached?.key === key ? cached.pack : null
    const kept = pack ?? previous

    cached = {
      key,
      pack: kept,
      expiresAt: now() + (pack ? freshForMs : retryAfterFailureMs),
    }

    return kept
  }

  return async function loadIconPack(
    env: IconPackEnv = process.env,
  ): Promise<IconPack | null> {
    const source = iconPackSource(env)

    if (!source) {
      return null
    }

    const key = source.kind === 'storage' ? `storage:${source.key}` : source.url

    if (cached?.key === key && cached.expiresAt > now()) {
      return cached.pack
    }

    if (!inFlight) {
      inFlight = refresh(source, key).finally(() => {
        inFlight = null
      })
    }

    return inFlight
  }
}

export const loadIconPack = createIconPackLoader()
