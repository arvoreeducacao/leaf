import { describe, expect, it } from 'vitest'

import { readDocumentIcon } from '@/lib/document-icon'

describe('readDocumentIcon', () => {
  it('reads an https url as an image', () => {
    expect(
      readDocumentIcon('https://www.notion.so/icons/alien-pixel_gray.svg'),
    ).toEqual({
      kind: 'image',
      url: 'https://www.notion.so/icons/alien-pixel_gray.svg',
      fromNotionLibrary: true,
    })
  })

  it('marks an image outside the notion icon library', () => {
    expect(
      readDocumentIcon('https://files.example.com/team/logo.png'),
    ).toEqual({
      kind: 'image',
      url: 'https://files.example.com/team/logo.png',
      fromNotionLibrary: false,
    })
  })

  it('does not take a lookalike host for the notion icon library', () => {
    const source = readDocumentIcon('https://www.notion.so.evil.com/icons/a.svg')

    expect(source).toEqual({
      kind: 'image',
      url: 'https://www.notion.so.evil.com/icons/a.svg',
      fromNotionLibrary: false,
    })
  })

  it('reads an emoji as text', () => {
    expect(readDocumentIcon('🌿')).toEqual({ kind: 'text', text: '🌿' })
    expect(readDocumentIcon('  📝  ')).toEqual({ kind: 'text', text: '📝' })
  })

  it('has no icon for an empty or missing value', () => {
    expect(readDocumentIcon(null)).toBeNull()
    expect(readDocumentIcon(undefined)).toBeNull()
    expect(readDocumentIcon('')).toBeNull()
    expect(readDocumentIcon('   ')).toBeNull()
  })

  it('has no icon for a url that is not https', () => {
    expect(readDocumentIcon('http://www.notion.so/icons/a.svg')).toBeNull()
    expect(readDocumentIcon('//www.notion.so/icons/a.svg')).toBeNull()
    expect(readDocumentIcon('ftp://files.example.com/a.png')).toBeNull()
  })

  it('has no icon for a value too long to be an emoji', () => {
    expect(readDocumentIcon('a'.repeat(65))).toBeNull()
    expect(readDocumentIcon('a'.repeat(64))).toEqual({
      kind: 'text',
      text: 'a'.repeat(64),
    })
  })

  it('has no icon for an https url longer than the column', () => {
    const long = `https://files.example.com/${'a'.repeat(1024)}.png`

    expect(readDocumentIcon(long)).toBeNull()
  })
})
