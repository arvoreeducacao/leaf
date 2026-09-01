import { describe, expect, it } from 'vitest'

import { normalizeNotionId, notionIdFromLink } from '@/lib/notion/link'

const compact = '24ceeda804ec80058303f8c8afae645f'
const dashed = '24ceeda8-04ec-8005-8303-f8c8afae645f'

describe('link do Notion', () => {
  it('aceita o id cru, com e sem hífen', () => {
    expect(normalizeNotionId(compact)).toBe(dashed)
    expect(normalizeNotionId(dashed)).toBe(dashed)
    expect(notionIdFromLink(compact)).toBe(dashed)
  })

  it('tira o id do fim do caminho, com título junto', () => {
    expect(
      notionIdFromLink(`https://www.notion.so/arvore/Tecnologia-${compact}`),
    ).toBe(dashed)
    expect(notionIdFromLink(`https://app.notion.com/p/${compact}?pvs=204`)).toBe(
      dashed,
    )
  })

  it('usa a página espiada quando o caminho não tem id', () => {
    expect(notionIdFromLink(`https://www.notion.so/arvore?p=${compact}`)).toBe(
      dashed,
    )
  })

  it('ignora o p= quando o caminho já tem a página', () => {
    const other = '390eeda804ec80ee930acdd01d2126ed'

    expect(
      notionIdFromLink(`https://www.notion.so/Pagina-${compact}?p=${other}`),
    ).toBe(dashed)
  })

  it('recusa link que não é do Notion', () => {
    expect(notionIdFromLink(`https://exemplo.com/${compact}`)).toBeNull()
    expect(notionIdFromLink('https://www.notion.so/arvore')).toBeNull()
    expect(notionIdFromLink('nada disso')).toBeNull()
    expect(notionIdFromLink('')).toBeNull()
  })

  it('aceita site publicado do Notion', () => {
    expect(notionIdFromLink(`https://arvore.notion.site/Doc-${compact}`)).toBe(
      dashed,
    )
  })
})
