import { expect, test } from '@playwright/test'

import { buildNotionFixtureZip, fixtureTitles } from '../src/lib/notion/fixture'
import { createDocument, editorBody, signUp, uniqueEmail } from './helpers'

const archiveInput = '[data-testid="import-archive-input"]'

test.describe('Notion export import', () => {
  test('the zip becomes subpages with image, callout and database', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('zip'))
    await createDocument(page, 'Migration')

    await page.setInputFiles(archiveInput, {
      name: 'export.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(buildNotionFixtureZip()),
    })

    await expect(page.getByText('Importar exportação').first()).toBeVisible()

    await expect(page.getByText(/páginas criadas/)).toBeVisible({
      timeout: 60_000,
    })

    await page.getByRole('button', { name: 'Abrir documento' }).click()

    await expect(page.getByLabel('Título do documento')).toHaveValue(
      fixtureTitles.plan,
    )

    const body = editorBody(page)

    await expect(body).toContainText('Term outline')
    await expect(body).toContainText('Agree on the dates with the coordination')

    await expect(
      page.getByRole('navigation', { name: 'Caminho do documento' }),
    ).toContainText('Migration')

    const nav = page.getByRole('navigation', { name: 'Documentos' })

    await nav
      .getByRole('button', { name: `Expandir ${fixtureTitles.plan}` })
      .click()
    await nav.getByRole('link', { name: new RegExp(fixtureTitles.class) }).click()

    await expect(page.getByLabel('Título do documento')).toHaveValue(
      fixtureTitles.class,
    )
    await expect(editorBody(page).locator('img')).toHaveCount(1)
    await expect(
      page.getByRole('navigation', { name: 'Caminho do documento' }),
    ).toContainText(fixtureTitles.plan)
  })

  test('a corrupted zip returns an error without breaking the app', async ({ page }) => {
    await signUp(page, uniqueEmail('zip-error'))
    await createDocument(page, 'Untouched document')

    await page.setInputFiles(archiveInput, {
      name: 'broken.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from('PK this is not a real zip', 'utf8'),
    })

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 30_000 })
    await expect(
      page.getByRole('button', { name: 'Tentar de novo' }),
    ).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    const nav = page.getByRole('navigation', { name: 'Documentos' })

    await expect(nav.getByRole('link')).toHaveCount(1)
  })
})
