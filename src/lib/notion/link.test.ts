import { describe, expect, it } from 'vitest'

import { normalizeNotionId, notionIdFromLink } from '@/lib/notion/link'

const compact = '24ceeda804ec80058303f8c8afae645f'
const dashed = '24ceeda8-04ec-8005-8303-f8c8afae645f'

describe('Notion link', () => {
  it('accepts the raw id, with and without dashes', () => {
    expect(normalizeNotionId(compact)).toBe(dashed)
    expect(normalizeNotionId(dashed)).toBe(dashed)
    expect(notionIdFromLink(compact)).toBe(dashed)
  })

  it('takes the id from the end of the path, title included', () => {
    expect(
      notionIdFromLink(`https://www.notion.so/acme/Technology-${compact}`),
    ).toBe(dashed)
    expect(notionIdFromLink(`https://app.notion.com/p/${compact}?pvs=204`)).toBe(
      dashed,
    )
  })

  it('uses the peeked page when the path has no id', () => {
    expect(notionIdFromLink(`https://www.notion.so/acme?p=${compact}`)).toBe(
      dashed,
    )
  })

  it('ignores the p= when the path already has the page', () => {
    const other = '390eeda804ec80ee930acdd01d2126ed'

    expect(
      notionIdFromLink(`https://www.notion.so/Page-${compact}?p=${other}`),
    ).toBe(dashed)
  })

  it('rejects a link that is not from Notion', () => {
    expect(notionIdFromLink(`https://example.com/${compact}`)).toBeNull()
    expect(notionIdFromLink('https://www.notion.so/acme')).toBeNull()
    expect(notionIdFromLink('none of that')).toBeNull()
    expect(notionIdFromLink('')).toBeNull()
  })

  it('accepts a published Notion site', () => {
    expect(notionIdFromLink(`https://acme.notion.site/Doc-${compact}`)).toBe(
      dashed,
    )
  })
})
