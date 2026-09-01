import { describe, expect, it } from 'vitest'

import { arrangeMenuItems } from './slash-menu-items'

type Item = { title: string; group: string }

const defaults: Array<Item> = [
  { title: 'Heading 1', group: 'Headings' },
  { title: 'Quote', group: 'Basic blocks' },
  { title: 'List', group: 'Basic blocks' },
  { title: 'Table', group: 'Advanced' },
  { title: 'Image', group: 'Advanced' },
]

const callout: Item = { title: 'Callout', group: 'Basic blocks' }
const database: Item = { title: 'Database', group: 'Advanced' }
const importItem: Item = { title: 'Import .md', group: 'Import' }

function groupsOf(items: ReadonlyArray<Item>) {
  return items.map((item) => item.group)
}

function runsOf(items: ReadonlyArray<Item>) {
  return groupsOf(items).filter((group, index, list) => group !== list[index - 1])
}

describe('slash menu order', () => {
  it('inserts each item right after its group sibling', () => {
    const items = arrangeMenuItems(
      defaults,
      [
        { after: 'Quote', item: callout },
        { after: 'Table', item: database },
      ],
      [importItem],
    )

    expect(items.map((item) => item.title)).toEqual([
      'Heading 1',
      'Quote',
      'Callout',
      'List',
      'Table',
      'Database',
      'Image',
      'Import .md',
    ])
  })

  it('keeps each group in a single run, otherwise the menu duplicates the section', () => {
    const items = arrangeMenuItems(
      defaults,
      [
        { after: 'Quote', item: callout },
        { after: 'Table', item: database },
      ],
      [importItem],
    )

    const runs = runsOf(items)

    expect(runs).toEqual(new Array(...new Set(runs)))
    expect(runs).toEqual(['Headings', 'Basic blocks', 'Advanced', 'Import'])
  })

  it('drops at the end the item whose sibling is no longer in the menu', () => {
    const items = arrangeMenuItems(
      defaults,
      [{ after: 'Block that vanished', item: database }],
      [],
    )

    expect(items.at(-1)?.title).toBe('Database')
  })

  it('leaves the menu alone when there is nothing to insert', () => {
    expect(arrangeMenuItems(defaults, [], [])).toEqual(defaults)
  })
})
