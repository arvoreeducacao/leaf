export const notionImportParam = 'notionImport'

export const notionStatusParam = 'notion'

export function notionConnectHref(returnPath: string, flow: string) {
  const back = `${returnPath}?${notionImportParam}=${flow}`

  return `/api/notion/connect?return=${encodeURIComponent(back)}`
}
