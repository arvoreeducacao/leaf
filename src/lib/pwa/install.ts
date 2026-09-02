export type InstallOffer = 'prompt' | 'ios-hint' | 'none'

type InstallSignals = Readonly<{
  standalone: boolean
  promptReady: boolean
  iosSafari: boolean
}>

const iosDevice = /iP(?:hone|ad|od)/
const ipadOsDesktopUserAgent = /Macintosh/
const safariEngine = /Safari\//
const otherIosBrowsers = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|YaBrowser|DuckDuckGo/

export function isIosSafari(userAgent: string, maxTouchPoints = 0) {
  const ios =
    iosDevice.test(userAgent) ||
    (ipadOsDesktopUserAgent.test(userAgent) && maxTouchPoints > 1)

  return ios && safariEngine.test(userAgent) && !otherIosBrowsers.test(userAgent)
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

export function installOfferFor({
  standalone,
  promptReady,
  iosSafari,
}: InstallSignals): InstallOffer {
  if (standalone) {
    return 'none'
  }

  if (promptReady) {
    return 'prompt'
  }

  if (iosSafari) {
    return 'ios-hint'
  }

  return 'none'
}
