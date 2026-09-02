import { describe, expect, it } from 'vitest'

import { installOfferFor, isIosSafari } from './install'

const iphoneSafari =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const iphoneChrome =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.0.0 Mobile/15E148 Safari/604.1'
const ipadOsSafari =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
const androidChrome =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36'

describe('isIosSafari', () => {
  it('recognizes Safari on the iPhone', () => {
    expect(isIosSafari(iphoneSafari)).toBe(true)
  })

  it('tells iPadOS apart from a Mac by the touch points', () => {
    expect(isIosSafari(ipadOsSafari, 5)).toBe(true)
    expect(isIosSafari(ipadOsSafari, 0)).toBe(false)
  })

  it('leaves other browsers on iOS out, they do not add to the home screen from the share sheet', () => {
    expect(isIosSafari(iphoneChrome)).toBe(false)
  })

  it('ignores Android even though its user agent mentions Safari', () => {
    expect(isIosSafari(androidChrome)).toBe(false)
  })
})

describe('installOfferFor', () => {
  it('offers nothing once the app is already installed', () => {
    expect(
      installOfferFor({ standalone: true, promptReady: true, iosSafari: false }),
    ).toBe('none')
    expect(
      installOfferFor({ standalone: true, promptReady: false, iosSafari: true }),
    ).toBe('none')
  })

  it('uses the native prompt when the browser handed one over', () => {
    expect(
      installOfferFor({ standalone: false, promptReady: true, iosSafari: false }),
    ).toBe('prompt')
  })

  it('falls back to the share sheet hint on Safari for iOS', () => {
    expect(
      installOfferFor({ standalone: false, promptReady: false, iosSafari: true }),
    ).toBe('ios-hint')
  })

  it('stays quiet in browsers with no way to install', () => {
    expect(
      installOfferFor({ standalone: false, promptReady: false, iosSafari: false }),
    ).toBe('none')
  })
})
