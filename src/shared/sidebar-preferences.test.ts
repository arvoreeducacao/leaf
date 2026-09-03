import { describe, expect, it } from 'vitest'

import {
  defaultSidebarPreferences,
  parseSidebarPreferences,
  serializeSidebarPreferences,
} from '@/shared/sidebar-preferences'

describe('sidebar preferences', () => {
  it('falls back to defaults without a cookie', () => {
    expect(parseSidebarPreferences(undefined)).toEqual(
      defaultSidebarPreferences,
    )
  })

  it('falls back to defaults on malformed input', () => {
    expect(parseSidebarPreferences('not json')).toEqual(
      defaultSidebarPreferences,
    )
  })

  it('round trips a stored preference', () => {
    const preferences = {
      collapsed: true,
      collapsedSections: ['recents', 'teamspace:abc'],
      width: 320,
    }

    expect(
      parseSidebarPreferences(serializeSidebarPreferences(preferences)),
    ).toEqual(preferences)
  })

  it('rejects a width below the minimum', () => {
    expect(parseSidebarPreferences('{"width":10}').width).toBe(180)
  })

  it('ignores non string section ids', () => {
    expect(
      parseSidebarPreferences('{"collapsedSections":["ok",3,null]}')
        .collapsedSections,
    ).toEqual(['ok'])
  })
})
