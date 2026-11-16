const cloudflareAccessCookieNames = new Set([
  'CF_Authorization',
  'CF_AppSession',
  'CF_Binding',
])

function cookieName(pair: string) {
  const separator = pair.indexOf('=')

  return (separator === -1 ? pair : pair.slice(0, separator)).trim()
}

export function withoutCloudflareAccessCookies(request: Request): Request {
  const cookieHeader = request.headers.get('cookie')

  if (cookieHeader === null) {
    return request
  }

  const pairs = cookieHeader
    .split(';')
    .map((pair) => pair.trim())
    .filter((pair) => pair.length > 0)

  const kept = pairs.filter(
    (pair) => !cloudflareAccessCookieNames.has(cookieName(pair)),
  )

  if (kept.length === pairs.length) {
    return request
  }

  const headers = new Headers(request.headers)

  if (kept.length === 0) {
    headers.delete('cookie')
  } else {
    headers.set('cookie', kept.join('; '))
  }

  return new Request(request, { headers })
}
