import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AiFace } from '@/components/ai/ai-face'
import { faceStates } from '@/lib/ai-face-state'

function render(props: Parameters<typeof AiFace>[0]) {
  return renderToStaticMarkup(createElement(AiFace, props))
}

describe('AiFace', () => {
  it('carries the state as a class, so the css drives the movement', () => {
    for (const state of faceStates) {
      expect(render({ size: 34, state })).toContain(`leaf-face-${state}`)
    }
  })

  it('draws at the size it was asked for', () => {
    const markup = render({ size: 34, state: 'resting' })

    expect(markup).toContain('width="34"')
    expect(markup).toContain('height="34"')
    expect(markup).toContain('viewBox="0 0 100 100"')
  })

  it('thins out and drops the leaf only at the small sizes', () => {
    expect(render({ size: 18, state: 'resting' })).toContain('leaf-face-mini')
    expect(render({ size: 26, state: 'resting' })).not.toContain(
      'leaf-face-mini',
    )
  })

  it('keeps the parts the css animates separately', () => {
    const markup = render({ size: 34, state: 'resting' })

    for (const part of [
      'leaf-face-head',
      'leaf-face-breath',
      'leaf-face-gaze',
      'leaf-face-follow',
      'leaf-face-eye',
      'leaf-face-mouth',
      'leaf-face-ring',
      'leaf-face-leaf',
    ]) {
      expect(markup).toContain(part)
    }
  })

  it('puts both eyes on the line the mouth paths were drawn around', () => {
    const markup = render({ size: 34, state: 'resting' })

    expect(markup).toContain('cx="39"')
    expect(markup).toContain('cx="61"')
    expect(markup).toContain('cy="52"')
    expect(markup).toContain('M41 62 Q50 69 59 62')
  })

  it('stays out of the accessibility tree', () => {
    expect(render({ size: 34, state: 'resting' })).toContain(
      'aria-hidden="true"',
    )
  })
})
