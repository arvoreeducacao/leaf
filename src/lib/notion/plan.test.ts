import { describe, expect, it } from 'vitest'

import { buildImportPlan } from '@/lib/notion/plan'

const hash = '318eeda804ec80cfa94fe714d05493b3'

const encoder = new TextEncoder()

function entry(path: string, content = 'x') {
  return { bytes: encoder.encode(content), path }
}

describe('buildImportPlan on a web export of a database', () => {
  it('prefers the _all.csv and drops the view csv', () => {
    const plan = buildImportPlan(
      [
        entry(`Feedbacks ${hash}.csv`, 'Nome\nAna'),
        entry(`Feedbacks ${hash}_all.csv`, 'Nome\nAna\nBia'),
      ],
      'Untitled',
    )

    expect(plan.pages).toHaveLength(1)
    expect(plan.pages[0].kind).toBe('csv')
    expect(plan.pages[0].title).toBe('Feedbacks')
    expect(plan.csvByPath.get(plan.pages[0].sourcePath ?? '')).toContain('Bia')
  })

  it('matches the row folder to the csv even without the hash in the folder name', () => {
    const plan = buildImportPlan(
      [
        entry(`Feedbacks ${hash}_all.csv`, 'Nome\nAna'),
        entry(`Feedbacks/Ana ${hash}.md`, '# Ana'),
      ],
      'Untitled',
    )

    const database = plan.pages.find((page) => page.kind === 'csv')
    const row = plan.pages.find((page) => page.title === 'Ana')

    expect(plan.pages).toHaveLength(2)
    expect(row?.parentKey).toBe(database?.key)
  })

  it('maps an asset folder without the hash to its page instead of a new folder', () => {
    const plan = buildImportPlan(
      [
        entry(`Report ${hash}.md`, '# Report'),
        entry('Report/shot.png'),
      ],
      'Untitled',
    )

    expect(plan.pages).toHaveLength(1)
    expect(plan.pages[0].title).toBe('Report')
    expect(plan.assets).toHaveLength(1)
  })
})
