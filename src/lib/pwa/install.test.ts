import { describe, expect, it } from 'vitest'

import { installOfferFor, isIosDevice, isIosSafari } from './install'

const windowsChrome =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
const macSafari =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
const iphoneSafari =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const iphoneChrome =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.0.0 Mobile/15E148 Safari/604.1'
const androidChrome =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36'

const offer = (over: Partial<Parameters<typeof installOfferFor>[0]>) =>
  installOfferFor({
    standalone: false,
    promptReady: false,
    ios: false,
    iosSafari: false,
    ...over,
  })

describe('isIosDevice', () => {
  it('recognizes the iPhone whatever the browser', () => {
    expect(isIosDevice(iphoneSafari)).toBe(true)
    expect(isIosDevice(iphoneChrome)).toBe(true)
  })

  it('tells the iPad apart from a Mac by the touch points', () => {
    expect(isIosDevice(macSafari, 5)).toBe(true)
    expect(isIosDevice(macSafari, 0)).toBe(false)
  })

  it('leaves Android and the desktop out', () => {
    expect(isIosDevice(androidChrome)).toBe(false)
    expect(isIosDevice(windowsChrome)).toBe(false)
  })
})

describe('isIosSafari', () => {
  it('recognizes Safari on the iPhone, the only one that can add to the home screen', () => {
    expect(isIosSafari(iphoneSafari)).toBe(true)
  })

  it('does not take Chrome on the iPhone for Safari', () => {
    expect(isIosSafari(iphoneChrome)).toBe(false)
  })
})

describe('installOfferFor', () => {
  it('offers the browser prompt wherever the browser handed it over', () => {
    expect(offer({ promptReady: true })).toBe('prompt')
  })

  it('offers the prompt on Android too, not only on the desktop', () => {
    expect(offer({ promptReady: true, ios: false })).toBe('prompt')
  })

  it('teaches the home screen on Safari, which has no prompt', () => {
    expect(offer({ ios: true, iosSafari: true })).toBe('ios-safari')
  })

  it('sends the other iPhone browsers to Safari instead of leaving them empty-handed', () => {
    expect(offer({ ios: true, iosSafari: false })).toBe('ios-browser')
  })

  it('offers nothing once the app is installed, even on the iPhone', () => {
    expect(offer({ standalone: true, promptReady: true })).toBe('none')
    expect(offer({ standalone: true, ios: true, iosSafari: true })).toBe('none')
  })

  it('stays quiet on a desktop browser that never offered the prompt', () => {
    expect(offer({})).toBe('none')
  })
})
