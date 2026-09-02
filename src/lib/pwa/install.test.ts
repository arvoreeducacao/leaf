import { describe, expect, it } from 'vitest'

import { canOfferInstall, isDesktopBrowser } from './install'

const windowsChrome =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
const macSafari =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
const linuxFirefox =
  'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0'
const iphoneSafari =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const androidChrome =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36'

describe('isDesktopBrowser', () => {
  it('recognizes desktop browsers', () => {
    expect(isDesktopBrowser(windowsChrome)).toBe(true)
    expect(isDesktopBrowser(macSafari, 0)).toBe(true)
    expect(isDesktopBrowser(linuxFirefox)).toBe(true)
  })

  it('leaves phones out, they get the native app instead', () => {
    expect(isDesktopBrowser(iphoneSafari)).toBe(false)
    expect(isDesktopBrowser(androidChrome)).toBe(false)
  })

  it('tells the iPad apart from a Mac by the touch points', () => {
    expect(isDesktopBrowser(macSafari, 5)).toBe(false)
  })
})

describe('canOfferInstall', () => {
  it('offers the install when a desktop browser handed the prompt over', () => {
    expect(canOfferInstall({ standalone: false, promptReady: true, desktop: true })).toBe(true)
  })

  it('offers nothing once the app is already installed', () => {
    expect(canOfferInstall({ standalone: true, promptReady: true, desktop: true })).toBe(false)
  })

  it('offers nothing on a phone even when the browser could install', () => {
    expect(canOfferInstall({ standalone: false, promptReady: true, desktop: false })).toBe(false)
  })

  it('stays quiet while the browser has not offered the prompt', () => {
    expect(canOfferInstall({ standalone: false, promptReady: false, desktop: true })).toBe(false)
  })
})
