import { describe, expect, it } from 'vitest'

import {
  defaultSidebarLayout,
  moveSection,
  normalizeSidebarLayout,
  parseSidebarLayout,
  toggleSectionVisibility,
  visibleSectionIds,
} from '@/lib/sidebar-layout'

describe('normalizeSidebarLayout', () => {
  it('falls back to the default order when there is nothing stored', () => {
    expect(normalizeSidebarLayout(null)).toEqual(defaultSidebarLayout)
    expect(normalizeSidebarLayout({})).toEqual(defaultSidebarLayout)
  })

  it('keeps the stored order and appends sections it does not know about yet', () => {
    expect(normalizeSidebarLayout({ order: ['private'] })).toEqual({
      hidden: [],
      order: ['private', 'recents', 'teamspaces', 'organization', 'shared'],
    })
  })

  it('drops unknown ids and repeated ones', () => {
    expect(
      normalizeSidebarLayout({
        hidden: ['shared', 'shared', 'agents'],
        order: ['private', 'agents', 'private', 'shared'],
      }),
    ).toEqual({
      hidden: ['shared'],
      order: ['private', 'shared', 'recents', 'teamspaces', 'organization'],
    })
  })

  it('reads what was serialized and survives broken json', () => {
    const stored = JSON.stringify({ hidden: ['shared'], order: ['shared'] })

    expect(parseSidebarLayout(stored)).toEqual({
      hidden: ['shared'],
      order: ['shared', 'recents', 'private', 'teamspaces', 'organization'],
    })
    expect(parseSidebarLayout('{ not json')).toEqual(defaultSidebarLayout)
    expect(parseSidebarLayout(null)).toEqual(defaultSidebarLayout)
  })
})

describe('moveSection', () => {
  it('moves a section to the asked position', () => {
    expect(moveSection(defaultSidebarLayout, 'teamspaces', 0).order).toEqual([
      'teamspaces',
      'recents',
      'private',
      'organization',
      'shared',
    ])
  })

  it('clamps positions outside the list and keeps the layout when nothing moves', () => {
    expect(moveSection(defaultSidebarLayout, 'recents', -3).order).toEqual(
      defaultSidebarLayout.order,
    )
    expect(moveSection(defaultSidebarLayout, 'recents', 9).order).toEqual([
      'private',
      'teamspaces',
      'organization',
      'shared',
      'recents',
    ])
  })

  it('does not touch which sections are hidden', () => {
    const hiddenShared = toggleSectionVisibility(defaultSidebarLayout, 'shared')

    expect(moveSection(hiddenShared, 'shared', 0).hidden).toEqual(['shared'])
  })
})

describe('toggleSectionVisibility', () => {
  it('hides and shows a section again', () => {
    const hidden = toggleSectionVisibility(defaultSidebarLayout, 'organization')

    expect(hidden.hidden).toEqual(['organization'])
    expect(visibleSectionIds(hidden)).toEqual([
      'recents',
      'private',
      'teamspaces',
      'shared',
    ])
    expect(toggleSectionVisibility(hidden, 'organization')).toEqual(
      defaultSidebarLayout,
    )
  })
})
