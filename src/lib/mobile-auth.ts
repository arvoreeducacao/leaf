export const mobileAppScheme = 'app.leaf'

export const mobileEntryPath = '/api/mobile/enter'

const expoDevelopmentOrigins = ['exp://', 'exp://**']

export function mobileTrustedOrigins(nodeEnv: string | undefined): Array<string> {
  const appOrigin = `${mobileAppScheme}://`

  if (nodeEnv === 'development') {
    return [appOrigin, ...expoDevelopmentOrigins]
  }

  return [appOrigin]
}

export function mobileEntryToken(requestUrl: string): string | null {
  const token = new URL(requestUrl).searchParams.get('token')?.trim()

  return token && token.length > 0 ? token : null
}
