import { describe, expect, it } from 'vitest'

import { notionIconValue, readDocumentIcon } from '@/lib/document-icon'

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

describe('notionIconValue', () => {
  it('builds the gallery url from the icon name and color', () => {
    expect(
      notionIconValue({ icon: { name: 'alien-pixel', color: 'gray' } }),
    ).toBe('https://www.notion.so/icons/alien-pixel_gray.svg')
    expect(notionIconValue({ icon: { name: 'book', color: 'blue' } })).toBe(
      'https://www.notion.so/icons/book_blue.svg',
    )
  })

  it('falls back to gray when the gallery icon has no color', () => {
    expect(notionIconValue({ icon: { name: 'book' } })).toBe(
      'https://www.notion.so/icons/book_gray.svg',
    )
  })

  it('refuses a gallery name that could escape the icon path', () => {
    expect(notionIconValue({ icon: { name: '../../evil', color: 'gray' } })).toBeNull()
    expect(notionIconValue({ icon: { name: 'book.svg?x=1', color: 'gray' } })).toBeNull()
    expect(notionIconValue({ icon: { name: 'book', color: 'gray/../x' } })).toBeNull()
    expect(notionIconValue({ icon: { name: '', color: 'gray' } })).toBeNull()
  })

  it('keeps reading the shapes it already read', () => {
    expect(notionIconValue({ emoji: '🌿' })).toBe('🌿')
    expect(
      notionIconValue({ external: { url: 'https://files.example.com/a.png' } }),
    ).toBe('https://files.example.com/a.png')
    expect(
      notionIconValue({ file: { url: 'https://prod-files.example.com/b.png' } }),
    ).toBe('https://prod-files.example.com/b.png')
    expect(
      notionIconValue({ custom_emoji: { url: 'https://files.example.com/c.png' } }),
    ).toBe('https://files.example.com/c.png')
  })

  it('prefers the emoji over anything else', () => {
    expect(
      notionIconValue({ emoji: '📝', icon: { name: 'book', color: 'gray' } }),
    ).toBe('📝')
  })

  it('has no icon when nothing is readable', () => {
    expect(notionIconValue(null)).toBeNull()
    expect(notionIconValue(undefined)).toBeNull()
    expect(notionIconValue({})).toBeNull()
    expect(notionIconValue({ external: { url: 'http://insecure.example.com/a.png' } })).toBeNull()
  })

  it('hands the renderer something it treats as a notion library icon', () => {
    const value = notionIconValue({ icon: { name: 'book', color: 'gray' } })

    expect(readDocumentIcon(value)).toEqual({
      kind: 'image',
      url: 'https://www.notion.so/icons/book_gray.svg',
      fromNotionLibrary: true,
    })
  })
})
