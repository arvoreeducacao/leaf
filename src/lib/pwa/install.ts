type InstallSignals = Readonly<{
  standalone: boolean
  promptReady: boolean
  desktop: boolean
}>

const mobileDevice = /Android|iP(?:hone|ad|od)|Mobile|webOS|BlackBerry|Windows Phone/i
const ipadOsDesktopUserAgent = /Macintosh/

export function isDesktopBrowser(userAgent: string, maxTouchPoints = 0) {
  if (mobileDevice.test(userAgent)) {
    return false
  }

  return !(ipadOsDesktopUserAgent.test(userAgent) && maxTouchPoints > 1)
}

export function isStandaloneDisplay(target: Window) {
  const navigatorWithStandalone = target.navigator as Navigator & {
    standalone?: boolean
  }

  return (
    target.matchMedia('(display-mode: standalone)').matches ||
    target.matchMedia('(display-mode: window-controls-overlay)').matches ||
    navigatorWithStandalone.standalone === true
  )
}

export function canOfferInstall({ standalone, promptReady, desktop }: InstallSignals) {
  return desktop && !standalone && promptReady
}
