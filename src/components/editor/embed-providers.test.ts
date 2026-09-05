import { describe, expect, it } from 'vitest'

import {
  embedLinkLabel,
  isEmbeddableUrl,
  resolveEmbedSource,
} from './embed-providers'

describe('resolveEmbedSource', () => {
  it('embeds a figma file through the embed host', () => {
    const source = resolveEmbedSource(
      'https://www.figma.com/design/abc123XY/Leaf?node-id=1-2',
    )

    expect(source?.provider).toBe('figma')
    expect(source?.embedUrl).toBe(
      'https://embed.figma.com/design/abc123XY/Leaf?node-id=1-2&embed-host=leaf',
    )
  })

  it('reads the youtube id from watch, short and shortened links', () => {
    const watch = resolveEmbedSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    const short = resolveEmbedSource('https://youtu.be/dQw4w9WgXcQ')
    const shorts = resolveEmbedSource('https://www.youtube.com/shorts/dQw4w9WgXcQ')

    expect(watch?.embedUrl).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    )
    expect(short?.embedUrl).toBe(watch?.embedUrl)
    expect(shorts?.embedUrl).toBe(watch?.embedUrl)
  })

  it('keeps the start time of a youtube link', () => {
    expect(
      resolveEmbedSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90')
        ?.embedUrl,
    ).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90')
  })

  it('turns google files into their preview endpoint', () => {
    expect(
      resolveEmbedSource(
        'https://docs.google.com/document/d/1AbC_dEf-2/edit?usp=sharing',
      )?.embedUrl,
    ).toBe('https://docs.google.com/document/d/1AbC_dEf-2/preview')

    expect(
      resolveEmbedSource(
        'https://docs.google.com/spreadsheets/d/1AbC_dEf-2/edit#gid=0',
      )?.embedUrl,
    ).toBe('https://docs.google.com/spreadsheets/d/1AbC_dEf-2/preview')

    expect(
      resolveEmbedSource('https://drive.google.com/file/d/1AbC_dEf-2/view')
        ?.embedUrl,
    ).toBe('https://drive.google.com/file/d/1AbC_dEf-2/preview')
  })

  it('embeds a miro board in view only mode', () => {
    expect(
      resolveEmbedSource('https://miro.com/app/board/uXjVOxyz123=/')?.embedUrl,
    ).toBe(
      'https://miro.com/app/live-embed/uXjVOxyz123=/?embedMode=view_only_without_ui',
    )
  })

  it('gives a spotify track its compact height', () => {
    const track = resolveEmbedSource(
      'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
    )
    const playlist = resolveEmbedSource(
      'https://open.spotify.com/playlist/4cOdK2wGLETKBW3PvgPWqT',
    )

    expect(track?.height).toBe(152)
    expect(playlist?.height).toBe(380)
  })

  it('refuses what it cannot frame', () => {
    expect(resolveEmbedSource('https://example.com/report.pdf')).toBeNull()
    expect(resolveEmbedSource('https://www.figma.com/files/recent')).toBeNull()
    expect(resolveEmbedSource('javascript:alert(1)')).toBeNull()
    expect(resolveEmbedSource('not a url')).toBeNull()
    expect(resolveEmbedSource('')).toBeNull()
  })

  it('answers the question the editor asks before pasting', () => {
    expect(isEmbeddableUrl('https://www.loom.com/share/abc123def456')).toBe(true)
    expect(isEmbeddableUrl('https://example.com')).toBe(false)
  })
})

describe('embedLinkLabel', () => {
  it('shows the host of the original link', () => {
    expect(embedLinkLabel('https://www.figma.com/design/abc123XY/Leaf')).toBe(
      'figma.com',
    )
  })

  it('falls back to the raw value when there is no host', () => {
    expect(embedLinkLabel('nonsense')).toBe('nonsense')
  })
})
